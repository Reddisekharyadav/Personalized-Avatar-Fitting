/**
 * GLTF to GLB Converter
 * 
 * This script converts GLTF files to self-contained GLB files with Draco compression.
 * Usage: node convert-gltf-to-glb.js <inputPath> [outputPath]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'gltf-pipeline';
const { gltfToGlb } = pkg;

// Get current file path (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node convert-gltf-to-glb.js <inputPath> [outputPath]');
  process.exit(1);
}

const inputPath = args[0];
let outputPath = args[1];

// If output path is not provided, create one based on the input path
if (!outputPath) {
  const inputDir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, '.gltf');
  outputPath = path.join(inputDir, `${baseName}.glb`);
}

async function convertGltfToGlb() {
  try {
    console.log(`Converting ${inputPath} to ${outputPath}...`);
    
    // Read the input GLTF file
    const gltfContent = fs.readFileSync(inputPath, 'utf8');
    let gltf = JSON.parse(gltfContent);
    
    // Determine the base directory for resource resolution
    const baseDir = path.dirname(inputPath);
    
    // Check for dependencies in bin/ subdirectory
    const binDir = path.join(baseDir, 'bin');
    const hasGlobalBinDir = fs.existsSync(binDir);
    
    // Check for dependencies in textures/ subdirectory
    const texturesDir = path.join(baseDir, 'textures');
    const hasGlobalTexturesDir = fs.existsSync(texturesDir);
    
    // Special handling for models with external references
    // Some model references might need to be updated to point to the correct locations
    if (gltf.buffers) {
      for (let i = 0; i < gltf.buffers.length; i++) {
        const buffer = gltf.buffers[i];
        if (buffer.uri && !buffer.uri.startsWith('data:')) {
          // Check if bin file exists directly
          const directPath = path.join(baseDir, buffer.uri);
          
          // Check if bin file exists in bin/ subdirectory
          const binSubdirPath = path.join(binDir, path.basename(buffer.uri));
          
          if (fs.existsSync(directPath)) {
            console.log(`Using buffer at: ${directPath}`);
            // Keep the original uri since it resolves correctly
          } else if (hasGlobalBinDir && fs.existsSync(binSubdirPath)) {
            console.log(`Found buffer in bin subdirectory: ${binSubdirPath}`);
            // Update the uri to point to the bin subdirectory
            buffer.uri = path.join('bin', path.basename(buffer.uri));
          } else {
            console.warn(`Warning: Buffer file not found: ${buffer.uri}`);
          }
        }
      }
    }
    
    if (gltf.images) {
      for (let i = 0; i < gltf.images.length; i++) {
        const image = gltf.images[i];
        if (image.uri && !image.uri.startsWith('data:')) {
          // Check if texture file exists directly
          const directPath = path.join(baseDir, image.uri);
          
          // Check if texture file exists in textures/ subdirectory
          const textureSubdirPath = path.join(texturesDir, path.basename(image.uri.replace('textures/', '')));
          
          if (fs.existsSync(directPath)) {
            console.log(`Using texture at: ${directPath}`);
            // Keep the original uri since it resolves correctly
          } else if (hasGlobalTexturesDir && fs.existsSync(textureSubdirPath)) {
            console.log(`Found texture in textures subdirectory: ${textureSubdirPath}`);
            // Update the uri to point to the textures subdirectory if it doesn't already
            if (!image.uri.startsWith('textures/')) {
              image.uri = path.join('textures', path.basename(image.uri));
            }
          } else {
            console.warn(`Warning: Texture file not found: ${image.uri}`);
          }
        }
      }
    }
    
    // Set options for the conversion
    const options = {
      resourceDirectory: baseDir, // Location of binary and texture files
      dracoOptions: {
        compressionLevel: 7, // Higher values mean more compression but slower encoding (0-10)
        quantizePositionBits: 14, // Position attribute quantization bits (1-16)
        quantizeNormalBits: 10, // Normal attribute quantization bits (1-16)
        quantizeTexcoordBits: 12, // Texture coordinate attribute quantization bits (1-16)
        quantizeColorBits: 8, // Color attribute quantization bits (1-16)
        quantizeGenericBits: 12, // Generic attribute quantization bits (1-16)
      }
    };
    
    // Convert GLTF to GLB
    const results = await gltfToGlb(gltf, options);
    
    // Write the GLB file
    fs.writeFileSync(outputPath, results.glb);
    
    console.log(`✅ Conversion successful! GLB file saved to: ${outputPath}`);
    
    // Log compression results
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    console.log(`Original GLTF size: ${(inputSize / 1024).toFixed(2)} KB`);
    console.log(`Compressed GLB size: ${(outputSize / 1024).toFixed(2)} KB`);
    console.log(`Compression ratio: ${(outputSize / inputSize * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('❌ Error converting GLTF to GLB:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

convertGltfToGlb();