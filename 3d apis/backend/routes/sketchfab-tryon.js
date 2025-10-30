import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

dotenv.config();
const router = express.Router();

/**
 * POST /api/sketchfab-tryon/extract-clothing
 * Download Sketchfab model (ZIP or GLB), extract GLB, and prepare for try-on
 * Body: { uid: string, avatarUrl: string }
 */
router.post('/extract-clothing', async (req, res) => {
  const { uid, avatarUrl } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'Missing Sketchfab model uid' });
  }

  try {
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) {
      return res.status(500).json({ 
        error: 'SKETCHFAB_API_TOKEN not configured' 
      });
    }

    // Step 1: Check if model is already cached
    const cacheDir = path.join(process.cwd(), 'cache', 'models');
    const filename = `sketchfab-${uid}.glb`;
    const cachePath = path.join(cacheDir, filename);
    
    if (fs.existsSync(cachePath)) {
      console.log(`[Sketchfab Try-On] ✅ Model already cached: ${uid}`);
      
      const host = req.get('host');
      const scheme = req.headers['x-forwarded-proto'] || req.protocol;
      const glbUrl = `${scheme}://${host}/cache/models/${filename}`;
      
      const stats = fs.statSync(cachePath);
      
      return res.json({
        success: true,
        glbUrl: glbUrl,
        size: stats.size,
        uid: uid,
        method: 'cached',
        message: 'Model loaded from cache'
      });
    }

    console.log(`[Sketchfab Try-On] Fetching download URL for model: ${uid}`);

    // Step 2: Get download URL from Sketchfab API
    const downloadUrl = await getSketchfabDownloadUrl(uid, token);
    
    if (!downloadUrl) {
      // Fallback: Return embed URL if download not available
      console.log('[Sketchfab Try-On] No download URL, using embed fallback');
      return res.json({
        success: true,
        embedUrl: `https://sketchfab.com/models/${uid}/embed`,
        method: 'embed',
        message: 'Model is not downloadable, using embed viewer instead'
      });
    }

    console.log(`[Sketchfab Try-On] Download URL obtained: ${downloadUrl}`);

    // Step 3: Download the model (might be ZIP or direct GLB)
    const modelData = await downloadModel(downloadUrl);
    
    console.log(`[Sketchfab Try-On] Model downloaded, size: ${modelData.length} bytes`);

    // Step 4: Extract GLB if it's a ZIP archive
    const glbBuffer = await extractGLBFromData(modelData, uid);

    // Step 5: Save to cache for serving
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, glbBuffer);

    console.log(`[Sketchfab Try-On] GLB cached at: ${cachePath}`);

    // Step 6: Return URL for frontend to load
    const host = req.get('host');
    const scheme = req.headers['x-forwarded-proto'] || req.protocol;
    const glbUrl = `${scheme}://${host}/cache/models/${filename}`;

    return res.json({
      success: true,
      glbUrl: glbUrl,
      size: glbBuffer.length,
      uid: uid,
      method: 'extracted',
      message: 'Model extracted and ready for try-on'
    });

  } catch (err) {
    console.error('[Sketchfab Try-On] Error:', err.message);
    
    // Provide helpful error messages
    let userMessage = 'Failed to process Sketchfab model';
    let statusCode = 500;
    
    if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) {
      userMessage = 'Network error downloading model. Sketchfab may be slow or the model is too large.';
      statusCode = 504; // Gateway timeout
    } else if (err.message.includes('403')) {
      userMessage = 'Model is not downloadable. Please choose a different model.';
      statusCode = 403;
    } else if (err.message.includes('404')) {
      userMessage = 'Model not found. It may have been removed from Sketchfab.';
      statusCode = 404;
    } else if (err.message.includes('download URL')) {
      userMessage = 'Could not get download URL. Model may require authentication or is not downloadable.';
      statusCode = 403;
    }
    
    return res.status(statusCode).json({
      error: userMessage,
      details: err.message,
      suggestion: 'Try selecting a different model or check your internet connection'
    });
  }
});

/**
 * GET /api/sketchfab-tryon/search-clothing
 * Search for clothing models on Sketchfab
 * Query params: q (search term, default: "clothing"), category
 */
