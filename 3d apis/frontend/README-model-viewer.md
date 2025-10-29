# 3D Model Viewer Components

This package provides React components for displaying 3D models using Google's `<model-viewer>` web component. These components replace the previous Three.js implementation and offer a more reliable way to load and display GLB/GLTF models without texture or binary file dependency issues.

## Components

### AvatarViewer

A component for displaying a single 3D model with customizable options.

```jsx
import AvatarViewer from '../components/AvatarViewer';
import { resolveModelUrl } from '../utils/modelUtils';

// Basic usage
<AvatarViewer 
  modelUrl="/public/model-assets/avatar.glb"
  height={500}
/>

// Advanced usage with all options
<AvatarViewer 
  modelUrl={resolveModelUrl(modelUrl)}
  height={600}
  autoRotate={true}
  backgroundColor="#f8f9fa"
  showShadow={true}
  cameraControls={true}
  environmentImage="neutral"
  className="custom-viewer-class"
/>
```

### OutfitViewer

A specialized component for displaying avatars with outfits, designed for wardrobe/dressing room applications.

```jsx
import OutfitViewer from '../components/OutfitViewer';
import { resolveModelUrl } from '../utils/modelUtils';

// Basic usage
<OutfitViewer 
  avatarUrl="/public/model-assets/avatar.glb"
/>

// With outfit
<OutfitViewer 
  avatarUrl={resolveModelUrl(avatarUrl)}
  outfitUrl={resolveModelUrl(outfitUrl)}
  height={500}
  autoRotate={true}
  backgroundColor="transparent"
/>
```

## Utility Functions

The `modelUtils.js` module provides helper functions for working with 3D models:

- `resolveModelUrl(url)`: Ensures URLs are properly formatted for use in model-viewer
- `isValidModelFormat(url)`: Checks if a URL points to a supported model format
- `getEnvironmentImage(modelType)`: Gets appropriate environment lighting based on model type

## Example Page

Check out the `model-viewer-example.js` page for a complete implementation example.

## Benefits Over Previous Implementation

1. **No Dependency Issues**: The `<model-viewer>` component handles .glb files much more reliably than Three.js GLTFLoader
2. **Simpler Implementation**: No need to manage scene, camera, renderer, or lighting manually
3. **Better Performance**: Optimized for mobile devices and low-end hardware
4. **Built-in Controls**: Camera controls for zoom, pan, and orbit are included
5. **No Missing Textures**: Properly handles all model assets

## Requirements

- Store 3D models in the `/public/model-assets/` directory
- Use .glb format for models (preferred over .gltf for dependency management)
- Ensure models are properly structured with embedded textures

## Browser Support

The `<model-viewer>` component is supported in all modern browsers. It uses WebGL for rendering.