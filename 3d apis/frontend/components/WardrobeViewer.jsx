import { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { resolveModelUrl } from '../utils/modelUtils';

/**
 * WardrobeViewer component for displaying avatars and outfits using model-viewer
 * Supports setting offset and scale for outfits
 */
const WardrobeViewer = ({ 
  avatarUrl, 
  outfitUrl = null, 
  outfitOffsetY = 0, 
  outfitScale = 1,
  width = '100%',
  height = 420
}) => {
  // Add retry mechanism for model loading
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const avatarViewerRef = useRef(null);
  const outfitViewerRef = useRef(null);
  const containerRef = useRef(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  // Retry loading the model after an error
  const retryModelLoad = () => {
    if (retryCount < maxRetries) {
      console.log(`Retrying model load, attempt ${retryCount + 1} of ${maxRetries}`);
      setRetryCount(prev => prev + 1);
      
      // Force reload by adding a timestamp to the URL
      if (avatarViewerRef.current) {
        const timestamp = Date.now();
        const currentSrc = avatarViewerRef.current.getAttribute('src');
        const newSrc = currentSrc.includes('?') 
          ? currentSrc.replace(/[?&]t=\d+/, '') + `&t=${timestamp}`
          : currentSrc + `?t=${timestamp}`;
        
        avatarViewerRef.current.setAttribute('src', newSrc);
        
        // Show debug message
        const debugEl = document.getElementById('model-debug-info');
        if (debugEl) {
          debugEl.style.display = 'block';
          debugEl.innerHTML += `<br>Retrying model load (${retryCount + 1}/${maxRetries}):<br>URL: ${newSrc}`;
        }
      }
    } else {
      console.error(`Max retries (${maxRetries}) reached for model loading`);
      
      // Show final error message
      const debugEl = document.getElementById('model-debug-info');
      if (debugEl) {
        debugEl.style.display = 'block';
        debugEl.innerHTML += `<br><span style="color:red">Failed after ${maxRetries} attempts. Please try refreshing the page or contact support.</span>`;
      }
    }
  };

  // Use the shared resolver so behavior matches the rest of the app
  // (maps /public or /model-assets paths to backend proxy, routes Sketchfab to proxy)
  // If you need additional containerRef-based side-effects (like data-model-id),
  // we can add those after resolution.

  // Load the model-viewer component dynamically on client side
  useEffect(() => {
    if (globalThis.window !== undefined) {
      // Add debug element
      if (!document.getElementById('model-debug-info')) {
        const debugEl = document.createElement('div');
        debugEl.id = 'model-debug-info';
        debugEl.style.cssText = 'position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 8px; font-size: 12px; z-index: 9999; max-width: 80%; max-height: 30%; overflow: auto; display: none; border-radius: 4px;';
        document.body.appendChild(debugEl);
        debugEl.innerHTML = 'Model loading debug info:<br>';
      }
      
      // Check if model-viewer is already defined - CRITICAL CHECK
      if (customElements.get('model-viewer')) {
        setViewerReady(true);
        console.log('✅ model-viewer component already loaded');
        return;
      }
      
      // Try to load the model-viewer ONLY if not already loaded
      const loadModelViewer = async () => {
        // Double-check before attempting to load
        if (customElements.get('model-viewer')) {
          setViewerReady(true);
          return;
        }
        
        try {
          // First attempt: Try dynamic import (preferred)
          await import('@google/model-viewer');
          setViewerReady(true);
          console.log('✅ model-viewer component loaded via import');
        } catch (err) {
          console.warn('⚠️ Failed to load model-viewer via import, trying CDN:', err);
          
          // Check again before CDN fallback
          if (customElements.get('model-viewer')) {
            setViewerReady(true);
            return;
          }
          
          // Show debug info
          const debugEl = document.getElementById('model-debug-info');
          if (debugEl) {
            debugEl.style.display = 'block';
            debugEl.innerHTML += `<br>Failed to load model-viewer component: ${err.message}<br>Trying CDN fallback...`;
          }
          
          // Fallback: Load from CDN - check if script already exists
          const existingScript = document.querySelector('script[src*="model-viewer"]');
          if (existingScript) {
            console.log('⚠️ model-viewer script already in DOM, waiting...');
            setViewerReady(true);
            return;
          }
          
          const script = document.createElement('script');
          script.type = 'module';
          script.src = 'https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js';
          
          script.onload = () => {
            setViewerReady(true);
            console.log('✅ model-viewer component loaded from CDN');
          };
          
          script.onerror = (cdnErr) => {
            console.error('❌ Failed to load model-viewer from CDN:', cdnErr);
          };
          
          document.head.appendChild(script);
        }
      };
      
      loadModelViewer();
      
      // Pre-cache model dependencies for better loading experience if we have an avatar URL
      if (avatarUrl) {
        const modelId = avatarUrl.split('/').pop().replace(/\.(glb|gltf)$/, '');
        
        // Call our API to resolve dependencies
        fetch(`http://localhost:5000/api/model/resolve-dependencies?modelId=${modelId}`)
          .then(res => res.json())
          .then(data => {
            console.log('Model dependencies resolved:', data);
            
            // Pre-cache scene.bin if available
            if (data.dependencies?.binFile) {
              const preloadBin = document.createElement('link');
              preloadBin.rel = 'preload';
              preloadBin.as = 'fetch';
              preloadBin.href = `http://localhost:5000/model-assets/scene.bin?t=${Date.now()}`;
              document.head.appendChild(preloadBin);
            }
            
            // Pre-cache textures if available
            if (data.dependencies?.textures?.length) {
              data.dependencies.textures.forEach(texture => {
                const preloadTexture = document.createElement('link');
                preloadTexture.rel = 'preload';
                preloadTexture.as = 'image';
                preloadTexture.href = `http://localhost:5000/model-assets/textures/${texture.name}?t=${Date.now()}`;
                document.head.appendChild(preloadTexture);
              });
            }
          })
          .catch(err => {
            console.error('Error resolving model dependencies:', err);
          });
      }
    }
  }, [avatarUrl]);

  // Handle model loading events
  useEffect(() => {
    if (!avatarViewerRef.current || !viewerReady) return;

    const handleModelLoad = () => {
      console.log('Avatar model loaded successfully');
      setModelLoaded(true);
      
      // Hide debug info on successful load
      if (typeof document !== 'undefined') {
        const debugEl = document.getElementById('model-debug-info');
        if (debugEl) debugEl.style.display = 'none';
      }
    };

    const appendDebugInfo = async (debugEl, resolvedUrl) => {
      debugEl.innerHTML += `<br>URL: ${resolvedUrl}`;
      try {
        const response = await fetch(resolvedUrl);
        if (!response.ok) debugEl.innerHTML += `<br>URL check: ${response.status} ${response.statusText}`;
        else debugEl.innerHTML += `<br>URL check: OK (${response.status})`;
      } catch (err) {
        debugEl.innerHTML += `<br>URL check failed: ${err.message}`;
      }
    };

    const renderSourceError = (debugEl, sourceError) => {
      if (!sourceError) return;
      debugEl.innerHTML += `<br>Source error: ${sourceError.message || 'Unknown'}`;
    };

    const renderSuggestions = (debugEl, message) => {
      if (!message) return;
      if (message.includes('scene.bin')) {
        debugEl.innerHTML += `<br><span style="color:green">Possible fix: Server might need to be restarted</span>`;
      } else if (message.includes('texture')) {
        debugEl.innerHTML += `<br><span style="color:green">Possible fix: Texture file not found, check texture paths</span>`;
      } else if (message.includes('Failed to fetch')) {
        debugEl.innerHTML += `<br><span style="color:green">Possible fix: Network error - check if server is running and URL is accessible</span>`;
      }
    };

    const handleError = (event) => {
      console.error('Error loading model:', event.detail);

      // Show debug info on error to help troubleshoot
      if (typeof document !== 'undefined') {
        const debugEl = document.getElementById('model-debug-info');
        if (debugEl) {
          debugEl.style.display = 'block';
          debugEl.innerHTML += `<br>Error: ${event.detail.type || 'Unknown'}<br>${event.detail.message || ''}`;

          renderSourceError(debugEl, event.detail.sourceError);

          if (avatarUrl) {
            const resolvedUrl = resolveModelUrl(avatarUrl);
            // populate URL check asynchronously
            appendDebugInfo(debugEl, resolvedUrl);
          }

          renderSuggestions(debugEl, event.detail.message);
        }
      }

      // We'll still set modelLoaded to true so outfit can at least try to render
      // even if avatar has issues
      setModelLoaded(true);

      // Attempt to retry loading if appropriate
      if (retryCount < maxRetries) {
        // Wait before retrying
        setTimeout(() => {
          retryModelLoad();
        }, 2000);
      }
    };
    
    const handleProgress = (event) => {
      const progress = event.detail.totalProgress;
      console.log(`Model loading progress: ${Math.round(progress * 100)}%`);
    };

    // Add event listeners
    const viewerElement = avatarViewerRef.current;
    viewerElement.addEventListener('load', handleModelLoad);
    viewerElement.addEventListener('error', handleError);
    viewerElement.addEventListener('progress', handleProgress);

    // Cleanup
    return () => {
      viewerElement.removeEventListener('load', handleModelLoad);
      viewerElement.removeEventListener('error', handleError);
      viewerElement.removeEventListener('progress', handleProgress);
    };
  }, [viewerReady, avatarUrl]);

  // Position the outfit model correctly and sync cameras
  useEffect(() => {
    if (!outfitViewerRef.current || !outfitUrl || !modelLoaded) return;
    
    console.log('🎨 Setting up outfit overlay...');
    
    // Apply transformation to outfit
    const outfitElement = outfitViewerRef.current;
    const avatarElement = avatarViewerRef.current;
    
    // Wait for outfit model to load
    const handleOutfitLoad = () => {
      console.log('✅ Outfit model loaded successfully');
      syncCameras();
    };
    
    outfitElement.addEventListener('load', handleOutfitLoad);
    
    try {
      // Sync camera position from avatar to outfit
      const syncCameras = () => {
        if (!avatarElement || !outfitElement) return;
        
        try {
          const avatarOrbit = avatarElement.getCameraOrbit();
          const avatarTarget = avatarElement.getCameraTarget();
          
          if (avatarOrbit && avatarTarget) {
            outfitElement.cameraOrbit = `${avatarOrbit.theta}rad ${avatarOrbit.phi}rad ${avatarOrbit.radius}m`;
            outfitElement.cameraTarget = `${avatarTarget.x}m ${avatarTarget.y}m ${avatarTarget.z}m`;
            console.log('📷 Camera synced:', { 
              theta: avatarOrbit.theta, 
              phi: avatarOrbit.phi, 
              radius: avatarOrbit.radius 
            });
          }
        } catch (e) {
          console.warn('Camera sync failed:', e);
        }
      };
      
      // Sync cameras initially
      syncCameras();
      
      // Keep syncing as avatar camera moves
      const handleCameraChange = () => syncCameras();
      avatarElement.addEventListener('camera-change', handleCameraChange);
      
      // Update scale
      if (outfitScale !== 1) {
        // model-viewer requires scale to be set as a string with three values
        outfitElement.setAttribute('scale', `${outfitScale} ${outfitScale} ${outfitScale}`);
        console.log(`📏 Outfit scale set to: ${outfitScale}`);
      }
      
      // Update position (Y offset)
      if (outfitOffsetY !== 0) {
        // Position must be set as an attribute in model-viewer
        // Default is "0 0 0" for x, y, z positions
        outfitElement.setAttribute('position', `0 ${outfitOffsetY} 0`);
        
        // Also apply CSS transform as a fallback
        outfitElement.style.transform = `translateY(${outfitOffsetY}px)`;
        console.log(`📍 Outfit Y offset set to: ${outfitOffsetY}`);
      }
      
      console.log(`✨ Outfit overlay configured successfully`);
      
      return () => {
        if (avatarElement) {
          avatarElement.removeEventListener('camera-change', handleCameraChange);
        }
        if (outfitElement) {
          outfitElement.removeEventListener('load', handleOutfitLoad);
        }
      };
    } catch (error) {
      console.error('❌ Error applying transformations to outfit:', error);
    }
  }, [outfitUrl, outfitOffsetY, outfitScale, modelLoaded]);

  if (!viewerReady) {
    return <div ref={containerRef} style={{ width, height, position: 'relative' }}>Loading model viewer...</div>;
  }

  // Resolve model URLs for both avatar and outfit
  const resolvedAvatarUrl = resolveModelUrl(avatarUrl);
  const resolvedOutfitUrl = outfitUrl ? resolveModelUrl(outfitUrl) : null;

  return (
    <div ref={containerRef} style={{ 
      width, 
      height, 
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'transparent'
    }}>
      {/* Avatar model viewer */}
      <model-viewer
        ref={avatarViewerRef}
        src={resolvedAvatarUrl}
        camera-controls
        auto-rotate
        ar
        shadow-intensity="1"
        environment-image="https://modelviewer.dev/shared-assets/environments/aircraft_workshop_01_1k.hdr"
        exposure="1.5"
        tone-mapping="commerce"
        loading="eager"
        reveal="auto"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: 'transparent',
          zIndex: 1
        }}
        camera-target="0m 1m 0m"
        camera-orbit="0deg 75deg 105%"
        min-camera-orbit="auto auto auto"
        max-camera-orbit="auto auto auto"
        disable-zoom
      >
        <div className="loading" slot="poster">
          Loading avatar...
        </div>
        <div slot="progress-bar" style={{ position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center' }}>
          Loading 3D model...
        </div>
      </model-viewer>

      {/* Debug overlay to show model loading errors - helps troubleshoot */}
      <div style={{ 
        position: 'absolute', 
        bottom: '5px', 
        left: '5px', 
        right: '5px',
        fontSize: '10px',
        color: 'rgba(255,0,0,0.8)',
        backgroundColor: 'rgba(255,255,255,0.7)',
        padding: '3px',
        borderRadius: '3px',
        zIndex: 100,
        pointerEvents: 'none',
        display: 'none'
      }} id="model-debug-info">
        <strong>Model Debug Info</strong><br/>
        Avatar URL: {resolvedAvatarUrl}<br/>
        {resolvedOutfitUrl && <>Outfit URL: {resolvedOutfitUrl}<br/></>}
        <span style={{color: 'blue'}}>TIP: Check browser network tab for 404 errors</span>
      </div>

      {/* Outfit model viewer (conditionally rendered) */}
      {resolvedOutfitUrl && (
        <model-viewer
          ref={outfitViewerRef}
          src={resolvedOutfitUrl}
          camera-controls={false}
          auto-rotate
          ar
          shadow-intensity="0"
          environment-image="https://modelviewer.dev/shared-assets/environments/aircraft_workshop_01_1k.hdr"
          exposure="2.0"
          tone-mapping="commerce"
          loading="eager"
          reveal="auto"
          camera-target="0m 1m 0m"
          camera-orbit="0deg 75deg 105%"
          min-camera-orbit="auto auto auto"
          max-camera-orbit="auto auto auto"
          disable-zoom
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'transparent',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            zIndex: 2,
            filter: 'saturate(1.3) contrast(1.1) brightness(1.15)'
          }}
        >
          <div slot="poster" style={{ display: 'none' }}></div>
        </model-viewer>
      )}
    </div>
  );
};

WardrobeViewer.propTypes = {
  avatarUrl: PropTypes.string.isRequired,
  outfitUrl: PropTypes.string,
  outfitOffsetY: PropTypes.number,
  outfitScale: PropTypes.number,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default WardrobeViewer;