router.get('/search-clothing', async (req, res) => {
  try {
    const query = req.query.q || 'clothing shirt pants dress';
    const token = process.env.SKETCHFAB_API_TOKEN;
    
    if (!token) {
      return res.status(500).json({ 
        error: 'SKETCHFAB_API_TOKEN not configured' 
      });
    }

    console.log(`[Sketchfab Try-On] Searching for: ${query}`);

    // Search Sketchfab API for downloadable clothing models
    const searchUrl = 'https://api.sketchfab.com/v3/search';
    const params = {
      type: 'models',
      q: query,
      downloadable: true,
      animated: false, // Prefer static models for clothing
      count: 24, // Get more results
      sort_by: '-likeCount' // Sort by popularity
    };

    const response = await axios.get(searchUrl, {
      params: params,
      headers: {
        'Authorization': `Token ${token}`
      }
    });

    const models = response.data.results.map(model => ({
      uid: model.uid,
      name: model.name,
      thumbnail: model.thumbnails?.images?.[0]?.url || null,
      viewerUrl: `https://sketchfab.com/models/${model.uid}/embed`,
      downloadable: true,
      author: model.user?.displayName || 'Unknown',
      likeCount: model.likeCount || 0
    }));

    return res.json({
      success: true,
      models: models,
      count: models.length,
      query: query
    });

  } catch (err) {
    console.error('[Sketchfab Try-On] Search error:', err.message);
    return res.status(500).json({
      error: 'Failed to search Sketchfab',
      details: err.message
    });
  }
});

// ========== Helper Functions ==========

/**
 * Get download URL from Sketchfab API
 */
async function getSketchfabDownloadUrl(uid, token) {
  try {
    // Try the download endpoint first
    const downloadEndpoint = `https://api.sketchfab.com/v3/models/${uid}/download`;
    const response = await axios.get(downloadEndpoint, {
      headers: {
        'Authorization': `Token ${token}`
      }
    });

    // Look for GLTF/GLB format
    if (response.data.gltf?.url) {
      return response.data.gltf.url;
    }

    // Check other formats
    if (response.data.glb?.url) {
      return response.data.glb.url;
    }

    // Look through formats array
    if (response.data.formats && Array.isArray(response.data.formats)) {
      const glbFormat = response.data.formats.find(f => 
        f.format && /gltf|glb/i.test(f.format)
      );
      if (glbFormat?.url) {
        return glbFormat.url;
      }
    }

    return null;
  } catch (err) {
    console.error('Error getting Sketchfab download URL:', err.message);
    throw new Error(`Failed to get download URL: ${err.message}`);
  }
}

/**
 * Download model data with retry logic
 */
async function downloadModel(url, retries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt}/${retries} for ${url}`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout (Sketchfab can be slow)
        maxContentLength: 100 * 1024 * 1024, // 100MB max
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*'
        }
      });

      console.log(`[Download] Success! Downloaded ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
      
    } catch (err) {
      lastError = err;
      console.error(`[Download] Attempt ${attempt} failed:`, err.message);
      
      // Don't retry on certain errors
      if (err.response && err.response.status === 404) {
        throw new Error('Model not found (404)');
      }
      if (err.response && err.response.status === 403) {
        throw new Error('Access forbidden (403) - Model may not be downloadable');
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[Download] Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`Failed to download model after ${retries} attempts: ${lastError.message}`);
}

/**
 * Extract GLB from data (handles both ZIP archives and direct GLB)
 */
