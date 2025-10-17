/**
 * Utility functions for working with 3D models
 */

// axios not required in this utility (removed to satisfy linter)

/**
 * Resolves a model URL to ensure it's properly formatted for use in model-viewer
 * 
 * @param {string} url - The URL to the model file
 * @returns {string} - The resolved URL
 */
// Helper: detect archive/sketchfab urls
const isArchiveOrSketchfab = (u) => {
  if (!u) return false;
  const l = u.toLowerCase();
  return l.endsWith('.zip') || l.includes('/archives/') || l.includes('.zip?') || l.includes('sketchfab.com') || l.includes('static.sketchfab.com');
};

const buildSketchfabEmbed = (u) => {
  const uid = u.match(/models\/([a-zA-Z0-9_-]+)/)?.[1];
  return uid ? `https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1` : null;
};

export const resolveModelUrl = (url) => {
  if (!url) return '';
  // Absolute external URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return getResolvedForAbsoluteUrl(url);
  }

  // Local or relative paths
  // If it's a glTF or GLB file path (local), route to backend model-assets endpoint
  // so dependent resources (scene.bin, textures) are served properly.
  if (isGltfUrl(url) || isGlbUrl(url) || url.startsWith('/')) {
    const filePath = toModelAssetsPath(url);
    const backendBase = 'http://localhost:5000';
    const ts = `t=${Date.now()}`;
    return `${backendBase}${filePath}${filePath.includes('?') ? '&' : '?'}${ts}`;
  }

  // Fallback: ensure leading slash
  if (!url.startsWith('/')) return `/${url}`;
  return url;
};

const getResolvedForAbsoluteUrl = (url) => {
  if (!url) return '';
  if (url.includes('localhost:5000') || url.includes(window.location.origin)) return url;
  const lower = url.toLowerCase().split('?')[0];
  // For Sketchfab/archive URLs, prefer routing through the binary proxy so the server
  // can attempt in-memory extraction or packing. This avoids the frontend trying to parse
  // ZIPs as GLTF and enables Try On when the server can provide a GLB.
  if (isArchiveOrSketchfab(lower)) {
    // If it appears to be a direct ZIP download, send to binary proxy which will
    // extract/pack if possible. The proxy will return a GLB when available.
    return `http://localhost:5000/api/proxy?url=${encodeURIComponent(url)}`;
  }
  if (isGltfUrl(lower)) return `http://localhost:5000/api/proxy/resource?url=${encodeURIComponent(url)}`;
  if (isGlbUrl(lower)) return `http://localhost:5000/api/proxy?url=${encodeURIComponent(url)}`;
  return url;
};
const isGltfUrl = (u) => u && (u.toLowerCase().endsWith('.gltf') || u.includes('scene.gltf'));
const isGlbUrl = (u) => u && u.toLowerCase().endsWith('.glb');
const toModelAssetsPath = (p) => {
  const basePath = p.startsWith('/') ? p : `/${p}`;
  const cleanPath = basePath.split('?')[0];
  return cleanPath.startsWith('/model-assets') ? cleanPath : `/model-assets${cleanPath}`;
};

/**
 * Checks if a file is a valid 3D model format
 * 
 * @param {string} url - The URL to check
 * @returns {boolean} - Whether the URL is a valid model format
 */
export const isValidModelFormat = (url) => {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith('.glb') || lowerUrl.endsWith('.gltf');
};

/**
 * Gets the proper environment image for a model based on its type
 * 
 * @param {string} modelType - The type of model (avatar, outfit, etc.)
 * @returns {string} - The environment image to use
 */
export const getEnvironmentImage = (modelType = 'neutral') => {
  const environmentMap = {
    avatar: 'neutral',
    outfit: 'neutral',
    product: 'legacy',
    scene: 'sunset',
    neutral: 'neutral',
    legacy: 'legacy',
    sunset: 'sunset',
  };
  
  return environmentMap[modelType] || 'neutral';
};

