import axios from 'axios';
import FormData from 'form-data';

/**
 * Ready Player Me (RPM) Integration Helper
 * Requirement D: RPM web integration utilities
 * 
 * This module provides helpers for:
 * - Parsing RPM iframe messages
 * - Uploading assets to RPM Asset Manager API
 * 
 * TODO: Configure RPM_API_KEY and RPM_ASSET_UPLOAD_ENDPOINT in .env
 * Developer must register at https://readyplayer.me to obtain API key
 */

const RPM_API_KEY = process.env.RPM_API_KEY;
const RPM_ASSET_UPLOAD_ENDPOINT = process.env.RPM_ASSET_UPLOAD_ENDPOINT || 'https://api.readyplayer.me/v1/assets';

/**
 * Parse RPM iframe message event
 * Expected format (per RPM docs):
 * {
 *   source: "readyplayerme",
 *   type: "avatar-exported",
 *   data: {
 *     url: "https://models.readyplayer.me/xxxxx.glb",
 *     id: "abc123",
 *     isGenderNeutral: false,
 *     bodyType: "fit",
 *     skinTone: "dark",
 *     hairColor: "#000000",
 *     metadata: {}
 *   }
 * }
 * 
 * @param {MessageEvent} event - postMessage event from RPM iframe
 * @returns {object|null} - parsed avatar data or null
 */
export function parseRPMMessage(event) {
  try {
    const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    
    if (message.source === 'readyplayerme' && message.type === 'avatar-exported') {
      return {
        avatarId: message.data.id,
        rpmUrl: message.data.url,
        bodyType: message.data.bodyType,
        gender: message.data.isGenderNeutral ? 'neutral' : (message.data.gender || 'unknown'),
        skinTone: message.data.skinTone,
        hairColor: message.data.hairColor,
        metadata: message.data.metadata || {}
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to parse RPM message:', error);
    return null;
  }
}

/**
 * Upload asset to RPM Asset Manager API
 * Requirement G: RPM asset creation with retry logic
 * 
 * NOTE: RPM Asset Manager API has specific requirements:
 * - Files must be < 10 MB
 * - Valid API key with asset management permissions
 * - Proper organization/application IDs
 * 
 * @param {Buffer|ReadableStream} fileData - asset file (GLB or texture pack zip)
 * @param {object} metadata - asset metadata
 * @param {string} metadata.name - asset name
 * @param {string} metadata.type - asset type (e.g., "clothing", "texture", "outfit", "top", "bottom")
 * @param {string} metadata.targetSlot - target slot (e.g., "top", "bottom", "outfit")
 * @param {string} metadata.filename - filename (e.g., "model.glb")
 * @param {string} metadata.contentType - MIME type (e.g., "model/gltf-binary")
 * @param {number} retries - retry attempts (default 3)
 * @returns {Promise<object>} - RPM response with assetId and assetUrl
 */
export async function uploadAssetToRPM(fileData, metadata, retries = 3) {
  if (!RPM_API_KEY) {
    console.warn('RPM_API_KEY not configured. Returning mock asset response.');
    // Fallback for development/testing (Requirement Q)
    return {
      assetId: `mock-asset-${Date.now()}`,
      assetUrl: 'https://mock-rpm-asset.example.com/asset.glb',
      status: 'ready'
    };
  }

  // Check file size (RPM has a 10 MB limit for direct uploads)
  const fileSizeBytes = Buffer.isBuffer(fileData) ? fileData.length : 0;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  
  if (fileSizeMB > 10) {
    console.error(`File too large for RPM direct upload: ${fileSizeMB.toFixed(2)} MB (max 10 MB)`);
    throw new Error(`File size ${fileSizeMB.toFixed(2)} MB exceeds RPM limit of 10 MB. Consider optimizing the GLB file.`);
  }

  console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);

  const formData = new FormData();
  
  // Append the file with proper metadata
  formData.append('file', fileData, {
    filename: metadata.filename || 'asset.glb',
    contentType: metadata.contentType || 'model/gltf-binary'
  });
  
  // Append metadata fields
  formData.append('name', metadata.name);
  formData.append('type', metadata.type || 'outfit');
  
  if (metadata.targetSlot) {
    formData.append('targetSlot', metadata.targetSlot);
  }

  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Uploading asset to RPM (attempt ${attempt + 1}/${retries})...`);
      console.log(`  Endpoint: ${RPM_ASSET_UPLOAD_ENDPOINT}`);
      console.log(`  File size: ${fileSizeBytes} bytes (${fileSizeMB.toFixed(2)} MB)`);
      console.log(`  Name: ${metadata.name}`);
      console.log(`  Type: ${metadata.type}`);
      console.log(`  TargetSlot: ${metadata.targetSlot || 'none'}`);
      console.log(`  Auth: Bearer ${RPM_API_KEY.substring(0, 15)}...`);
      
      const response = await axios.post(RPM_ASSET_UPLOAD_ENDPOINT, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${RPM_API_KEY}`
        },
        timeout: 120000, // 120 seconds (2 minutes) for large files
        maxContentLength: 50 * 1024 * 1024, // 50 MB
        maxBodyLength: 50 * 1024 * 1024 // 50 MB
      });

      console.log('✅ RPM upload successful!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      return {
        assetId: response.data.id || response.data.assetId || response.data.data?.id,
        assetUrl: response.data.url || response.data.assetUrl || response.data.data?.url,
        status: response.data.status || response.data.data?.status || 'ready'
      };
    } catch (error) {
      lastError = error;
      
      // Log detailed error information
      if (error.response) {
        console.error(`❌ RPM API error (${error.response.status}):`, error.response.data);
        console.error('Response headers:', error.response.headers);
        
        // Don't retry on 401 Unauthorized - API key issue
        if (error.response.status === 401) {
          console.error('⚠️  API key appears invalid or lacks permissions.');
          console.error('   Check that RPM_API_KEY has Asset Manager permissions.');
          throw new Error('RPM API authentication failed. Please verify your API key has asset management permissions.');
        }
        
        // Don't retry on 400 Bad Request - invalid data
        if (error.response.status === 400) {
          console.error('⚠️  Invalid request data.');
          throw new Error(`RPM API rejected the request: ${error.response.data?.message || 'Bad Request'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error(`❌ RPM upload timeout after 120 seconds`);
      } else {
        console.error(`❌ RPM upload error:`, error.message);
      }
      
      // Handle rate limiting (429) - exponential backoff (Requirement I)
      if (error.response?.status === 429) {
        const retryAfter = Number.parseInt(error.response.headers['retry-after'] || '5', 10);
        console.warn(`RPM rate limit hit. Waiting ${retryAfter}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else if (attempt < retries - 1) {
        // Exponential backoff for other errors (except auth errors)
        if (error.response?.status !== 401 && error.response?.status !== 400) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Don't retry auth/validation errors
          break;
        }
      }
    }
  }

  throw new Error(`RPM asset upload failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fetch RPM avatar GLB from URL
 * @param {string} rpmUrl - RPM avatar URL
 * @returns {Promise<Buffer>} - GLB file buffer
 */
export async function fetchRPMAvatarGLB(rpmUrl) {
  try {
    console.log(`Fetching RPM avatar GLB: ${rpmUrl}`);
    const response = await axios.get(rpmUrl, {
      responseType: 'arraybuffer',
      timeout: 30000 // 30 seconds
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Failed to fetch RPM avatar GLB:', error.message);
    throw new Error(`Failed to fetch RPM avatar: ${error.message}`);
  }
}

export default {
  parseRPMMessage,
  uploadAssetToRPM,
  fetchRPMAvatarGLB
};
