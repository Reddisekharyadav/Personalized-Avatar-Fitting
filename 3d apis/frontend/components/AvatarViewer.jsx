import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { resolveModelUrl, handleModelError } from '../utils/modelUtils';

/**
 * AvatarViewer component for displaying 3D models using Google's <model-viewer> element
 * 
 * @param {Object} props Component props
 * @param {string} props.modelUrl URL to the GLB model file
 * @param {number} props.height Height of the viewer (default: 500px)
 * @param {boolean} props.autoRotate Whether the model should automatically rotate (default: true)
 * @param {string} props.backgroundColor Background color of the viewer (default: transparent)
 * @param {boolean} props.showShadow Whether to show shadow under the model (default: true)
 * @param {string} props.cameraControls Enable camera controls for zoom/pan/orbit (default: true)
 * @param {string} props.environmentImage HDRI environment image for reflections (optional)
 */
const AvatarViewer = ({
  modelUrl,
  height = 500,
  autoRotate = true,
  backgroundColor = 'transparent',
  showShadow = true,
  cameraControls = true,
  environmentImage = 'neutral',
  className = '',
}) => {
  const containerRef = useRef(null);
  const modelViewerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState(null);
  const [resolvedModelUrl, setResolvedModelUrl] = useState('');
  
  // Resolve model URL
  useEffect(() => {
    if (modelUrl) {
      const resolved = resolveModelUrl(modelUrl);
      setResolvedModelUrl(resolved);
      console.log('Resolved model URL:', modelUrl, 'to:', resolved);
    }
  }, [modelUrl]);
  
  // Load the model-viewer web component
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Check if model-viewer is already defined
    if (customElements.get('model-viewer')) {
      setViewerReady(true);
      console.log('model-viewer component already loaded');
      return;
    }
    
    // Load model-viewer script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer@v3.0.2/dist/model-viewer.min.js';
    
    script.onload = () => {
      console.log('model-viewer component loaded');
      setViewerReady(true);
    };
    
    script.onerror = (err) => {
      console.error('Error loading model-viewer:', err);
      setError('Failed to load model-viewer component');
    };
    
    document.head.appendChild(script);
    
    // Cleanup
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);
  
  // Handle model loading events
  useEffect(() => {
    if (!modelViewerRef.current || !viewerReady || !resolvedModelUrl) return;
    
    const viewer = modelViewerRef.current;
    
    const handleLoad = () => {
      console.log('Model loaded successfully:', resolvedModelUrl);
      setError(null);
    };
    
    const handleError = (event) => {
      console.error('Error loading model:', event);
      const errorMessage = event.detail?.sourceError?.message || 'Unknown error';
      setError(`Failed to load model: ${errorMessage}`);
      
      // Use our enhanced error handling utility
      handleModelError(
        { message: errorMessage },
        resolvedModelUrl
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
  }, [resolvedModelUrl, viewerReady]);
  
  // Apply styling to container
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.width = '100%';
      containerRef.current.style.height = `${height}px`;
      containerRef.current.style.position = 'relative';
    }
  }, [height]);
  
  return (
    <div ref={containerRef} className={`avatar-viewer-container ${className}`}>
      {viewerReady ? (
        <model-viewer
          ref={modelViewerRef}
          src={resolvedModelUrl}
          alt="3D Avatar Model"
          auto-rotate={autoRotate}
          camera-controls={cameraControls}
          shadow-intensity={showShadow ? '1' : '0'}
          environment-image={environmentImage}
          exposure="1"
          shadow-softness="1"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor,
          }}
          camera-orbit="0deg 75deg 2m"
          min-camera-orbit="auto auto auto"
          max-camera-orbit="auto auto 100%"
          ar={false}
          loading="eager"
        >
          {/* Loading UI */}
          <div slot="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
            <div>Loading 3D Model...</div>
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
          
          .avatar-viewer-container .progress-bar {
            animation: loading-progress 2s infinite ease-in-out;
          }
        `
      }}></style>
    </div>
  );
};

AvatarViewer.propTypes = {
  modelUrl: PropTypes.string.isRequired,
  height: PropTypes.number,
  autoRotate: PropTypes.bool,
  backgroundColor: PropTypes.string,
  showShadow: PropTypes.bool,
  cameraControls: PropTypes.bool,
  environmentImage: PropTypes.string,
  className: PropTypes.string,
};

export default AvatarViewer;