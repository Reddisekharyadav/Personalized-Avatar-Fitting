import React, { useState, useEffect, useRef } from 'react';
import { handleModelError, resolveModelUrl, checkGlbAlternative, tryModelWithFallback } from '../utils/modelUtils';

// Enhanced ModelViewer component with automatic GLB fallback for GLTF models
const ModelViewer = ({ modelUrl, alt, poster, fallbackUrl, onLoad, onError, ...props }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentModelUrl, setCurrentModelUrl] = useState(modelUrl);
  const [usedFallback, setUsedFallback] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const viewerRef = useRef(null);
  
  const maxRetries = 2;

  // Check if the current model is GLB or GLTF
  const isGlb = currentModelUrl.toLowerCase().endsWith('.glb');
  const isGltf = currentModelUrl.toLowerCase().endsWith('.gltf') || currentModelUrl.includes('scene.gltf');

  useEffect(() => {
    // Reset state when model URL changes from props
    if (modelUrl !== currentModelUrl) {
      setError(null);
      setLoading(true);
      setCurrentModelUrl(modelUrl);
      setUsedFallback(false);
      setRetryAttempt(0);
    }
  }, [modelUrl]);

  // Attempt to try with GLB alternative if loading fails for GLTF
  useEffect(() => {
    if (error && isGltf && !usedFallback && retryAttempt < maxRetries) {
      const tryGlbAlternative = async () => {
        console.log('ModelViewer: Trying to find GLB alternative for', currentModelUrl);
        try {
          // Try checking for a GLB alternative
          const glbUrl = await checkGlbAlternative(currentModelUrl);
          
          if (glbUrl) {
            console.log('ModelViewer: Found GLB alternative, switching to', glbUrl);
            setCurrentModelUrl(resolveModelUrl(glbUrl));
            setUsedFallback(true);
            setError(null);
            setLoading(true);
            return;
          }
          
          // If no GLB alternative but we have a fallback URL
          if (fallbackUrl) {
            console.log('ModelViewer: No GLB alternative found, trying fallback URL', fallbackUrl);
            setCurrentModelUrl(resolveModelUrl(fallbackUrl));
            setUsedFallback(true);
            setError(null);
            setLoading(true);
            return;
          }
          
          // Increment retry attempt
          setRetryAttempt(prev => prev + 1);
          
          // If we've exhausted retries, we'll stay with the error state
          if (retryAttempt + 1 >= maxRetries) {
            console.log('ModelViewer: Max retries reached, giving up');
          }
        } catch (err) {
          console.error('ModelViewer: Error checking for GLB alternative:', err);
        }
      };
      
      // Add a small delay before trying the alternative
      const timer = setTimeout(() => {
        tryGlbAlternative();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [error, isGltf, usedFallback, currentModelUrl, fallbackUrl, retryAttempt]);

  const handleError = (event) => {
    // Use the utility to handle model loading errors
    console.error('ModelViewer: Error loading model:', event.detail);
    
    const errorInfo = {
      type: event.detail.type || 'unknown',
      message: event.detail.message || 'Failed to load model',
      sourceError: event.detail.sourceError
    };
    
    // Call our error handler utility
    handleModelError(errorInfo, currentModelUrl);
    
    setError(errorInfo);
    setLoading(false);
    
    // Call onError prop if provided
    if (onError) onError(errorInfo);
  };

  const handleLoad = () => {
    console.log('ModelViewer: Model loaded successfully:', currentModelUrl);
    setLoading(false);
    setError(null);
    
    // Call onLoad prop if provided
    if (onLoad) onLoad();
  };

  return (
    <div className="model-viewer-container">
      {loading && <div className="loading-indicator">Loading model...</div>}
      
      {error && (
        <div className="error-message">
          <p>Error loading model: {error.message}</p>
          {isGltf && (
            <p className="conversion-suggestion">
              This model is in GLTF format and may have external dependencies.
              {retryAttempt < maxRetries ? (
                <span> Trying to load GLB alternative...</span>
              ) : (
                <span> Consider converting it to GLB using:
                  <pre>npm run gltf-to-glb -- "{currentModelUrl}" "{currentModelUrl.replace('.gltf', '.glb')}"</pre>
                </span>
              )}
            </p>
          )}
          
          {/* Show fallback option button if available */}
          {fallbackUrl && !usedFallback && (
            <button 
              className="fallback-button"
              onClick={() => {
                setCurrentModelUrl(resolveModelUrl(fallbackUrl));
                setUsedFallback(true);
                setError(null);
                setLoading(true);
              }}
            >
              Try alternative model
            </button>
          )}
        </div>
      )}

      <model-viewer
        ref={viewerRef}
        src={resolveModelUrl(currentModelUrl)}
        alt={alt || "3D model"}
        poster={poster}
        shadow-intensity="1"
        camera-controls
        auto-rotate
        ar
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      >
        <div slot="progress-bar" className="progress-bar">
          <div className="update-bar"></div>
        </div>
        
        {/* Add a small attribution for using GLB fallback if applicable */}
        {usedFallback && (
          <div slot="attribution" className="fallback-attribution">
            Using GLB alternative model
          </div>
        )}
      </model-viewer>
      
      <style jsx>{`
        .model-viewer-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .loading-indicator {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(245, 245, 245, 0.7);
          z-index: 1;
        }
        
        .error-message {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(245, 245, 245, 0.9);
          z-index: 1;
          padding: 20px;
          text-align: center;
        }
        
        .conversion-suggestion {
          margin-top: 10px;
          font-size: 14px;
        }
        
        pre {
          margin-top: 10px;
          padding: 10px;
          background-color: #f0f0f0;
          border-radius: 4px;
          overflow-x: auto;
        }
        
        .fallback-button {
          margin-top: 15px;
          padding: 8px 16px;
          background-color: #4f46e5;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .fallback-attribution {
          background-color: rgba(0, 0, 0, 0.5);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default ModelViewer;

export default ModelViewer;