async function extractGLBFromData(buffer, uid) {
  // Check if it's already a GLB (magic bytes: glTF)
  const magic = buffer.slice(0, 4).toString('ascii');
  if (magic === 'glTF') {
    console.log('[Sketchfab Try-On] Data is already GLB format');
    return buffer;
  }

  // Check if it's a ZIP (magic bytes: PK)
  const zipMagic = buffer.slice(0, 2).toString('ascii');
  if (zipMagic !== 'PK') {
    console.log('[Sketchfab Try-On] Unknown format, assuming GLB');
    return buffer;
  }

  console.log('[Sketchfab Try-On] Data is ZIP archive, extracting...');

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    console.log(`[Sketchfab Try-On] ZIP contains ${entries.length} files`);

    // First, look for existing GLB file
    const glbEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.glb'));
    if (glbEntry) {
      console.log(`[Sketchfab Try-On] Found GLB in ZIP: ${glbEntry.entryName} (${glbEntry.header.size} bytes)`);
      const glbData = glbEntry.getData();
      console.log(`[Sketchfab Try-On] ✅ GLB extracted successfully, size: ${glbData.length} bytes`);
      return glbData;
    }

    // If no GLB, look for GLTF and try to pack it
    const gltfEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.gltf'));
    if (gltfEntry) {
      console.log(`[Sketchfab Try-On] Found GLTF in ZIP: ${gltfEntry.entryName}, attempting to pack...`);
      
      const gltfText = gltfEntry.getData().toString('utf8');
      const gltfJson = JSON.parse(gltfText);
      
      console.log('[Sketchfab Try-On] GLTF has:');
      console.log(`  - Buffers: ${gltfJson.buffers?.length || 0}`);
      console.log(`  - Images: ${gltfJson.images?.length || 0}`);
      console.log(`  - Materials: ${gltfJson.materials?.length || 0}`);
      console.log(`  - Textures: ${gltfJson.textures?.length || 0}`);

      // Helper to find files in ZIP by URI (improved to handle all path variations)
      const findEntryByUri = (uri) => {
        if (!uri) return null;
        
        // Try exact match first
        let entry = entries.find(en => en.entryName === uri);
        if (entry) return entry;
        
        // Try with textures/ prefix
        entry = entries.find(en => en.entryName === `textures/${uri}`);
        if (entry) return entry;
        
        // Try basename match
        const base = uri.split('/').pop();
        entry = entries.find(en => en.entryName.split('/').pop() === base);
        if (entry) return entry;
        
        // Try case-insensitive match
        const lowerUri = uri.toLowerCase();
        entry = entries.find(en => en.entryName.toLowerCase() === lowerUri);
        if (entry) return entry;
        
        // List all texture files for debugging
        console.log(`[Sketchfab Try-On] Could not find texture: ${uri}`);
        console.log('[Sketchfab Try-On] Available files in ZIP:');
        entries.forEach(e => {
          if (e.entryName.match(/\.(png|jpg|jpeg|bin)$/i)) {
            console.log(`  - ${e.entryName}`);
          }
        });
        
        return null;
      };

      // Inline buffers as data URIs
      if (Array.isArray(gltfJson.buffers)) {
        for (let i = 0; i < gltfJson.buffers.length; i++) {
          const bufRef = gltfJson.buffers[i];
          if (!bufRef || !bufRef.uri || bufRef.uri.startsWith('data:')) continue;
          
          const entry = findEntryByUri(bufRef.uri);
          if (entry) {
            const data = entry.getData();
            bufRef.uri = `data:application/octet-stream;base64,${data.toString('base64')}`;
            console.log(`[Sketchfab Try-On] ✅ Embedded buffer ${i}: ${entry.entryName} (${data.length} bytes)`);
          } else {
            console.log(`[Sketchfab Try-On] ❌ Missing buffer ${i}: ${bufRef.uri}`);
          }
        }
      }

      // Inline images as data URIs
      if (Array.isArray(gltfJson.images)) {
        for (let i = 0; i < gltfJson.images.length; i++) {
          const imgRef = gltfJson.images[i];
          if (!imgRef || !imgRef.uri || imgRef.uri.startsWith('data:')) continue;
          
          const entry = findEntryByUri(imgRef.uri);
          if (entry) {
            const data = entry.getData();
            const ext = path.extname(entry.entryName).toLowerCase();
            let mime = 'application/octet-stream';
            if (ext === '.png') mime = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
            else if (ext === '.webp') mime = 'image/webp';
            
            imgRef.uri = `data:${mime};base64,${data.toString('base64')}`;
            console.log(`[Sketchfab Try-On] ✅ Embedded texture ${i}: ${entry.entryName} (${data.length} bytes, ${mime})`);
          } else {
            console.log(`[Sketchfab Try-On] ❌ Missing texture ${i}: ${imgRef.uri}`);
          }
        }
      }

      // Use gltf-pipeline to pack to GLB
      try {
        const gltfPipeline = await import('gltf-pipeline');
        const gltfToGlb = gltfPipeline.gltfToGlb || gltfPipeline.default?.gltfToGlb;
        
        if (!gltfToGlb) {
          throw new Error('gltf-pipeline not available');
        }

        const results = await gltfToGlb(gltfJson, { resourceDirectory: '' });
        if (results?.glb) {
          console.log('[Sketchfab Try-On] Successfully packed GLTF to GLB');
          return Buffer.from(results.glb);
        }
      } catch (packErr) {
        console.error('[Sketchfab Try-On] GLTF packing failed:', packErr.message);
        throw packErr;
      }
    }

    throw new Error('No GLB or GLTF file found in ZIP archive');

  } catch (err) {
    console.error('[Sketchfab Try-On] ZIP extraction failed:', err.message);
    throw new Error(`Failed to extract model from ZIP: ${err.message}`);
  }
}

export default router;
