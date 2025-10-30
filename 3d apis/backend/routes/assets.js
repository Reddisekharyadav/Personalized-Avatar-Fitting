import express from 'express';
import sharp from 'sharp';
import axios from 'axios';
import { load } from 'cheerio';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { HfInference } from '@huggingface/inference';
import path from 'node:path';
import Asset from '../models/Asset.js';
import { authenticateJWT } from '../lib/auth.js';
import { extractImageFromAmazon } from '../lib/amazonExtractor.js';
import { uploadBufferToS3, generateAssetS3Key } from '../lib/s3.js';
import { uploadAssetToRPM } from '../lib/rpm.js';
import { generateLocalTripoSR } from '../lib/triposrLocal.js';

const router = express.Router();

/**
 * GET /api/assets
 * Requirement C: Query params: owner=me | public
 * Return list of assets (from DB) with pagination
 */
router.get('/', async (req, res) => {
  const { owner, page = 1, limit = 20 } = req.query;
  
  try {
    let query = {};
    
    if (owner === 'me') {
      // Require authentication
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      query.ownerUserId = req.user.userId;
    } else if (owner === 'public') {
      // Public assets (no owner)
      query.ownerUserId = null;
    }
    
    // Only return ready assets by default
    query.status = 'ready';
    
    const skip = (page - 1) * limit;
    const assets = await Asset.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .lean();
    
    const total = await Asset.countDocuments(query);
    
    return res.json({
      ok: true,
      assets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get assets error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve assets',
      details: error.message 
    });
  }
});

/**
 * POST /api/assets/create-from-amazon
 * Requirement C: Create asset from Amazon product link
 * 
 * Body: { amazonUrl, title, description, ownerUserId }
 * Flow: validate URL -> extract product image URL -> download image -> 
 *       process (sharp) to required sizes -> create texture pack -> 
 *       upload to S3 -> register/upload asset to RPM Asset Manager -> store asset record in DB
 * 
 * Requirement F: Amazon product image extraction
 * Requirement G: RPM asset creation
 */
router.post('/create-from-amazon', authenticateJWT, async (req, res) => {
  const { amazonUrl, title, description } = req.body;
  const ownerUserId = req.user.userId;

  // Validate inputs
  if (!amazonUrl || !title) {
    return res.status(400).json({ error: 'amazonUrl and title are required' });
  }

  try {
    console.log(`Creating asset from Amazon: ${amazonUrl}`);

    // Create pending asset record immediately (Requirement C: return 202 Accepted)
    const asset = await Asset.create({
      ownerUserId,
      title,
      description: description || '',
      source: 'created-from-amazon',
      status: 'pending',
      metadata: { amazonUrl }
    });

    // Start background processing (don't await)
    processAmazonAsset(asset._id, amazonUrl).catch(error => {
      console.error(`Asset ${asset._id} processing failed:`, error);
    });

    return res.status(202).json({
      ok: true,
      assetId: asset._id,
      status: 'pending',
      message: 'Asset creation started. Processing in background.'
    });

  } catch (error) {
    console.error('Create asset from Amazon error:', error);
    return res.status(500).json({ 
      error: 'Failed to create asset',
      details: error.message 
    });
  }
});

/**
 * Background processing function for Amazon assets
 * Requirement F: Extract and process Amazon product image
 * Requirement G: Upload to RPM Asset Manager
 */
