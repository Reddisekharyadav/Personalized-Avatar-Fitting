import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Hugging Face Image-to-3D Integration
 * Uses FREE state-of-the-art models for converting images to 3D GLB models
 * 
 * Supported Models:
 * 1. Hunyuan3D-2 (Tencent) - State-of-the-art quality
 * 2. TRELLIS (Microsoft) - Fast, MIT licensed
 * 3. TripoSR (Stability AI) - Fast inference
 */

// Get API token from environment
const getHFToken = () => {
  return process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
};

// Hugging Face Inference API endpoints
const HF_MODELS = {
  hunyuan3d: {
    space: 'tencent/Hunyuan3D-2',
    name: 'Hunyuan3D-2',
    provider: 'Tencent',
    description: 'State-of-the-art image-to-3D with high quality textures',
    useGradio: true
  },
  trellis: {
    space: 'microsoft/TRELLIS',
    name: 'TRELLIS',
    provider: 'Microsoft',
    description: 'Fast 3D generation with structured latents',
    useGradio: true
  },
  triposr: {
    space: 'stabilityai/TripoSR',
    name: 'TripoSR',
    provider: 'Stability AI',
    description: 'Fast single-image 3D reconstruction',
    useGradio: true
  }
};

/**
 * Generate 3D model from image using Hugging Face Inference API
 * @param {string|Buffer} imageInput - Image URL or Buffer
 * @param {object} options - Generation options
 * @param {string} options.model - Model to use ('hunyuan3d', 'trellis', 'triposr')
 * @param {number} options.timeout - Request timeout in ms (default: 180000)
 * @returns {Promise<Buffer>} - GLB file buffer
 */
export async function generateImage3D(imageInput, options = {}) {
  const {
    model = 'trellis', // Default to TRELLIS (fast and good quality)
    timeout = 180000, // 3 minutes default
  } = options;

  const HF_API_TOKEN = getHFToken();
  
  if (!HF_API_TOKEN) {
    throw new Error('HUGGINGFACE_API_TOKEN not configured in .env file');
  }

  const modelConfig = HF_MODELS[model];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${model}. Available: ${Object.keys(HF_MODELS).join(', ')}`);
  }

  console.log(`🎨 Generating 3D model using ${modelConfig.name} (${modelConfig.provider})...`);

  try {
    // Check if this model requires Gradio Client
    if (modelConfig.useGradio) {
      console.log(`📡 Using Gradio API for ${modelConfig.name}...`);
      return await generateImage3DGradio(imageInput, options);
    }
    
    // Otherwise use direct Inference API
    let imageBuffer;
    
    if (typeof imageInput === 'string') {
      // Download image from URL
      console.log('📥 Downloading image from URL...');
      const imageResp = await axios.get(imageInput, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      imageBuffer = Buffer.from(imageResp.data);
      console.log(`✅ Image downloaded: ${imageBuffer.length} bytes`);
    } else {
      imageBuffer = imageInput;
    }

    // Use NEW Inference Providers API endpoint (not deprecated api-inference.huggingface.co)
    const inferenceApiUrl = `https://router.huggingface.co/hf-inference/${modelConfig.space}`;
    
    console.log(`🚀 Calling ${modelConfig.name} API...`);
    const response = await axios.post(inferenceApiUrl, imageBuffer, {
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      responseType: 'arraybuffer',
      timeout,
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      maxBodyLength: 100 * 1024 * 1024,
    });

    const glbBuffer = Buffer.from(response.data);
    console.log(`✅ 3D model generated: ${glbBuffer.length} bytes`);
    
    return glbBuffer;

  } catch (error) {
    console.error(`❌ ${modelConfig.name} generation failed:`, error.message);
    
    // Check for specific error types
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 503) {
        throw new Error(`${modelConfig.name} model is currently loading. Please try again in a few minutes.`);
      } else if (status === 429) {
        throw new Error(`Rate limit exceeded for ${modelConfig.name}. Please try again later.`);
      } else if (status === 401) {
        throw new Error('Invalid Hugging Face API token. Please check HUGGINGFACE_API_TOKEN in .env');
      } else {
        throw new Error(`${modelConfig.name} API error (${status}): ${errorData?.error || error.message}`);
      }
    }
    
    throw error;
  }
}

/**
 * Generate 3D model using Gradio API (for Spaces that don't support direct inference)
 * This is a fallback method that calls the Gradio UI endpoint
 */
