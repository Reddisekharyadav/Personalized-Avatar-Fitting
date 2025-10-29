import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { useLoader } from '@react-three/fiber';

function Model({ src }) {
  const gltf = useLoader(GLTFLoader, src);
  return <primitive object={gltf.scene} dispose={null} />;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center>{Math.round(progress)}% loaded</Html>;
}

export default function ThreeViewer({ src, style }) {
  return (
    <div style={{ width: style?.width || 640, height: style?.height || 480 }}>
      <Canvas camera={{ position: [0, 1.6, 3], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 7]} intensity={0.8} />
        <Suspense fallback={<Loader />}>
          <Model src={src} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