async function processAmazonAsset(assetId, amazonUrl) {
  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Step 1: Extract product image URL (Requirement F)
    console.log(`Extracting image from Amazon: ${amazonUrl}`);
    let imageUrl;
    try {
      imageUrl = await extractImageFromAmazon(amazonUrl);
    } catch (error) {
      asset.status = 'failed';
      asset.metadata.error = `Image extraction failed: ${error.message}`;
      await asset.save();
      throw error;
    }

    if (!imageUrl) {
      asset.status = 'failed';
      asset.metadata.error = 'No product image found on Amazon page';
      await asset.save();
      throw new Error('No product image found');
    }

    // Step 2: Download image (Requirement F)
    console.log(`Downloading product image: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Step 3: Process image into required sizes (Requirement F)
    console.log('Processing image with Sharp...');
    const sizes = [512, 1024];
    const processedImages = {};

    for (const size of sizes) {
      const resized = await sharp(imageBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      processedImages[size] = resized;
    }

    // Step 4: Upload processed images to S3 (Requirement F)
    console.log('Uploading images to S3...');
    const s3Urls = [];
    for (const [size, buffer] of Object.entries(processedImages)) {
      const s3Key = generateAssetS3Key(assetId, `${size}.png`);
      const s3Url = await uploadBufferToS3(buffer, s3Key, 'image/png');
      s3Urls.push(s3Url);
    }

    asset.thumbnails = s3Urls;
    asset.s3Url = s3Urls[0]; // primary image

    // Step 5: Create texture pack for RPM (Requirement G)
    // RPM Asset Manager expects either a GLB with textures or a texture pack
    // For simplicity, we'll upload the largest texture as a standalone asset
    // TODO: Developer should customize this based on RPM Asset Manager requirements
    console.log('Preparing RPM asset upload...');
    
    const rpmMetadata = {
      name: asset.title,
      type: 'texture',
      targetSlot: 'clothing', // TODO: Make this configurable
      filename: 'texture.png',
      contentType: 'image/png'
    };

    // Upload to RPM Asset Manager (Requirement G)
    try {
      const rpmResponse = await uploadAssetToRPM(processedImages[1024], rpmMetadata);
      asset.rpmAssetId = rpmResponse.assetId;
      asset.rpmAssetUrl = rpmResponse.assetUrl;
      asset.status = rpmResponse.status === 'ready' ? 'ready' : 'pending';
    } catch (error) {
      console.warn('RPM upload failed, but keeping local asset:', error.message);
      // Asset still available locally in S3, mark as ready
      asset.status = 'ready';
      asset.metadata.rpmUploadError = error.message;
    }

    await asset.save();
    console.log(`Asset ${assetId} processing complete:`, asset.status);

  } catch (error) {
    console.error(`Asset ${assetId} processing error:`, error);
    const asset = await Asset.findById(assetId);
    if (asset) {
      asset.status = 'failed';
      asset.metadata.error = error.message;
      await asset.save();
    }
  }
}

/**
 * POST /api/assets/upload-rpm
 * Requirement C: Direct upload to RPM Asset Manager
 * Body: { fileUrlOrBuffer, metadata }
 */
router.post('/upload-rpm', authenticateJWT, async (req, res) => {
  const { fileUrl, metadata } = req.body;
  const ownerUserId = req.user.userId;

  if (!fileUrl || !metadata) {
    return res.status(400).json({ error: 'fileUrl and metadata are required' });
  }

  try {
    // Download file
    console.log(`Downloading file for RPM upload: ${fileUrl}`);
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const fileBuffer = Buffer.from(response.data);

    // Upload to RPM
    const rpmResponse = await uploadAssetToRPM(fileBuffer, metadata);

    // Create asset record
    const asset = await Asset.create({
      ownerUserId,
      title: metadata.name || 'Uploaded Asset',
      description: metadata.description || '',
      source: 'uploaded',
      rpmAssetId: rpmResponse.assetId,
      rpmAssetUrl: rpmResponse.assetUrl,
      status: rpmResponse.status,
      metadata: metadata
    });

    return res.json({
      ok: true,
      asset
    });

  } catch (error) {
    console.error('Upload to RPM error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload asset to RPM',
      details: error.message 
    });
  }
});

/**
 * POST /api/assets/apply
 * Requirement C: Apply asset to user's avatar
 * Body: { userId, assetId }
 * 
 * Note: Actual asset application happens on the frontend using Three.js or RPM runtime.
 * This endpoint just validates the request and returns success.
 */
router.post('/apply', authenticateJWT, async (req, res) => {
  const { assetId } = req.body;

  if (!assetId) {
    return res.status(400).json({ error: 'assetId is required' });
  }

  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.status !== 'ready') {
      return res.status(400).json({ error: 'Asset is not ready yet' });
    }

    // Return asset details for frontend to apply
    return res.json({
      ok: true,
      asset: {
        _id: asset._id,
        title: asset.title,
        rpmAssetUrl: asset.rpmAssetUrl,
        s3Url: asset.s3Url,
        thumbnails: asset.thumbnails,
        metadata: asset.metadata
      },
      message: 'Asset ready to apply on frontend'
    });

  } catch (error) {
    console.error('Apply asset error:', error);
    return res.status(500).json({ 
      error: 'Failed to apply asset',
      details: error.message 
    });
  }
});

/**
 * GET /api/assets/:assetId
 * Get specific asset details
 */
router.get('/:assetId', async (req, res) => {
  const { assetId } = req.params;

  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return res.json({
      ok: true,
      asset
    });

  } catch (error) {
    console.error('Get asset error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve asset',
      details: error.message 
    });
  }
});

/**
 * POST /api/assets/extract-from-url
 * Extract product info from any e-commerce URL (Amazon, Flipkart, Meesho, etc.)
 */
router.post('/extract-from-url', authenticateJWT, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`🔍 Extracting product from: ${url}`);

    // Try to determine if it's a direct image URL
    if (url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
      console.log('✅ Direct image URL detected');
      return res.json({
        success: true,
        imageUrl: url,
        title: 'Product Image'
      });
    }

    // Try Amazon extractor first (works for Amazon URLs)
    try {
      console.log('🔄 Trying Amazon extractor...');
      const imageUrl = await extractImageFromAmazon(url);
      console.log('📦 Amazon extractor result:', imageUrl);
      
      if (imageUrl) {
        console.log('✅ Extracted via Amazon extractor:', imageUrl);
        return res.json({
          success: true,
          imageUrl: imageUrl,
          title: 'Amazon Product'
        });
      }
      
      console.log('⚠️ Amazon extractor returned null/empty');
    } catch (amazonError) {
      console.log('⚠️ Amazon extractor error:', amazonError.message);
      console.log('⚠️ Amazon extractor stack:', amazonError.stack);
    }

    // Fallback: Generic Open Graph extractor for other e-commerce sites
    console.log('🔄 Trying generic Open Graph extraction...');
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      maxRedirects: 5
    });

    const $ = load(response.data);

    // Try multiple strategies
    let imageUrl = null;
    let title = null;

    // Strategy 1: Open Graph meta tags
    imageUrl = $('meta[property="og:image"]').attr('content');
    title = $('meta[property="og:title"]').attr('content');

    // Strategy 2: Twitter card
    if (!imageUrl) {
      imageUrl = $('meta[name="twitter:image"]').attr('content');
    }
    if (!title) {
      title = $('meta[name="twitter:title"]').attr('content');
    }

    // Strategy 3: First large image
    if (!imageUrl) {
      const img = $('img[src*="product"], img[src*="item"], img.product-image, #product-image').first();
      imageUrl = img.attr('src') || img.attr('data-src');
    }

    // Strategy 4: Page title
    if (!title) {
      title = $('title').text() || $('h1').first().text();
    }

    if (imageUrl) {
      // Make sure URL is absolute
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imageUrl = urlObj.origin + imageUrl;
      }

      console.log('✅ Extracted via Open Graph:', imageUrl);
      return res.json({
        success: true,
        imageUrl,
        title: title || 'Extracted Product'
      });
    }

    // No image found
    return res.status(400).json({ 
      success: false,
      error: 'Could not extract product image. Try using a direct image URL instead.',
      hint: 'Right-click on the product image and select "Copy image address", then paste that URL here.'
    });

  } catch (error) {
    console.error('❌ Extract URL error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to extract product info',
      details: error.message 
    });
  }
});

/**
 * POST /api/assets/generate-from-image
 * Generate 3D model and icon from product image using Meshy.ai (primary) or Tripo AI (fallback)
 */
router.post('/generate-from-image', authenticateJWT, async (req, res) => {
  const { imageUrl, name, type, gender, userPhotoUrl } = req.body;
  const ownerUserId = req.user.userId;

  if (!imageUrl || !name || !type || !gender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log(`🎨 Generating 3D asset from image: ${imageUrl}`);
    if (userPhotoUrl) {
      console.log(`👤 User photo provided: ${userPhotoUrl}`);
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Create icon (256x256)
    const iconBuffer = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    // Upload icon (S3 or GridFS fallback)
    const iconKey = generateAssetS3Key(ownerUserId, `${name}-icon.png`);
    const iconUrl = await uploadBufferToS3(iconBuffer, iconKey, 'image/png');

    // Attempt local TripoSR generation first
    let modelUrl = null;
    let generationMethod = 'local-triposr';
    let generationError = null;

    try {
      const safeBase = (name || 'asset')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'asset';
      const fileName = `${Date.now()}-${safeBase}.glb`;
      const outPath = path.join(process.cwd(), 'avatars', fileName);

      console.log('🧩 Using local TripoSR to generate GLB...');
      await generateLocalTripoSR(imageBuffer, outPath);

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host');
      const encoded = fileName.split('/').map(encodeURIComponent).join('/');
      modelUrl = `${protocol}://${host}/avatars/${encoded}`;
      console.log('✅ Local GLB ready at:', modelUrl);
    } catch (e) {
      generationMethod = 'rpm-workflow';
      generationError = e?.message || String(e);
      console.warn('⚠️ Local TripoSR generation failed, falling back:', generationError);
    }

    // Create asset record in database
    const asset = await Asset.create({
      ownerUserId,
      title: name,
      description: `Generated from e-commerce product${userPhotoUrl ? ' with user photo' : ''}`,
      source: 'uploaded',
      status: modelUrl ? 'ready' : 'pending',
      metadata: {
        type,
        gender,
        originalImageUrl: imageUrl,
        userPhotoUrl: userPhotoUrl || null,
        generationMethod,
        generationError,
        needsManualReview: !modelUrl
      }
    });

    if (!modelUrl) {
      let userMessage = '✅ Asset created for Ready Player Me workflow. Local 3D generation is unavailable.\n\n';
      userMessage += 'Next Steps:\n';
      userMessage += '  1. Go to Wardrobe to see your saved clothing item\n';
      userMessage += '  2. Click "Open RPM Avatar Creator" to customize your avatar\n';
      userMessage += '  3. Use RPM\'s interface to try on clothing\n';
      userMessage += '  4. Your avatar will be saved automatically';

      return res.json({
        success: true,
        iconUrl,
        modelUrl: null,
        assetData: { id: asset._id, name, type, gender },
        message: userMessage,
        error: generationError
      });
    }

    return res.json({
      success: true,
      iconUrl,
      modelUrl,
      generationMethod,
      assetData: { id: asset._id, name, type, gender },
      message: '✅ 3D model generated locally with TripoSR.'
    });

  } catch (error) {
    console.error('❌ Generate asset error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate asset',
      details: error.message 
    });
  }
});

