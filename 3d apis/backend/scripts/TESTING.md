# Model Conversion Testing Guide

This document provides step-by-step instructions for testing the GLTF to GLB model conversion workflow.

## Prerequisites

- Node.js installed
- gltf-pipeline installed (globally or as a project dependency)
- Access to the project repository

## Testing Process

### 1. Setup

1. Make sure you have the latest version of the code:
   ```
   git pull
   ```

2. Install dependencies if needed:
   ```
   cd backend
   npm install
   ```

### 2. Run the Conversion Workflow

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Run the conversion workflow:
   ```
   npm run convert-workflow
   ```

3. When prompted, select the target directory containing your GLTF models, or press Enter to use the default directory.

4. Review the scan results to see which models need conversion.

5. Confirm that you want to proceed with the conversion.

6. The script will convert all GLTF models to GLB format and provide a summary of the results.

### 3. Verify Conversion Results

1. Check that GLB files were created for each GLTF model.

2. Verify that the script identified code references that need updating.

3. Open the frontend application in your browser to visually verify that models load correctly.

### 4. Testing Specific Models

To test a specific model:

1. Convert a single model:
   ```
   npm run gltf-to-glb -- "path/to/model.gltf" "path/to/output.glb"
   ```

2. Use the test component to verify the model loads correctly:
   ```
   // Load the test component with your model
   import ModelViewer from '../components/ModelViewer';
   
   <ModelViewer modelUrl="/path/to/your/model.glb" />
   ```

## Common Issues and Solutions

### Model Loads But Textures Are Missing

- Check that the model has textures properly embedded.
- Try re-running the conversion with `--textures-embedded` flag:
  ```
  npm run gltf-to-glb -- "model.gltf" "model.glb" --textures-embedded
  ```

### 404 Errors After Conversion

- Make sure your application is referencing the new GLB file, not the old GLTF file.
- Update all code references to point to the GLB version of the model.

### Model Size Is Too Large

- Try using Draco compression to reduce file size:
  ```
  npm run gltf-to-glb -- "model.gltf" "model.glb" --draco
  ```

## Documenting Results

After testing, document your results:

1. Which models were successfully converted?
2. Were there any models that caused issues?
3. What was the size difference between GLTF and GLB versions?
4. Did the application performance improve?

This information will help improve the conversion process for future models.