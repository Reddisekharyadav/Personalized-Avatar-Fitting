# 3D Model Conversion Utilities

This directory contains utilities for converting GLTF models to GLB format to solve common texture loading and resource reference issues.

## Why Convert GLTF to GLB?

GLTF files often have external dependencies (textures, bin files) that need to be properly resolved. This can lead to issues like:
- 404 errors when loading textures
- Missing "scene.bin" files
- Incorrect relative paths

GLB is a binary format that packages all these resources into a single file, which eliminates these issues.

## Available Utilities

### 1. Individual Model Conversion

Convert a single GLTF model to GLB format:

```bash
# Basic usage
npm run gltf-to-glb -- "path/to/model.gltf" "path/to/output.glb"

# With specific options
npm run gltf-to-glb -- "path/to/model.gltf" "path/to/output.glb" --compress
```

### 2. Batch Conversion

Convert multiple GLTF models in a directory (including subdirectories):

```bash
# Windows Command Prompt
npm run convert-batch -- "path/to/models"

# PowerShell
npm run convert-batch-ps -- "path/to/models"
```

### 3. Model Scanner

Scan your project for GLTF models that need conversion:

```bash
# Scan all models in the project
npm run scan-models

# Scan a specific directory
npm run scan-models -- "path/to/models"
```

The scanner will identify:
- Which models have external dependencies
- What specific textures and buffers are referenced
- Which models are already optimized

## Conversion Options

The conversion process uses gltf-pipeline with the following features:
- Draco compression (for smaller file sizes)
- Texture compression
- Binary resource inlining

## Best Practices

1. **Scan First**: Use the scanner to identify which models need conversion
2. **Backup Your Models**: Always keep a backup of your original files
3. **Test After Conversion**: Verify the converted models work properly in your application
4. **Update References**: Make sure your application references the new GLB files

## Troubleshooting

If you encounter issues after conversion:
- Check that your application is referencing the new GLB files
- Make sure the model-viewer component is configured correctly
- For complex models, try disabling compression with the --no-compress flag