/**
 * Checks if a GLB alternative exists for a GLTF file
 * 
 * @param {string} gltfUrl - The URL of the GLTF file
 * @returns {Promise<string|null>} - The GLB URL if it exists, null otherwise
 */
export const checkGlbAlternative = async (gltfUrl) => {
  if (!gltfUrl || !gltfUrl.toLowerCase().endsWith('.gltf')) {
    return null;
  }
  
  try {
    // Generate GLB URL by replacing .gltf with .glb
    const glbUrl = gltfUrl.replace(/\.gltf$/i, '.glb');
    console.log(`Checking for GLB alternative: ${glbUrl}`);
    
    // Check if the GLB file exists
    const response = await fetch(glbUrl, { method: 'HEAD' });
    
    if (response.ok) {
      console.log(`GLB alternative found: ${glbUrl}`);
      return glbUrl;
    } else {
      console.log(`GLB alternative not found (${response.status}): ${glbUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`Error checking for GLB alternative: ${error.message}`);
    return null;
  }
};

/**
 * Tries to load a model with fallback to GLB if GLTF fails
 * 
 * @param {string} modelUrl - The URL of the model to load
 * @param {Function} onSuccess - Callback with successful URL
 * @param {Function} onError - Callback if all attempts fail
 */
export const tryModelWithFallback = async (modelUrl, onSuccess, onError) => {
  if (!modelUrl) {
    if (onError) onError(new Error('No model URL provided'));
    return;
  }
  try {
    const originalUrl = resolveModelUrl(modelUrl);
    if (modelUrl.toLowerCase().endsWith('.gltf')) {
      const handled = await tryGltfFallback(originalUrl, modelUrl, onSuccess);
      if (handled) return;
    }
    if (onSuccess) onSuccess(originalUrl);
  } catch (error) {
    console.error(`Error in tryModelWithFallback: ${error.message}`);
    if (onError) onError(error);
  }
};

const tryGltfFallback = async (resolvedOriginalUrl, originalModelUrl, onSuccess) => {
  try {
    // Try fetching the original first
    try {
      const originalResponse = await fetch(resolvedOriginalUrl);
      if (originalResponse.ok) {
        if (onSuccess) onSuccess(resolvedOriginalUrl);
        return true;
      }
    } catch (origErr) {
      console.warn('Original GLTF fetch failed:', origErr && origErr.message);
    }

    // Check for GLB alternative
    const glbUrl = await checkGlbAlternative(originalModelUrl);
    if (glbUrl) {
      const resolvedGlbUrl = resolveModelUrl(glbUrl);
      if (onSuccess) onSuccess(resolvedGlbUrl);
      return true;
    }
  } catch (err) {
    console.error('Error in tryGltfFallback:', err && err.message);
  }
  return false;
};

/**
 * Handles errors that occur during model loading
 * @param {Error} error - The error object
 * @param {string} modelUrl - The URL of the model that failed to load
 */
export const handleModelError = (error, modelUrl) => {
  console.error(`Error loading model from ${modelUrl}:`, error);
  
  // Check for common texture loading errors
  if (error.message && error.message.includes("Couldn't load texture")) {
    console.warn('Texture loading error detected. This may be caused by missing texture files.');
    console.warn('Model textures should be available in the "textures" directory.');
    
    // Extract texture path from error message
    const textureMatch = error.message.match(/Couldn't load texture (.*)/);
    if (textureMatch && textureMatch[1]) {
      const texturePath = textureMatch[1];
      console.warn(`Failed to load texture: ${texturePath}`);
      
      // Try to provide helpful debugging info
      if (texturePath.includes('textures/')) {
        console.warn(`Make sure the texture exists at: ${texturePath}`);
        console.warn('The server should be serving textures from /textures endpoint');
      }
    }
  }
  
  // Check for bin file loading errors
  if (error.message && error.message.includes("Failed to load buffer 'scene.bin'")) {
    console.warn('Buffer loading error detected. This may be caused by missing scene.bin file.');
    console.warn('The scene.bin file should be available at the root URL: /scene.bin');
  }
};