/**
 * Generate 3D model using Meshy.ai
 */
async function generateWithMeshy(imageUrl, name) {
  const MESHY_API_KEY = process.env.MESHY_API_KEY;
  
  try {
    // Step 1: Create task (correct API v1 endpoint)
    const createResponse = await axios.post(
      'https://api.meshy.ai/v1/image-to-3d',
      {
        image_url: imageUrl,
        enable_pbr: true
      },
      {
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const taskId = createResponse.data.result;
    console.log(`📋 Meshy task created: ${taskId}`);

    // Step 2: Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    const pollInterval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await axios.get(
        `https://api.meshy.ai/v1/image-to-3d/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${MESHY_API_KEY}`
          }
        }
      );

      const status = statusResponse.data.status;
      console.log(`📊 Meshy status (${i + 1}/${maxAttempts}): ${status}`);

      if (status === 'SUCCEEDED') {
        const modelUrl = statusResponse.data.model_urls?.glb;
        if (modelUrl) {
          return { success: true, modelUrl };
        }
      } else if (status === 'FAILED') {
        throw new Error('Meshy generation failed');
      }
    }

    throw new Error('Meshy generation timeout');

  } catch (error) {
    console.error('❌ Meshy error details:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('  Message:', error.message);
    throw error;
  }
}

