"use client";
import { useEffect, useRef, useState } from "react";

export default function ObjViewer({ src, width = 600, height = 400 }) {
  const mountRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let disposed = false;
    let renderer, scene, camera, controls, animationId;
    
    setStatus("loading");
    setError(null);
    
    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");

        if (disposed) return;
        
        // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0xffffff, 1); // white background
  renderer.setPixelRatio(window.devicePixelRatio);
        
        const el = mountRef.current;
        if (!el) return;
        el.innerHTML = "";
        el.appendChild(renderer.domElement);

  // Setup scene
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 5, 15); // white fog
        
        // Setup camera - moved back for better view
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 1.5, 5);

        camera.position.set(0, 1.5, 5);

        // Enhanced lighting optimized for skin-tone material
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);
        
        const hemi = new THREE.HemisphereLight(0xfff5e6, 0x444444, 1.0);
        hemi.position.set(0, 20, 0);
        scene.add(hemi);
        
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight1.position.set(5, 5, 5);
        scene.add(dirLight1);
        
        const dirLight2 = new THREE.DirectionalLight(0xffe6d5, 0.6);
        dirLight2.position.set(-5, 3, -5);
        scene.add(dirLight2);

        // Add grid and axes for reference
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        scene.add(gridHelper);
        
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        // Setup controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 0.8, 0);
        controls.update();

        // Load OBJ with progress logging
        const loader = new OBJLoader();
        console.log("Loading OBJ from:", src);
        
        loader.load(
          src,
          (obj) => {
            console.log("OBJ loaded successfully", obj);
            
            // Apply materials to all meshes
            obj.traverse((child) => {
              if (child.isMesh) {
                // Create a realistic skin-tone material
                child.material = new THREE.MeshPhongMaterial({
                  color: 0xffdbac,  // Skin tone
                  emissive: 0x442211,  // Slight warm glow
                  specular: 0x111111,
                  shininess: 5,
                  side: THREE.DoubleSide,
                  flatShading: false
                });
                
                // Add edge highlighting for better visibility
                const edges = new THREE.EdgesGeometry(child.geometry, 15);
                const edgeMaterial = new THREE.LineBasicMaterial({ 
                  color: 0x000000, 
                  linewidth: 2,
                  transparent: true,
                  opacity: 0.8
                });
                const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
                child.add(edgeLines);
                
                console.log("Mesh vertices:", child.geometry.attributes.position.count);
                console.log("Mesh faces:", child.geometry.index ? child.geometry.index.count / 3 : 'no index');
              }
            });
            
            // Compute bounding box and center
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            
            console.log("Object size:", size);
            console.log("Object center:", center);
            
            // Center object at origin
            obj.position.sub(center);
            obj.position.y += size.y / 2; // lift to stand on grid
            
            // Scale to fit in view (aim for 2 units tall)
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
              const targetSize = 2.0;
              const scale = targetSize / maxDim;
              obj.scale.setScalar(scale);
              console.log("Scaling by:", scale);
            }
            
            scene.add(obj);
            setStatus("loaded");
            
            // Start animation
            const animate = () => {
              if (disposed) return;
              animationId = requestAnimationFrame(animate);
              controls.update();
              renderer.render(scene, camera);
            };
            animate();
          },
          (progress) => {
            console.log("Loading progress:", progress);
          },
          (err) => {
            console.error("OBJ load error:", err);
            setError(err.message || "Failed to load 3D model");
            setStatus("error");
          }
        );
      } catch (err) {
        console.error("Viewer setup error:", err);
        setError(err.message || "Failed to initialize 3D viewer");
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) renderer.dispose();
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [src, width, height]);

  return (
    <div className="relative">
      <div ref={mountRef} style={{ width, height, borderRadius: '8px', overflow: 'hidden' }} />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 rounded-lg">
          <div className="text-white text-sm">Loading 3D model...</div>
        </div>
      )}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 bg-red-600 text-white text-xs p-2 rounded">
          Error: {error}
        </div>
      )}
      <div className="mt-2 text-xs text-gray-400">
        💡 Use mouse to rotate • Scroll to zoom • Right-click to pan
      </div>
    </div>
  );
}
