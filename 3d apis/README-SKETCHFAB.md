# Working with Sketchfab Models in Virtual Dressing Room

## Resolved Issues

We've implemented several fixes to handle problems loading 3D models from Sketchfab:

1. **ZIP Files Issue**: Fixed the "SyntaxError: Unexpected token 'P', 'PK'... is not valid JSON" error by:
   - Adding ZIP file format detection in the frontend
   - Implementing fallback to embedded viewer when ZIP files are detected
   - Adding `forceEmbed` option to prefer embedded viewers over direct downloads

2. **Model Loading Errors**: Resolved "Cannot read properties of undefined (reading 'scene')" by:
   - Validating model URLs before attempting to load
   - Adding better error handling to detect corrupt or incompatible models
   - Implementing automatic fallback to embedded Sketchfab viewer

## How It Works

### Backend (`sketchfab.js`)

The backend now:
- Supports a `forceEmbed` option to skip model download and use embedded viewer
- Returns more detailed information about the method used to fetch models
- Properly handles errors and provides fallback to embeds when needed

### Frontend (`SketchfabModelViewer.jsx`)

The viewer component now:
- Proactively checks for ZIP files before attempting to load
- Validates model URLs before loading
- Automatically switches to embedded mode when appropriate
- Has improved error handling and logging

### Utilities (`modelValidator.js`)

Added utility functions to:
- Detect ZIP archives by checking file headers
- Validate model URLs and formats
- Provide warnings for known issues with Sketchfab URLs

## Best Practices

1. **Prefer Embed Mode for Sketchfab Models**:
   ```javascript
   // When loading Sketchfab models, use forceEmbed:
   axios.post('/api/sketchfab/download', { uid: modelId, forceEmbed: true });
   ```

2. **Handle ZIP Files**:
   - ZIP files start with "PK" header (bytes 50 4B 03 04)
   - Add error handling for these specifically

3. **URL Validation**:
   ```javascript
   import { validateModelUrl, isZipArchive } from '../utils/modelValidator';
   
   // Validate before loading
   const validation = await validateModelUrl(modelUrl);
   if (!validation.valid) {
     // Use fallback
   }
   ```

## Remaining Considerations

- Sketchfab API sometimes returns ZIP archives instead of direct model files
- Some models may still need to be downloaded and processed on the server
- Consider adding a model conversion service for complex models

## References

- [Sketchfab API Documentation](https://docs.sketchfab.com/data-api/v3/index.html)
- [model-viewer Documentation](https://modelviewer.dev/)
- [Three.js GLTF Loader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)