/**
 * Generate 3D model using Tripo AI
 */
async function generateWithTripo(imageUrl, name) {
  const TRIPO_API_KEY = process.env.TRIPO_API_KEY;
  
  try {
    // Step 1: Create task (Tripo v2 API)
    console.log('📤 Creating Tripo task with image:', imageUrl);
    
    const createResponse = await axios.post(
      'https://api.tripo3d.ai/v2/openapi/task',
      {
        type: 'image_to_model',
        file: {
          type: 'url',
          url: imageUrl  // Changed from 'file_url' to 'url'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TRIPO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const taskId = createResponse.data.data.task_id;
    console.log(`📋 Tripo task created: ${taskId}`);

    // Step 2: Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await axios.get(
        `https://api.tripo3d.ai/v2/openapi/task/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${TRIPO_API_KEY}`
          }
        }
      );

      const status = statusResponse.data.data.status;
      console.log(`📊 Tripo status (${i + 1}/${maxAttempts}): ${status}`);

      if (status === 'success') {
        const modelUrl = statusResponse.data.data.output?.model;
        if (modelUrl) {
          return { success: true, modelUrl };
        }
      } else if (status === 'failed') {
        throw new Error('Tripo generation failed');
      }
    }

    throw new Error('Tripo generation timeout');

  } catch (error) {
    console.error('❌ Tripo error details:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('  Message:', error.message);
    throw error;
  }
}

