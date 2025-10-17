/**
 * Utilities for validating and handling 3D model formats
 */

/**
 * Detects if data is a ZIP archive based on its header
 * @param {ArrayBuffer} buffer - The file data buffer
 * @returns {boolean} - True if the buffer appears to be a ZIP file
 */
export const isZipArchive = (buffer) => {
  // Check for the ZIP file signature 'PK\x03\x04'
  if (!buffer || buffer.byteLength < 4) return false;
  
  const header = new Uint8Array(buffer, 0, 4);
  return header[0] === 0x50 && // P
         header[1] === 0x4B && // K
         header[2] === 0x03 && 
         header[3] === 0x04;
};

/**
 * Validates a model URL by checking the file format
 * @param {string} url - The URL to validate
 * @returns {Promise<{valid: boolean, format: string, reason: string}>} - Validation result
 */
export const validateModelUrl = async (url) => {
  if (!url) {
    return { 
      valid: false, 
      format: 'unknown',
      reason: 'No URL provided' 
    };
  }
  
  const lowerUrl = url.toLowerCase();
  
  // Sketchfab embed URLs are always valid
  if (lowerUrl.includes('sketchfab.com/models') && lowerUrl.includes('embed')) {
    return {
      valid: true,
      format: 'sketchfab-embed',
      reason: 'Sketchfab embed URLs are handled directly'
    };
  }
  
  // Check for common supported formats by extension
  if (lowerUrl.endsWith('.glb')) {
    return { 
      valid: true, 
      format: 'glb',
      reason: 'GLB is a valid self-contained format' 
    };
  }
  
  if (lowerUrl.endsWith('.gltf')) {
    return { 
      valid: true, 
      format: 'gltf',
      reason: 'GLTF is a valid format but requires separate texture files' 
    };
  }
  
  // For URLs without clear extensions, try to fetch a HEAD request
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: { 'Accept': 'application/json, model/gltf+json, model/gltf-binary' } 
    });
    
    if (!response.ok) {
      return {
        valid: false,
        format: 'unknown',
        reason: `HTTP error: ${response.status} ${response.statusText}`
      };
    }
    
    const contentType = response.headers.get('content-type');
    
    if (contentType) {
      if (contentType.includes('model/gltf-binary') || 
          contentType.includes('application/octet-stream')) {
        return {
          valid: true,
          format: 'glb',
          reason: 'Content-Type indicates valid binary model format'
        };
      }
      
      if (contentType.includes('model/gltf+json') || 
          contentType.includes('application/json')) {
        return {
          valid: true,
          format: 'gltf',
          reason: 'Content-Type indicates valid JSON model format'
        };
      }
      
      if (contentType.includes('application/zip') ||
          contentType.includes('application/x-zip-compressed')) {
        return {
          valid: false,
          format: 'zip',
          reason: 'ZIP archives must be extracted before use'
        };
      }
    }
    
    // If content-type doesn't help, try to determine from URL structure
    if (url.includes('download') && url.includes('sketchfab')) {
      // This might be a Sketchfab download URL which could be a ZIP
      return {
        valid: false,
        format: 'potential-zip',
        reason: 'This URL may be a Sketchfab archive that needs processing'
      };
    }
    
    // Default case - we're not sure
    return {
      valid: true, // Assume valid but warn
      format: 'unknown',
      reason: 'Format could not be determined from URL or headers'
    };
  } catch (error) {
    return {
      valid: false,
      format: 'error',
      reason: `Error validating URL: ${error.message}`
    };
  }
};

/**
 * Checks for common Sketchfab download issues and provides warnings
 * @param {string} url - The model URL to check
 * @returns {string|null} - Warning message or null if no issues
 */
export const checkSketchfabUrlIssues = (url) => {
  if (!url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  // Check for common Sketchfab URL patterns that cause issues
  if (lowerUrl.includes('sketchfab-prod-media') && 
      lowerUrl.includes('s3.amazonaws.com/archives')) {
    return 'This appears to be a Sketchfab archive URL, which may be a ZIP file that needs to be processed by the server first.';
  }
  
  if (lowerUrl.includes('sketchfab.com/download') || 
      (lowerUrl.includes('sketchfab') && lowerUrl.includes('download'))) {
    return 'This appears to be a Sketchfab download URL. Make sure you\'re using the processed model URL from the backend, not the raw download URL.';
  }
  
  return null;
};