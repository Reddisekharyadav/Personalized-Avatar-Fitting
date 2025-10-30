import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * ThreeAvatarViewer Component
 * Requirement E: Three.js scene for viewing and applying assets to avatars
 * Requirement D: Load GLB from S3, apply clothing/texture assets
 * 
 * Features:
 * - Loads avatar GLB from S3
 * - Applies clothing assets (GLB or textures)
 * - Handles different body sizes and genders
 * - Graceful fallback when nodes are missing
 */

const ThreeAvatarViewer = ({ 
  avatarUrl, 
  assetUrl, 
  onLoadComplete, 
  onError,
  className = '' 
}) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const avatarRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 600;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight || 600;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      controlsRef.current?.dispose();
    };
  }, []);

  // Load avatar GLB
  useEffect(() => {
    if (!avatarUrl || !sceneRef.current) return;

    setLoading(true);
    setError(null);

    const loader = new GLTFLoader();
    
    console.log('Loading avatar:', avatarUrl);

    loader.load(
      avatarUrl,
      (gltf) => {
        console.log('Avatar loaded successfully');
        
        // Remove previous avatar if exists
        if (avatarRef.current) {
          sceneRef.current.remove(avatarRef.current);
        }

        // Add new avatar to scene
        const avatar = gltf.scene;
        avatar.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // Center and scale avatar
        const box = new THREE.Box3().setFromObject(avatar);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Adjust position (center at origin, standing on ground)
        avatar.position.x = -center.x;
        avatar.position.y = -box.min.y;
        avatar.position.z = -center.z;

        // Scale if needed (ensure avatar is reasonable size)
        const maxSize = Math.max(size.x, size.y, size.z);
        if (maxSize > 3 || maxSize < 0.5) {
          const scale = 1.8 / maxSize;
          avatar.scale.multiplyScalar(scale);
        }

        sceneRef.current.add(avatar);
        avatarRef.current = avatar;

        setLoading(false);
        if (onLoadComplete) {
          onLoadComplete(gltf);
        }
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading avatar: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error('Error loading avatar:', error);
        setError('Failed to load avatar. Please try again.');
        setLoading(false);
        if (onError) {
          onError(error);
        }
      }
    );
  }, [avatarUrl, onLoadComplete, onError]);

  // Apply asset to avatar (Requirement D & E)
  useEffect(() => {
    if (!assetUrl || !avatarRef.current) return;

    console.log('Applying asset:', assetUrl);

    const loader = new GLTFLoader();
    
    loader.load(
      assetUrl,
      (gltf) => {
        console.log('Asset loaded successfully');
        
        // Strategy 1: Try to find clothing node and replace
        const clothingNode = findClothingNode(avatarRef.current);
        
        if (clothingNode) {
          console.log('Found clothing node, replacing...');
          const parent = clothingNode.parent;
          const newClothing = gltf.scene.children[0];
          
          if (parent && newClothing) {
            // Copy transform from old clothing
            newClothing.position.copy(clothingNode.position);
            newClothing.rotation.copy(clothingNode.rotation);
            newClothing.scale.copy(clothingNode.scale);
            
            // Replace
            parent.remove(clothingNode);
            parent.add(newClothing);
            console.log('Clothing replaced successfully');
          }
        } else {
          // Strategy 2: Add as overlay (attach to avatar root)
          console.log('No specific clothing node found, adding as overlay...');
          const assetMesh = gltf.scene;
          assetMesh.position.set(0, 0, 0);
          avatarRef.current.add(assetMesh);
          console.log('Asset added as overlay');
        }
      },
      undefined,
      (error) => {
        console.error('Error loading asset:', error);
        // Don't set error state for asset loading failures (Requirement D: graceful fallback)
        console.warn('Asset could not be applied, but avatar remains visible');
      }
    );
  }, [assetUrl]);

  // Helper: Find clothing node in avatar hierarchy (Requirement D)
  const findClothingNode = (object) => {
    let clothingNode = null;
    
    object.traverse((node) => {
      if (!clothingNode && node.isMesh) {
        const name = node.name.toLowerCase();
        // Look for common clothing node names
        if (name.includes('cloth') || 
            name.includes('shirt') || 
            name.includes('top') ||
            name.includes('outfit')) {
          clothingNode = node;
        }
      }
    });
    
    return clothingNode;
  };

  return (
    <div className={`avatar-viewer-container ${className}`}>
      <div 
        ref={containerRef} 
        className="avatar-canvas"
        style={{ width: '100%', height: '600px', position: 'relative' }}
      >
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading avatar...</p>
          </div>
        )}
        
        {error && (
          <div className="error-overlay">
            <p>{error}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .avatar-viewer-container {
          position: relative;
          width: 100%;
        }

        .avatar-canvas {
          border-radius: 8px;
          overflow: hidden;
          background: #f0f0f0;
        }

        .loading-overlay,
        .error-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }

        .error-overlay {
          background: #fee;
          color: #c00;
        }

        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 1rem;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ThreeAvatarViewer;