/**
 * Generate 3D model using Replicate API (FREE tier available!)
 * Uses open-source 3D models like TripoSR
 */
async function generateWithReplicate(imageUrl, name, ownerUserId) {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  
  if (!REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token not configured');
  }
  
  try {
    console.log('🔮 Using Replicate API for 3D generation...');
    console.log('📥 Image URL:', imageUrl);
    
    // Create prediction using TripoSR model on Replicate
    // Using the latest version of TripoSR
    console.log('🚀 Creating prediction...');
    const createResponse = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        // Use the model identifier instead of version hash
        model: 'stability-ai/triposr',
        input: {
          image: imageUrl,
          foreground_ratio: 0.85,
          remove_background: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const predictionId = createResponse.data.id;
    console.log('📋 Prediction created:', predictionId);
    
    // Poll for completion
    const maxAttempts = 60;
    const pollInterval = 5000; // 5 seconds
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`
          }
        }
      );
      
      const status = statusResponse.data.status;
      console.log(`📊 Replicate status (${i + 1}/${maxAttempts}): ${status}`);
      
      if (status === 'succeeded') {
        const output = statusResponse.data.output;
        const modelUrl = output?.model || output;
        
        if (modelUrl && typeof modelUrl === 'string') {
          console.log('✅ Model URL received:', modelUrl);
          
          // Download the GLB file
          console.log('📥 Downloading generated model...');
          const modelResponse = await axios.get(modelUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
          });
          
          const modelBuffer = Buffer.from(modelResponse.data);
          console.log('📦 Model size:', modelBuffer.length, 'bytes');
          
          // Upload to our storage
          const modelKey = generateAssetS3Key(ownerUserId, `${name}.glb`);
          const uploadedUrl = await uploadBufferToS3(modelBuffer, modelKey, 'model/gltf-binary');
          
          console.log('✅ Model uploaded to storage:', uploadedUrl);
          return { success: true, modelUrl: uploadedUrl };
        }
      } else if (status === 'failed') {
        throw new Error(`Replicate generation failed: ${statusResponse.data.error}`);
      }
    }
    
    throw new Error('Replicate generation timeout');
    
  } catch (error) {
    console.error('❌ Replicate error details:');
    console.error('  Message:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Generate 3D model using Hugging Face Inference API (Direct REST API)
 * Bypasses the SDK to call the REST API directly for image-to-3D generation
 */
async function generateWithHuggingFace(imageUrl, name, ownerUserId) {
  const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
  
  if (!HF_TOKEN || HF_TOKEN === 'your_token_here') {
    throw new Error('Hugging Face token not configured. Get your token at https://huggingface.co/settings/tokens');
  }
  
  try {
    console.log('🤗 Using Hugging Face Inference API (direct)...');
    console.log('📥 Downloading image:', imageUrl);
    
    // Download the image
    const imageResponse = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    
    console.log('✅ Image downloaded, size:', imageBuffer.length, 'bytes');
    console.log('🔮 Using Hugging Face Inference Endpoints...');
    
    // IMPORTANT: Hugging Face doesn't have a free public image-to-3D API
    // The Inference API and public Spaces for TripoSR are currently unavailable
    // This is a limitation - we need either:
    // 1. Paid Hugging Face Inference Endpoints
    // 2. A working alternative model
    // 3. Use a different service (Meshy/Tripo require payment, Replicate works)
    
    console.warn('⚠️ Hugging Face does not currently offer free public image-to-3D API');
    console.warn('   - TripoSR Inference API: Not available (404)');
    console.warn('   - stabilityai/TripoSR Space: In error (503)');
    console.warn('   - Alternative Spaces: Not found or require payment');
    console.warn('');
    console.warn('💡 Recommendation: Use Replicate API instead (has free tier)');
    
    throw new Error('Hugging Face free image-to-3D API not currently available. Please use Replicate API or upgrade to paid plan on Meshy/Tripo.');
    
  } catch (error) {
    console.error('❌ Hugging Face error:');
    console.error('  Message:', error.message);
    
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Status Text:', error.response.statusText);
      
      // Try to parse error response
      try {
        const errorBuffer = Buffer.from(error.response.data);
        const errorText = errorBuffer.toString('utf8');
        console.error('  Response:', errorText);
        
        // Parse JSON error if possible
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            throw new Error(errorJson.error);
          }
        } catch (e) {
          // Not JSON, use text as-is
        }
      } catch (e) {
        console.error('  Response: [Could not parse]');
      }
    }
    
    throw error;
  }
}

/**
 * POST /api/assets/upload-to-rpm
 * Upload asset to Ready Player Me using API
 * Requires RPM API Key from environment variables
 * 
 * This endpoint downloads the GLB file and uploads it directly to RPM
 * (RPM cannot fetch from localhost URLs)
 */
router.post('/upload-to-rpm', authenticateJWT, async (req, res) => {
  const { name, type, gender, modelUrl, iconUrl } = req.body;
  const ownerUserId = req.user.userId;

  if (!name || !type || !gender || !modelUrl || !iconUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RPM_API_KEY = process.env.RPM_API_KEY;
  const RPM_ORG_ID = process.env.RPM_ORGANIZATION_ID;
  const RPM_APP_ID = process.env.RPM_APPLICATION_ID;

  if (!RPM_API_KEY || !RPM_ORG_ID) {
    return res.status(500).json({ 
      error: 'RPM API credentials not configured. Please add RPM_API_KEY and RPM_ORGANIZATION_ID to .env file' 
    });
  }

  try {
    console.log(`☁️ Uploading asset to RPM: ${name}`);
    console.log(`   Model URL: ${modelUrl}`);
    console.log(`   Icon URL: ${iconUrl}`);

    // Step 1: Download the GLB file from our local server
    let glbBuffer;
    let glbFilename = 'model.glb';
    
    if (modelUrl.startsWith('http://localhost') || modelUrl.startsWith('http://127.0.0.1')) {
      // Local URL - read from file system directly
      console.log('📂 Reading GLB from local filesystem...');
      const urlPath = new URL(modelUrl).pathname;
      const fs = await import('node:fs');
      const localPath = path.join(process.cwd(), urlPath.replace('/avatars/', 'avatars/'));
      
      if (!fs.existsSync(localPath)) {
        throw new Error(`GLB file not found at ${localPath}`);
      }
      
      glbBuffer = fs.readFileSync(localPath);
      glbFilename = path.basename(localPath);
      console.log(`✅ Read ${glbBuffer.length} bytes from ${localPath}`);
      
      // Check file size
      const fileSizeMB = glbBuffer.length / (1024 * 1024);
      console.log(`📦 File size: ${fileSizeMB.toFixed(2)} MB`);
      
      if (fileSizeMB > 10) {
        return res.status(400).json({
          error: 'File too large for RPM',
          details: `GLB file is ${fileSizeMB.toFixed(2)} MB, but RPM accepts max 10 MB`,
          suggestion: 'Try simplifying the 3D model or using RPM Avatar Creator directly',
          localAsset: {
            modelUrl,
            iconUrl,
            name,
            type,
            gender
          }
        });
      }
    } else {
      // Remote URL - download via HTTP
      console.log('📥 Downloading GLB from remote URL...');
      const glbResponse = await axios.get(modelUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      glbBuffer = Buffer.from(glbResponse.data);
      glbFilename = path.basename(new URL(modelUrl).pathname) || 'model.glb';
      console.log(`✅ Downloaded ${glbBuffer.length} bytes`);
    }

    // Step 2: Try uploading to RPM (with proper error handling)
    console.log('📤 Uploading GLB buffer to RPM Asset Manager...');
    
    try {
      const rpmResponse = await uploadAssetToRPM(glbBuffer, {
        name,
        type,
        targetSlot: type, // Map type to targetSlot (outfit, top, bottom, etc.)
        filename: glbFilename,
        contentType: 'model/gltf-binary'
      });

      console.log(`✅ RPM asset created: ${rpmResponse.assetId}`);

      // Step 3: Save to local database
      const localAsset = await Asset.create({
        ownerUserId,
        title: name,
        description: `RPM custom asset: ${type}`,
        source: 'rpm',
        rpmAssetId: rpmResponse.assetId,
        rpmAssetUrl: rpmResponse.assetUrl,
        s3Url: iconUrl,
        thumbnails: [iconUrl],
        status: rpmResponse.status || 'ready',
        metadata: {
          type,
          gender,
          rpmOrganizationId: RPM_ORG_ID,
          rpmApplicationIds: RPM_APP_ID ? [RPM_APP_ID] : [],
          originalModelUrl: modelUrl
        }
      });

      console.log(`✅ Local asset saved: ${localAsset._id}`);

      return res.json({
        success: true,
        rpmAssetId: rpmResponse.assetId,
        rpmAssetUrl: rpmResponse.assetUrl,
        localAssetId: localAsset._id,
        message: 'Asset uploaded to RPM and saved successfully'
      });
      
    } catch (rpmError) {
      // RPM upload failed - save asset locally and provide manual upload instructions
      console.warn('⚠️  RPM upload failed, saving asset locally instead');
      console.warn('Error:', rpmError.message);
      
      const localAsset = await Asset.create({
        ownerUserId,
        title: name,
        description: `3D asset: ${type} (RPM upload failed)`,
        source: 'uploaded', // Use 'uploaded' as fallback since 'local' is not in enum
        s3Url: iconUrl,
        thumbnails: [iconUrl],
        status: 'ready',
        metadata: {
          type,
          gender,
          originalModelUrl: modelUrl,
          rpmUploadError: rpmError.message,
          rpmUploadFailedAt: new Date().toISOString(),
          generatedLocally: true
        }
      });

      console.log(`✅ Asset saved locally: ${localAsset._id}`);

      // Return success with instructions for manual RPM upload
      return res.json({
        success: true,
        localAssetId: localAsset._id,
        modelUrl,
        iconUrl,
        rpmUploadFailed: true,
        message: '✅ Asset saved locally. RPM upload failed - you can:\n\n' +
          '1. Download the GLB file from: ' + modelUrl + '\n' +
          '2. Upload manually to RPM Studio: https://studio.readyplayer.me\n' +
          '3. Or use RPM Avatar Creator to customize your avatar directly\n\n' +
          'Note: The 3D model is available for preview in your wardrobe.',
        error: rpmError.message
      });
    }

  } catch (error) {
    console.error('❌ Upload to RPM error:', error);
    
    // Check if it's an RPM API error
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'RPM API error',
        details: error.response.data,
        message: error.response.data?.message || 'Failed to upload to RPM',
        hint: error.response.data?.code === 'ERROR_LOADING_REMOTE_FILE' 
          ? 'RPM cannot access localhost URLs. The file is being uploaded directly now.'
          : undefined
      });
    }

    return res.status(500).json({ 
      error: 'Failed to upload asset to RPM',
      details: error.message 
    });
  }
});

/**
 * POST /api/assets/generate-virtual-tryon
 * Advanced workflow: User photo + Clothing photo → 3D avatar wearing clothing
 * This combines multiple AI models:
 * 1. Body extraction from user photo
 * 2. Clothing extraction from product photo
 * 3. 3D generation of both
 * 4. Combining them together
 */
router.post('/generate-virtual-tryon', authenticateJWT, async (req, res) => {
  const { userPhotoUrl, clothingUrl, name, type, gender } = req.body;
  const ownerUserId = req.user.userId;

  if (!userPhotoUrl || !clothingUrl || !name || !type || !gender) {
    return res.status(400).json({ error: 'Missing required fields: userPhotoUrl, clothingUrl, name, type, gender' });
  }

  try {
    console.log('🎭 Starting virtual try-on generation...');
    console.log('👤 User photo:', userPhotoUrl);
    console.log('👕 Clothing:', clothingUrl);

    // Step 1: Extract user body/face
    console.log('📸 Step 1: Processing user photo...');
    const userImageResponse = await axios.get(userPhotoUrl, { responseType: 'arraybuffer' });
    const userImageBuffer = Buffer.from(userImageResponse.data);

    // Step 2: Extract clothing from product image
    console.log('👔 Step 2: Processing clothing photo...');
    const clothingImageResponse = await axios.get(clothingUrl, { responseType: 'arraybuffer' });
    const clothingImageBuffer = Buffer.from(clothingImageResponse.data);

    // Step 3: Generate 3D avatar from user photo
    console.log('🎨 Step 3: Generating 3D avatar...');
    let avatarModelUrl = null;
    
    if (process.env.MESHY_API_KEY || process.env.TRIPO_API_KEY) {
      try {
        // Try Meshy first
        if (process.env.MESHY_API_KEY) {
          const avatarResult = await generateWithMeshy(userPhotoUrl, `${name}-avatar`);
          if (avatarResult.success) {
            avatarModelUrl = avatarResult.modelUrl;
            console.log('✅ Avatar generated with Meshy');
          }
        }
        
        // Fallback to Tripo
        if (!avatarModelUrl && process.env.TRIPO_API_KEY) {
          const avatarResult = await generateWithTripo(userPhotoUrl, `${name}-avatar`);
          if (avatarResult.success) {
            avatarModelUrl = avatarResult.modelUrl;
            console.log('✅ Avatar generated with Tripo');
          }
        }
      } catch (error) {
        console.warn('⚠️ Avatar generation failed:', error.message);
      }
    }

    // Step 4: Generate 3D clothing model
    console.log('👕 Step 4: Generating 3D clothing...');
    let clothingModelUrl = null;
    
    if (process.env.MESHY_API_KEY || process.env.TRIPO_API_KEY) {
      try {
        // Try Meshy first
        if (process.env.MESHY_API_KEY) {
          const clothingResult = await generateWithMeshy(clothingUrl, `${name}-clothing`);
          if (clothingResult.success) {
            clothingModelUrl = clothingResult.modelUrl;
            console.log('✅ Clothing generated with Meshy');
          }
        }
        
        // Fallback to Tripo
        if (!clothingModelUrl && process.env.TRIPO_API_KEY) {
          const clothingResult = await generateWithTripo(clothingUrl, `${name}-clothing`);
          if (clothingResult.success) {
            clothingModelUrl = clothingResult.modelUrl;
            console.log('✅ Clothing generated with Tripo');
          }
        }
      } catch (error) {
        console.warn('⚠️ Clothing generation failed:', error.message);
      }
    }

    // Step 5: Create icon from clothing image
    const iconBuffer = await sharp(clothingImageBuffer)
      .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    const iconKey = generateAssetS3Key(ownerUserId, `${name}-icon.png`);
    const iconUrl = await uploadBufferToS3(iconBuffer, iconKey, 'image/png');

    // Step 6: Save to database
    const asset = await Asset.create({
      ownerUserId,
      title: name,
      description: `Virtual try-on: User avatar + ${type}`,
      source: 'uploaded',
      status: avatarModelUrl && clothingModelUrl ? 'pending' : 'pending',
      metadata: {
        type,
        gender,
        userPhotoUrl,
        clothingUrl,
        avatarModelUrl,
        clothingModelUrl,
        workflow: 'virtual-tryon',
        needsCombining: true, // Models need to be combined
        needsManualReview: !avatarModelUrl || !clothingModelUrl
      }
    });

    // Response with results
    const response = {
      success: true,
      assetId: asset._id,
      iconUrl,
      avatarModelUrl,
      clothingModelUrl,
      message: ''
    };

    if (avatarModelUrl && clothingModelUrl) {
      response.message = '✅ Both avatar and clothing generated! Note: They need to be combined manually or use a compositing tool.';
      response.nextSteps = [
        '1. Download both GLB files',
        '2. Use Blender to combine them (overlay clothing on avatar)',
        '3. Export as single GLB',
        '4. Upload combined model to RPM'
      ];
    } else if (avatarModelUrl) {
      response.message = '⚠️ Avatar generated but clothing generation failed. Please generate clothing separately.';
    } else if (clothingModelUrl) {
      response.message = '⚠️ Clothing generated but avatar generation failed. Please generate avatar separately.';
    } else {
      response.success = false;
      response.message = '❌ Both generations failed. Please check API keys and try again.';
    }

    return res.json(response);

  } catch (error) {
    console.error('❌ Virtual try-on error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate virtual try-on',
      details: error.message 
    });
  }
});

export default router;
