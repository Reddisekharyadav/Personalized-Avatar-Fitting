import React, { useState, useEffect, useRef } from 'react';
import { isZipArchive, validateModelUrl, checkSketchfabUrlIssues } from '../utils/modelValidator';

// SketchfabModelViewer - Modified to work directly with Sketchfab URLs
const SketchfabModelViewer = ({ modelUrl, alt, poster, fallbackUrl, onLoad, onError, forceEmbed = false, ...props }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(modelUrl);
  const [urlValidation, setUrlValidation] = useState(null);
  const [usingEmbed, setUsingEmbed] = useState(false);
  const viewerRef = useRef(null);
  
  // Validate the URL before attempting to load
  useEffect(() => {
    async function validateModel() {
      if (!modelUrl) {
        setError('No model URL provided');
        setLoading(false);
        return;
      }
      
      try {
        // Check if this is a Sketchfab model and should be embedded
        const isSketchfabUrl = modelUrl.includes('sketchfab.com');
        
        // If forced to embed or is a Sketchfab URL without embed, convert to embed URL
        if (forceEmbed && isSketchfabUrl && !modelUrl.includes('embed')) {
          // Extract the model ID from the URL
          const uidMatch = modelUrl.match(/models\/([^/]+)/);
          if (uidMatch && uidMatch[1]) {
            const embedUrl = `https://sketchfab.com/models/${uidMatch[1]}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`;
            setCurrentUrl(embedUrl);
            setUsingEmbed(true);
            console.log('Forcing embed mode for Sketchfab model:', embedUrl);
            return;
          }
        }
        
        // If already an embed URL, no need to validate
        if (modelUrl.includes('embed') && isSketchfabUrl) {
          setUsingEmbed(true);
          return;
        }
        
        // Check for ZIP archives by fetching the first few bytes
        const response = await fetch(modelUrl, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-3' }, // Only get the first 4 bytes for ZIP signature
        });
        
        if (!response.ok) {
          const warning = checkSketchfabUrlIssues(modelUrl);
          setError(`HTTP error (${response.status}): ${response.statusText}${warning ? '\n' + warning : ''}`);
          
          // If there's a fallback URL, use it
          if (fallbackUrl) {
            setCurrentUrl(fallbackUrl);
            setUsingEmbed(fallbackUrl.includes('embed'));
          }
          return;
        }
        
        const buffer = await response.arrayBuffer();
        
        // Check if this is a ZIP file
        if (isZipArchive(buffer)) {
          console.error('ZIP file detected, cannot load directly:', modelUrl);
          setError('ZIP archive detected. Model formats must be GLB or GLTF. ZIP files must be extracted first.');
          
          // If there's a fallback URL, use it
          if (fallbackUrl) {
            setCurrentUrl(fallbackUrl);
            setUsingEmbed(fallbackUrl.includes('embed'));
          } else if (isSketchfabUrl) {
            // Try to extract Sketchfab ID and use embed as fallback
            const uidMatch = modelUrl.match(/models\/([^/]+)/);
            if (uidMatch && uidMatch[1]) {
              const embedUrl = `https://sketchfab.com/models/${uidMatch[1]}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`;
              setCurrentUrl(embedUrl);
              setUsingEmbed(true);
              console.log('Falling back to embed URL for ZIP archive:', embedUrl);
            }
          }
          return;
        }
        
        // Do full validation
        const validation = await validateModelUrl(modelUrl);
        setUrlValidation(validation);
        
        if (!validation.valid) {
          setError(`Invalid model format: ${validation.reason}`);
          // If there's a fallback URL, use it
          if (fallbackUrl) {
            setCurrentUrl(fallbackUrl);
            setUsingEmbed(fallbackUrl.includes('embed'));
          }
        }
      } catch (err) {
        console.error('Error validating model URL:', err);
        setError(`Error validating model: ${err.message}`);
        
        // If there's a fallback URL, use it
        if (fallbackUrl) {
          setCurrentUrl(fallbackUrl);
          setUsingEmbed(fallbackUrl.includes('embed'));
        }
      }
    }
    
    validateModel();
  }, [modelUrl, fallbackUrl, forceEmbed]);
  
  // Handle model loading error
  const handleModelError = (event) => {
    console.error('Error loading model:', event);
    setError(`Failed to load model: ${event.detail?.error?.message || 'Unknown error'}`);
    setLoading(false);
    
    // If there's a fallback URL and we're not already using it
    if (fallbackUrl && currentUrl !== fallbackUrl) {
      console.log('Trying fallback URL:', fallbackUrl);
      setCurrentUrl(fallbackUrl);
      setUsingEmbed(fallbackUrl.includes('embed'));
    }
    
    if (onError) onError(event);
  };

  // Handle successful model load
  const handleModelLoad = () => {
    console.log('Model loaded successfully:', currentUrl);
    setLoading(false);
    setError(null);
    if (onLoad) onLoad();
  };

  // Reset state when model URL changes from props
  useEffect(() => {
    setLoading(true);
    setError(null);
  }, [modelUrl]);
  
  // If using Sketchfab embed or we've detected we should use embed, render iframe
  const isSketchfabEmbed = currentUrl?.includes('sketchfab.com') && currentUrl?.includes('embed');
  
  if (isSketchfabEmbed) {
    return (
      <div className="sketchfab-viewer-container" style={{ width: '100%', height: '400px', position: 'relative' }}>
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading 3D model...</p>
          </div>
        )}
        <iframe
          title={alt || "Sketchfab Model"}
          src={currentUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          onLoad={handleModelLoad}
          onError={handleModelError}
        />
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }
  
  // Otherwise use model-viewer for direct GLB URLs
  return (
    <div className="model-viewer-container" style={{ width: '100%', height: '400px', position: 'relative' }}>
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading 3D model...</p>
        </div>
      )}
      <model-viewer
        ref={viewerRef}
        src={currentUrl}
        alt={alt || "3D model"}
        poster={poster}
        camera-controls
        auto-rotate
        ar-status="not-presenting"
        {...props}
        onLoad={handleModelLoad}
        onError={handleModelError}
      >
        <div slot="progress-bar" className="progress-bar">
          <div className="update-bar"></div>
        </div>
        <div slot="error" className="error">
          Error loading model. <br />
          {error}
        </div>
      </model-viewer>
      {error && <div className="error-message" style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(255,0,0,0.7)',
          color: 'white',
          padding: '8px',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
        {error}
      </div>}
      
      <style jsx>{`
        .loading-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: rgba(0,0,0,0.1);
          color: #333;
          z-index: 1;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid #f3f3f3;
          border-top: 5px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .error-message {
          position: absolute;
          bottom: 10px;
          left: 10px;
          right: 10px;
          background: rgba(255,0,0,0.7);
          color: white;
          padding: 10px;
          border-radius: 4px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default SketchfabModelViewer;