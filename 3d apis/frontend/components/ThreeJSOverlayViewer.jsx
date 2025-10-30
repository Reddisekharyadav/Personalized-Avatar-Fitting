import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { resolveModelUrl } from '../utils/modelUtils';

/**
 * ThreeJSOverlayViewer - Properly overlays clothing models onto avatars
 * Uses Three.js to load both models into the same 3D scene for true overlay
 */
const ThreeJSOverlayViewer = ({ 
  avatarUrl, 
  outfitUrl = null,
  width = '100%',
  height = 420
}) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const avatarModelRef = useRef(null);
  const outfitModelRef = useRef(null);
  const animationFrameRef = useRef(null);
  const gltfLoaderRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Utility: robustly sanitize a material by removing invalid/undefined texture references
  const sanitizeMaterial = (mat, label = '') => {
    if (!mat) return;

    // All texture-bearing keys we might encounter on MeshStandard/Physical/Basic/etc.
    const texKeys = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'lightMap',
      'alphaMap', 'bumpMap', 'displacementMap', 'envMap',
      // Physical/advanced
      'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
      'sheenColorMap', 'sheenRoughnessMap', 'transmissionMap', 'thicknessMap',
      'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap',
      // Legacy/spec glossiness
      'glossinessMap', 'specularMap'
    ];

    // Helper: check if image data is valid for rendering
    const isValidImageData = (img) => {
      if (!img) return false;
      // Accept standard browser image types
      if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return true;
      if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) return true;
      if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) return true;
      if (typeof HTMLVideoElement !== 'undefined' && img instanceof HTMLVideoElement) return true;
      if (typeof ImageData !== 'undefined' && img instanceof ImageData) return true;
      // Reject empty plain objects
      if (typeof img === 'object' && img.constructor === Object && Object.keys(img).length === 0) return false;
      // Trust other types (typed arrays, etc.)
      return true;
    };

    // Helper: determine if a texture object is usable by WebGLRenderer
    const isValidTexture = (t) => {
      if (!t || typeof t !== 'object') return false;
      if (!t.isTexture && !t.isCompressedTexture) return false;
      
      if (t.isCompressedTexture) {
        return Array.isArray(t.mipmaps) ? t.mipmaps.length > 0 : (t.image !== undefined && t.image !== null);
      }
      
      // Standard texture: must have valid image data
      return t.image !== undefined && t.image !== null && isValidImageData(t.image);
    };

    let sanitized = false;
    for (const key of texKeys) {
      const tex = mat[key];
      
      // CRITICAL: Always set to null if invalid, including if texture.image is undefined
      if (tex !== null && tex !== undefined) {
        if (!isValidTexture(tex)) {
          console.warn(`⚠️ Sanitizing material '${mat.name || label}': invalid/incomplete ${key} removed (image: ${tex?.image})`);
          mat[key] = null;
          sanitized = true;
        }
      } else if (tex === undefined) {
        // Normalize undefined to null
        mat[key] = null;
        sanitized = true;
      }
    }

    // Ensure sensible defaults
    if (mat.opacity === undefined || mat.opacity === null) mat.opacity = 1;
    if (mat.transparent === undefined || mat.transparent === null) mat.transparent = false;
    if (mat.side === undefined || mat.side === null) mat.side = THREE.DoubleSide;
    if (sanitized) mat.needsUpdate = true;
  };

  // Utility: re-sanitize an object (and its descendants) after a short delay to catch late-bound textures
  const scheduleResanitize = (root, labelPrefix = '') => {
    const run = () => {
      try {
        root.traverse((child) => {
          if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (let i = 0; i < mats.length; i++) {
              sanitizeMaterial(mats[i], `${labelPrefix}${child.name || 'mesh'}#${i}`);
            }
          }
        });
      } catch (e) {
        console.warn('Resanitize failed:', e?.message || e);
      }
    };
    // Run now and shortly after to catch async texture assignments from loaders
    run();
    setTimeout(run, 300);
    setTimeout(run, 1000);
  };

  // Helper: aggressively sanitize loaded GLTF before adding to scene (prevents crash during scene.add)
  const preSanitizeGltf = (gltf, label) => {
    if (gltf.parser?.json?.textures) {
      console.log(`🔧 Pre-sanitizing ${gltf.parser.json.textures.length} ${label} textures from GLTF`);
    }
    
    const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'envMap',
                     'lightMap', 'alphaMap', 'bumpMap', 'displacementMap'];
    
    gltf.scene.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of texKeys) {
          if (mat[key] && (!mat[key].image || mat[key].image === undefined)) {
            console.warn(`🔧 Pre-load ${label}: nulling ${key} on ${mat.name} (undefined image)`);
            mat[key] = null;
          }
        }
        mat.needsUpdate = true;
      }
    });
  };

  // Helper: quick pre-render sanitize to catch late-bound textures with undefined image
  const quickSanitizeModel = (model) => {
    if (!model) return;
    const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'envMap'];
    model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of texKeys) {
          if (mat[key] && mat[key].image === undefined) {
            mat[key] = null;
            mat.needsUpdate = true;
          }
        }
      }
    });
  };

  // Log when props change
  useEffect(() => {
    console.log('🔄 ThreeJSOverlayViewer props updated:');
    console.log('  - avatarUrl:', avatarUrl);
    console.log('  - outfitUrl:', outfitUrl);
  }, [avatarUrl, outfitUrl]);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('🎬 Initializing Three.js scene...');

  // Setup scene
  const scene = new THREE.Scene();
  // Transparent background to blend with page; we'll add an IBL environment for PBR materials
  scene.background = null;
    sceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Use modern color space/tone mapping for accurate colors
    if ('outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      // Fallback for older versions
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Image-Based Lighting (IBL) using an HDR environment improves PBR colors significantly
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const hdrUrl = 'https://modelviewer.dev/shared-assets/environments/aircraft_workshop_01_1k.hdr';
      new RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .load(hdrUrl, (texture) => {
          const envMap = pmrem.fromEquirectangular(texture).texture;
          scene.environment = envMap;
          texture.dispose();
          pmrem.dispose();
          console.log('🌈 HDR environment loaded for accurate PBR colors');
        }, undefined, (err) => {
          console.warn('HDR environment failed to load; colors may look flat:', err?.message || err);
        });
    } catch (e) {
      console.warn('Failed to initialize HDR environment:', e);
    }

    // Initialize GLTF loader with aggressive texture error handling
    try {
      const gltfLoader = new GLTFLoader();
      
      // CRITICAL FIX: Monkey-patch the THREE.TextureLoader to prevent undefined image crashes
      // This intercepts texture loading at the Three.js level before it reaches the renderer
      const originalLoad = THREE.TextureLoader.prototype.load;
      THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
        const wrappedOnLoad = (texture) => {
          // Ensure texture has valid image before calling original onLoad
          if (!texture.image || texture.image === undefined) {
            console.warn('🛡️ Blocked texture with undefined image:', url);
            // Create a minimal 1x1 transparent fallback
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            texture.image = canvas;
          }
          if (onLoad) onLoad(texture);
        };
        
        const wrappedOnError = (error) => {
          console.warn('🛡️ Texture load failed, creating fallback:', url, error?.message);
          // Don't crash - just log and continue
          if (onError) onError(error);
        };
        
        return originalLoad.call(this, url, wrappedOnLoad, onProgress, wrappedOnError);
      };
      
      gltfLoaderRef.current = gltfLoader;
      console.log('🧩 Loaders initialized with texture crash protection');
    } catch (e) {
      console.warn('Loaders initialization failed:', e);
      gltfLoaderRef.current = new GLTFLoader();
    }

    // Setup lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(5, 10, 5);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      try {
        controls.update();
        
        // CRITICAL: One more pre-render sanitization pass to catch any textures that get attached late
        quickSanitizeModel(avatarModelRef.current);
        quickSanitizeModel(outfitModelRef.current);
        
        renderer.render(scene, camera);
      } catch (e) {
        // Avoid crashing the app on intermittent texture readiness; log and skip a frame
        console.warn('Render skipped due to transient error:', e?.message || e);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        rendererRef.current.domElement.remove();
      }
      renderer.dispose();
    };
  }, []);

  // Load avatar model
  useEffect(() => {
    if (!sceneRef.current || !avatarUrl) return;

    console.log('👤 Loading avatar model:', avatarUrl);
    setLoading(true);
    setError(null);

  const loader = gltfLoaderRef.current || new GLTFLoader();
    const resolvedUrl = resolveModelUrl(avatarUrl);

    loader.load(
      resolvedUrl,
      (gltf) => {
        try {
          console.log('✅ Avatar model loaded successfully');
          
          // CRITICAL: Immediately sanitize ALL textures in the GLTF before Three.js tries to use them
          preSanitizeGltf(gltf, 'avatar');
          
          // Remove old avatar if exists
          if (avatarModelRef.current) {
            sceneRef.current.remove(avatarModelRef.current);
          }

  const model = gltf.scene;
        
        // Center and scale the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Scale to reasonable size (about 2 units tall)
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        model.scale.multiplyScalar(scale);
        
        // Center on ground
        model.position.x = -center.x * scale;
        model.position.y = -box.min.y * scale;
        model.position.z = -center.z * scale;

        // Enable shadows and sanitize materials
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (let i = 0; i < mats.length; i++) {
              sanitizeMaterial(mats[i], `${child.name || 'mesh'}#${i}`);
            }
          }
        });

  sceneRef.current.add(model);
  avatarModelRef.current = model;
  // Re-sanitize soon to catch any async texture hookups
  scheduleResanitize(model, 'avatar:');
        setLoading(false);
        
        console.log('👤 Avatar added to scene');
        } catch (processingError) {
          console.error('❌ Error processing avatar after load:', processingError);
          setError('Failed to process avatar model');
          setLoading(false);
        }
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading avatar: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Error loading avatar:', error);
        setError('Failed to load avatar model');
        setLoading(false);
      }
    );
  }, [avatarUrl]);

  // Load outfit model
  useEffect(() => {
    if (!sceneRef.current || !outfitUrl) {
      // Remove outfit if URL is cleared
      if (outfitModelRef.current) {
        console.log('🗑️ Removing outfit from scene');
        sceneRef.current.remove(outfitModelRef.current);
        outfitModelRef.current = null;
      }
      return;
    }

    console.log('👕 Loading outfit model:', outfitUrl);
    console.log('👕 Outfit URL type:', typeof outfitUrl);
    console.log('👕 Scene exists:', !!sceneRef.current);
    console.log('👕 Avatar loaded:', !!avatarModelRef.current);

  const loader = gltfLoaderRef.current || new GLTFLoader();
    const resolvedUrl = resolveModelUrl(outfitUrl);
    
    console.log('👕 Resolved outfit URL:', resolvedUrl);

    loader.load(
      resolvedUrl,
      (gltf) => {
        try {
          console.log('✅ Outfit model loaded successfully');
          console.log('✅ Outfit has', gltf.scene.children.length, 'children');
          
          // CRITICAL: Immediately sanitize ALL textures in the GLTF before Three.js tries to use them
          preSanitizeGltf(gltf, 'outfit');
          
          // Remove old outfit if exists
          if (outfitModelRef.current) {
            sceneRef.current.remove(outfitModelRef.current);
          }

  const model = gltf.scene;
        
        // Match avatar's scale and position
        if (avatarModelRef.current) {
          const avatarBox = new THREE.Box3().setFromObject(avatarModelRef.current);
          const outfitBox = new THREE.Box3().setFromObject(model);
          
          const avatarSize = avatarBox.getSize(new THREE.Vector3());
          const outfitSize = outfitBox.getSize(new THREE.Vector3());
          
          console.log('📏 Avatar size:', avatarSize);
          console.log('📏 Outfit size:', outfitSize);
          
          // Scale outfit to match avatar height
          const scale = avatarSize.y > 0 && outfitSize.y > 0 ? (avatarSize.y / outfitSize.y) : 1;
          model.scale.setScalar(scale);
          console.log('📏 Applied scale:', scale);

          // Reset outfit transform before alignment
          model.rotation.set(0, 0, 0);
          model.updateMatrixWorld(true);

          // Recompute boxes after scaling
          outfitBox.setFromObject(model);

          // Align centers (X, Z) and bottoms (Y) so they overlap
          const avatarCenter = avatarBox.getCenter(new THREE.Vector3());
          const outfitCenter = outfitBox.getCenter(new THREE.Vector3());

          // Start from avatar's position
          const position = new THREE.Vector3().copy(avatarModelRef.current.position);

          // Offset so centers match in X and Z
          position.x += (avatarCenter.x - outfitCenter.x);
          position.z += (avatarCenter.z - outfitCenter.z);

          // Align bottoms in Y
          const bottomOffsetY = avatarBox.min.y - outfitBox.min.y;
          position.y += bottomOffsetY;

          // Match rotation
          model.quaternion.copy(avatarModelRef.current.quaternion);

          model.position.copy(position);
          model.updateMatrixWorld(true);
          console.log('📍 Outfit positioned to align with avatar:', model.position);
        }

        // Enable shadows and sanitize materials to avoid undefined texture.image crashes
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            console.log('🎨 Mesh found:', child.name, 'Material:', child.material?.type);
            
            // Ensure materials are rendered with proper colors
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (let idx = 0; idx < materials.length; idx++) {
              sanitizeMaterial(materials[idx], `${child.name || 'mesh'}#${idx}`);
            }
          }
        });

  sceneRef.current.add(model);
  outfitModelRef.current = model;
  // Re-sanitize soon to catch any async texture hookups
  scheduleResanitize(model, 'outfit:');
        
        console.log('👕 Outfit added to scene and overlaid on avatar');
        console.log('👕 Scene now has', sceneRef.current.children.length, 'children');
        } catch (processingError) {
          console.error('❌ Error processing outfit after load:', processingError);
          console.error('Stack:', processingError.stack);
        }
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading outfit: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error('❌ Error loading outfit:', error);
      }
    );
  }, [outfitUrl]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden'
        }} 
      />
      
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div>Loading 3D models...</div>
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(255, 0, 0, 0.9)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        🖱️ Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
};

ThreeJSOverlayViewer.propTypes = {
  avatarUrl: PropTypes.string.isRequired,
  outfitUrl: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default ThreeJSOverlayViewer;