export async function generateImage3DGradio(imageInput, options = {}) {
  const {
    model = 'trellis',
    timeout = 180000,
  } = options;

  const HF_API_TOKEN = getHFToken();
  
  if (!HF_API_TOKEN) {
    throw new Error('HUGGINGFACE_API_TOKEN not configured in .env file');
  }

  const modelConfig = HF_MODELS[model];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${model}. Available: ${Object.keys(HF_MODELS).join(', ')}`);
  }

  console.log(`🎨 Generating 3D model using ${modelConfig.name} Gradio API...`);

  try {
    // Use @gradio/client for proper Space interaction
    const { Client } = await import('@gradio/client');
    
    // Prepare image data
    let imageBlob;
    if (typeof imageInput === 'string') {
      // For URL, pass directly to Gradio (it can handle URLs)
      imageBlob = imageInput;
      console.log(`📸 Using image URL: ${imageInput}`);
    } else {
      // For Buffer, we need to create a Blob
      imageBlob = new Blob([imageInput], { type: 'image/jpeg' });
      console.log(`📸 Using image buffer: ${imageInput.length} bytes`);
    }

    // Connect to the Gradio Space
    console.log(`🔗 Connecting to ${modelConfig.name} Space...`);
    
    const client = await Client.connect(modelConfig.space, {
      hf_token: HF_API_TOKEN
    });

    console.log(`📤 Submitting image to ${modelConfig.name}...`);
    
    // Try to predict - different spaces may have different API endpoints
    let result;
    try {
      // Try common endpoint names
      result = await client.predict("/image_to_3d", { 
        image: imageBlob
      });
    } catch (err) {
      // Try alternative endpoint
      result = await client.predict(0, { 
        image: imageBlob
      });
    }

    console.log(`✅ ${modelConfig.name} generation complete`);
    
    // The result should contain a URL or file path to the GLB
    if (result && result.data) {
      let glbUrl = null;
      
      // Handle different response formats
      if (typeof result.data === 'string') {
        glbUrl = result.data;
      } else if (Array.isArray(result.data) && result.data.length > 0) {
        glbUrl = result.data[0];
        
        // If it's an object with a url property
        if (typeof glbUrl === 'object' && glbUrl.url) {
          glbUrl = glbUrl.url;
        }
      }
      
      if (!glbUrl) {
        throw new Error('No GLB URL found in response');
      }
      
      // Download the GLB file
      console.log(`📥 Downloading generated GLB from: ${glbUrl}`);
      const glbResp = await axios.get(glbUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      
      return Buffer.from(glbResp.data);
    } else {
      throw new Error('Invalid response format from Gradio');
    }

  } catch (error) {
    console.error(`❌ ${modelConfig.name} Gradio generation failed:`, error.message);
    throw error;
  }
}

/**
 * Try multiple models with fallback
 * @param {string|Buffer} imageInput - Image URL or Buffer
 * @param {object} options - Generation options
 * @returns {Promise<{glbBuffer: Buffer, modelUsed: string}>}
 */
export async function generateImage3DWithFallback(imageInput, options = {}) {
  const modelPriority = options.modelPriority || ['trellis', 'hunyuan3d', 'triposr'];
  
  console.log(`🔄 Trying models in order: ${modelPriority.join(' → ')}`);
  
  for (const model of modelPriority) {
    try {
      console.log(`\n🎯 Attempting ${HF_MODELS[model]?.name || model}...`);
      const glbBuffer = await generateImage3D(imageInput, { ...options, model });
      
      return {
        glbBuffer,
        modelUsed: model,
        modelName: HF_MODELS[model].name,
        provider: HF_MODELS[model].provider
      };
    } catch (error) {
      console.warn(`⚠️ ${model} failed: ${error.message}`);
      
      // If this is the last model in the list, throw the error
      if (model === modelPriority[modelPriority.length - 1]) {
        throw new Error(`All models failed. Last error: ${error.message}`);
      }
      
      // Otherwise, try next model
      console.log(`➡️ Trying next model...`);
      continue;
    }
  }
  
  throw new Error('All 3D generation models failed');
}

/**
 * Get list of available models with their status
 */
export async function getAvailableModels() {
  const models = [];
  
  for (const [key, config] of Object.entries(HF_MODELS)) {
    try {
      // Quick health check (just check if the model exists)
      const url = `https://huggingface.co/api/models/${config.space}`;
      await axios.get(url, { timeout: 5000 });
      
      models.push({
        id: key,
        name: config.name,
        provider: config.provider,
        description: config.description,
        status: 'available'
      });
    } catch (error) {
      models.push({
        id: key,
        name: config.name,
        provider: config.provider,
        description: config.description,
        status: 'unavailable',
        error: error.message
      });
    }
  }
  
  return models;
}

export default {
  generateImage3D,
  generateImage3DGradio,
  generateImage3DWithFallback,
  getAvailableModels,
  HF_MODELS
};
