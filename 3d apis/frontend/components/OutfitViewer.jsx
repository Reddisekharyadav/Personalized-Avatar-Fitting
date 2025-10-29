import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { resolveModelUrl, handleModelError } from '../utils/modelUtils';

/**
 * OutfitViewer component for displaying avatars and outfits using Google's <model-viewer> element
 * 
 * @param {Object} props Component props
 * @param {string} props.avatarUrl URL to the base avatar GLB model file
 * @param {string} props.outfitUrl URL to the outfit GLB model file (optional)
 * @param {number} props.height Height of the viewer (default: 500px)
 * @param {boolean} props.autoRotate Whether the model should automatically rotate (default: true)
 * @param {string} props.backgroundColor Background color of the viewer (default: transparent)
 * @param {number} props.scale Scale factor for the model (default: 1)
 * @param {number} props.offsetY Vertical offset for the model (default: 0)
 */
const OutfitViewer = ({
  avatarUrl,
  outfitUrl = null,
  height = 500,
  autoRotate = true,
  backgroundColor = 'transparent',
  className = '',
  scale = 1,
  offsetY = 0,
}) => {
  const containerRef = useRef(null);
  const modelViewerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState(null);
  const [activeModel, setActiveModel] = useState(resolveModelUrl(avatarUrl));
  
  // Load the model-viewer web component
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Log attempt to load model-viewer
    console.log('Attempting to load model-viewer component...');
    
    // Add debugging info to the parent page's debug panel
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += '<br>Attempting to load model-viewer component...';
    }
    
    // Check if model-viewer is already defined
    if (customElements.get('model-viewer')) {
      setViewerReady(true);
      console.log('model-viewer component already loaded');
      
      if (debugDiv) {
        debugDiv.innerHTML += '<br>model-viewer component already loaded';
      }
      return;
    }
    
    // Load model-viewer script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer@v3.0.2/dist/model-viewer.min.js';
    script.async = false; // Force synchronous loading for reliability
    
    script.onload = () => {
      console.log('model-viewer component loaded');
      setViewerReady(true);
      
      // Add debugging info to the parent page's debug panel
      if (debugDiv) {
        debugDiv.innerHTML += '<br>model-viewer component loaded successfully';
      }
      
      // Force a re-render
      const tmpModel = activeModel;
      setActiveModel('');
      setTimeout(() => setActiveModel(tmpModel), 50);
    };
    
    script.onerror = (err) => {
      console.error('Error loading model-viewer:', err);
      setError('Failed to load model-viewer component');
      
      // Add debugging info to the parent page's debug panel
      if (debugDiv) {
        debugDiv.innerHTML += '<br>Error loading model-viewer component';
      }
    };
    
    // Add the script to the document
    document.head.appendChild(script);
    
    // Cleanup
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [activeModel]);
  
  // Handle model changes
  useEffect(() => {
    // If we have an outfit, use it, otherwise use the avatar
    // Always resolve the URLs to ensure proper loading
    if (outfitUrl) {
      setActiveModel(resolveModelUrl(outfitUrl));
    } else if (avatarUrl) {
      setActiveModel(resolveModelUrl(avatarUrl));
      
      // Add debugging info to the parent page's debug panel
      const debugDiv = document.getElementById('debug-info');
      if (debugDiv) {
        debugDiv.innerHTML += `<br>Using avatar as active model: ${resolveModelUrl(avatarUrl)}`;
      }
    }
  }, [avatarUrl, outfitUrl]);
  
  // Handle model loading events
  useEffect(() => {
    if (!modelViewerRef.current || !viewerReady) return;
    
    const viewer = modelViewerRef.current;
    
    const handleLoad = () => {
      console.log('Model loaded successfully:', activeModel);
      setError(null);
      
      // Add debugging info to the parent page's debug panel
      const debugDiv = document.getElementById('debug-info');
      if (debugDiv) {
        debugDiv.innerHTML += `<br>Model loaded successfully: ${activeModel}`;
      }
    };
    
    const handleError = (event) => {
      console.error('Error loading model:', event);
      const errorMessage = event.detail?.sourceError?.message || 'Unknown error';
      setError(`Failed to load model: ${errorMessage}`);
      
      // Add debugging info to the parent page's debug panel
      const debugDiv = document.getElementById('debug-info');
      if (debugDiv) {
        debugDiv.innerHTML += `<br>Error loading model: ${errorMessage}`;
      }
      
      // Use our enhanced error handling utility
      handleModelError(
        { message: errorMessage },
        activeModel
      );
    };
    
    // Add event listeners
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    
    // Cleanup
    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [activeModel, viewerReady]);
  
  // Apply styling to container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.width = '100%';
      containerRef.current.style.height = `${height}px`;
      containerRef.current.style.position = 'relative';
    }
    
    // Add debugging info to the parent page's debug panel
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += `<br>OutfitViewer mounted. Avatar URL: ${avatarUrl ? 'Set' : 'Not set'}, Outfit URL: ${outfitUrl ? 'Set' : 'Not set'}`;
    }
  }, [height, avatarUrl, outfitUrl]);

  // Additional effect to ensure model-viewer is visible
  useEffect(() => {
    if (!viewerReady || !activeModel) return;
    
    console.log('Ensuring model-viewer visibility...');
    
    // Add special styling to ensure model-viewer is visible
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      model-viewer {
        width: 100% !important;
        height: 100% !important;
        min-height: 400px !important;
        z-index: 5 !important; 
        display: block !important;
        visibility: visible !important;
        background-color: #f8f9fa !important;
        position: relative !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Add debugging info
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
      debugDiv.innerHTML += `<br>Enhanced model-viewer visibility`;
    }
    
    // Add a small delay and force layout recalculation
    setTimeout(() => {
      if (modelViewerRef.current) {
        modelViewerRef.current.style.display = 'block';
        modelViewerRef.current.style.visibility = 'visible';
        
        // Force browser to recalculate layout
        if (containerRef.current) {
          containerRef.current.style.display = 'none';
          void containerRef.current.offsetHeight; // Force reflow
          containerRef.current.style.display = 'block';
        }
      }
    }, 100);
    
    return () => {
      if (document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, [viewerReady, activeModel]);
  
  return (
    <div ref={containerRef} className={`outfit-viewer-container ${className}`} style={{ position: 'relative', zIndex: 1 }}>
      {viewerReady ? (
        <model-viewer
          ref={modelViewerRef}
          src={activeModel}
          alt="3D Avatar Model"
          auto-rotate={autoRotate}
          camera-controls
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1"
          shadow-softness="1"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor,
            transform: `scale(${scale}) translateY(${offsetY}px)`,
            display: 'block',
            visibility: 'visible',
            zIndex: 5,
            position: 'relative',
            minHeight: '400px',
            border: '1px solid #eee',
            borderRadius: '8px'
          }}
          camera-orbit="0deg 75deg 2m"
          min-camera-orbit="auto auto auto"
          max-camera-orbit="auto auto 100%"
          ar={false}
          loading="eager"
        >
          {/* Loading UI */}
          <div slot="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
            <div>Loading {outfitUrl ? 'Outfit' : 'Avatar'} Model...</div>
            <div style={{ width: '80%', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
              <div className="progress-bar" style={{ width: '100%', height: '100%', backgroundColor: '#4285F4', animation: 'loading-progress 2s infinite ease-in-out' }}></div>
            </div>
          </div>
          
          {/* Error UI */}
          {error && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '20px',
                textAlign: 'center',
                zIndex: 10,
              }}
            >
              <div>
                <h3>Error Loading Model</h3>
                <p>{error}</p>
                <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
                  Check browser console for detailed error information.
                </p>
              </div>
            </div>
          )}
        </model-viewer>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: backgroundColor === 'transparent' ? '#f5f5f5' : backgroundColor,
            color: '#888',
          }}
        >
          Loading viewer...
        </div>
      )}
      
      {/* Add CSS styles using regular style tag */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes loading-progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          
          .outfit-viewer-container .progress-bar {
            animation: loading-progress 2s infinite ease-in-out;
          }
          
          model-viewer {
            width: 100% !important;
            height: 100% !important;
            z-index: 5 !important; 
            display: block !important;
            visibility: visible !important;
          }
        `
      }}></style>
    </div>
  );
};

OutfitViewer.propTypes = {
  avatarUrl: PropTypes.string.isRequired,
  outfitUrl: PropTypes.string,
  height: PropTypes.number,
  autoRotate: PropTypes.bool,
  backgroundColor: PropTypes.string,
  className: PropTypes.string,
  scale: PropTypes.number,
  offsetY: PropTypes.number
};

export default OutfitViewer;