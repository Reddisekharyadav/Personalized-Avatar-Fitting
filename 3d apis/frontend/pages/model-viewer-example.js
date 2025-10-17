import { useState, useEffect } from 'react';
import AvatarViewer from '../components/AvatarViewer';
import { resolveModelUrl } from '../utils/modelUtils';

export default function ModelViewerExample() {
  const [currentModel, setCurrentModel] = useState('/public/model-assets/avatar.glb');
  const [models, setModels] = useState([
    { name: 'Default Avatar', url: '/public/model-assets/avatar.glb' },
    { name: 'Sample Outfit 1', url: '/public/model-assets/outfit1.glb' },
    { name: 'Sample Outfit 2', url: '/public/model-assets/outfit2.glb' },
    { name: 'RPM Avatar', url: 'https://models.readyplayer.me/68bed6d85474a2f0c49b8824.glb' }
  ]);
  
  useEffect(() => {
    // Apply any page setup if needed
    document.title = '3D Model Viewer Example';
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">3D Model Viewer Example</h1>
      
      {/* Main viewer section */}
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
        <AvatarViewer 
          modelUrl={resolveModelUrl(currentModel)}
          height={500}
          autoRotate={true}
          backgroundColor="#f8f9fa"
          showShadow={true}
          cameraControls={true}
          environmentImage="neutral"
          className="rounded-lg"
        />
      </div>
      
      {/* Model selection controls */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Select a Model</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {models.map((model, index) => (
            <button
              key={index}
              onClick={() => setCurrentModel(model.url)}
              className={`p-3 rounded-md transition-colors ${
                currentModel === model.url 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>
        
        {/* Custom URL input */}
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Custom Model URL</h3>
          <div className="flex">
            <input 
              type="text" 
              placeholder="Enter model URL (.glb format)" 
              value={currentModel} 
              onChange={(e) => setCurrentModel(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-l-md"
            />
            <button 
              onClick={() => setCurrentModel('')}
              className="bg-red-500 text-white px-4 rounded-r-md"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      
      {/* Implementation notes */}
      <div className="bg-white rounded-lg shadow-lg p-4 mt-6">
        <h2 className="text-xl font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Uses Google's <code>&lt;model-viewer&gt;</code> web component for reliable 3D rendering</li>
          <li>Supports GLB files (recommended) which are self-contained and avoid dependency issues</li>
          <li>Provides camera controls for zoom, pan, and orbit</li>
          <li>Auto-rotation can be enabled/disabled</li>
          <li>Environment lighting for realistic reflections</li>
          <li>Responsive design that works on all device sizes</li>
        </ul>
      </div>
    </div>
  );
}