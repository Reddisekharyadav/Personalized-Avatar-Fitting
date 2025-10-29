/**
 * GLTF Preparation Script
 * 
 * This script helps prepare GLTF models for conversion to GLB by:
 * 1. Ensuring all referenced files (bin, textures) are properly available
 * 2. Copying missing dependencies to the correct locations
 * 3. Running the conversion script
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import the modelResourceHelper
import modelResourceHelper from '../utils/modelResourceHelper.js';

// Parse command-line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node prepare-gltf.js <inputPath>');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || inputPath.replace('.gltf', '.glb');

/**
 * Create a placeholder bin file with valid structure
 * @param {string} outputPath - The path to create the placeholder bin file
 */
function createPlaceholderBin(outputPath) {
  // Create a small valid buffer for a simple glTF model
  // This buffer contains a minimal valid accessor data
  const buffer = Buffer.alloc(48); // 48 bytes for a minimal float buffer (4 bytes * 3 components * 4 vertices)
  
  // Fill with some valid float data (simple cube coordinates)
  const vertices = [
    // Vertex 0
    0.0, 0.0, 0.0,
    // Vertex 1
    1.0, 0.0, 0.0,
    // Vertex 2
    0.0, 1.0, 0.0,
    // Vertex 3
    1.0, 1.0, 0.0
  ];
  
  let offset = 0;
  for (const value of vertices) {
    buffer.writeFloatLE(value, offset);
    offset += 4;
  }
  
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created placeholder bin file: ${outputPath}`);
}

/**
 * Create a placeholder texture file
 * @param {string} outputPath - The path to create the placeholder texture
 */
function createPlaceholderTexture(outputPath) {
  // Create a simple 1x1 pixel PNG
  // This is a pre-generated 1x1 white PNG file as a buffer
  const pngData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 
    'base64'
  );
  
  fs.writeFileSync(outputPath, pngData);
  console.log(`Created placeholder texture: ${outputPath}`);
}

async function prepareAndConvert() {
  try {
    console.log(`Preparing ${inputPath} for conversion...`);
    
    // Read the GLTF file
    const gltfContent = fs.readFileSync(inputPath, 'utf8');
    const gltf = JSON.parse(gltfContent);
    
    // Create a model-specific directory for temporary resources
    const modelName = path.basename(inputPath, '.gltf');
    const tempDir = path.join(path.dirname(inputPath), `${modelName}-tmp`);
    const tempBinDir = path.join(tempDir, 'bin');
    const tempTexturesDir = path.join(tempDir, 'textures');
    
    // Create directories if they don't exist
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (e) { /* ignore */ }
    try { fs.mkdirSync(tempBinDir, { recursive: true }); } catch (e) { /* ignore */ }
    try { fs.mkdirSync(tempTexturesDir, { recursive: true }); } catch (e) { /* ignore */ }
    
    // Use modelResourceHelper to find necessary resources
    const binFiles = await modelResourceHelper.findAllBinFiles();
    const textureFiles = await modelResourceHelper.findAllTextureFiles();
    
    // Track missing resources for summary
    const missingResources = {
      bin: [],
      textures: []
    };
    
    // Check and copy buffer files
    if (gltf.buffers) {
      for (const buffer of gltf.buffers) {
        if (buffer.uri && !buffer.uri.startsWith('data:')) {
          const bufferName = path.basename(buffer.uri);
          
          // Look for matching bin file in our collected bin files
          const matchingBinFile = binFiles.find(bf => path.basename(bf) === bufferName);
          
          if (matchingBinFile) {
            // Copy the bin file to the temp directory
            const targetPath = path.join(tempBinDir, bufferName);
            fs.copyFileSync(matchingBinFile, targetPath);
            console.log(`Copied bin file: ${matchingBinFile} -> ${targetPath}`);
            
            // Update the URI to point to the local copy
            buffer.uri = path.join('bin', bufferName);
          } else {
            console.warn(`Warning: Could not find bin file: ${bufferName}`);
            missingResources.bin.push(bufferName);
            
            // Create placeholder bin file
            const placeholderPath = path.join(tempBinDir, bufferName);
            createPlaceholderBin(placeholderPath);
            
            // Update the URI to point to the placeholder
            buffer.uri = path.join('bin', bufferName);
          }
        }
      }
    }
    
    // Check and copy texture files
    if (gltf.images) {
      for (const image of gltf.images) {
        if (image.uri && !image.uri.startsWith('data:')) {
          const textureName = path.basename(image.uri);
          const textureNameWithoutPath = textureName.replace('textures/', '');
          
          // Look for matching texture file in our collected texture files
          const matchingTextureFile = textureFiles.find(tf => 
            path.basename(tf) === textureName || 
            path.basename(tf) === textureNameWithoutPath
          );
          
          if (matchingTextureFile) {
            // Copy the texture file to the temp directory
            const targetPath = path.join(tempTexturesDir, textureNameWithoutPath);
            fs.copyFileSync(matchingTextureFile, targetPath);
            console.log(`Copied texture file: ${matchingTextureFile} -> ${targetPath}`);
            
            // Update the URI to point to the local copy
            image.uri = path.join('textures', textureNameWithoutPath);
          } else {
            console.warn(`Warning: Could not find texture file: ${textureName}`);
            missingResources.textures.push(textureName);
            
            // Create placeholder texture file
            const placeholderPath = path.join(tempTexturesDir, textureNameWithoutPath);
            createPlaceholderTexture(placeholderPath);
            
            // Update the URI to point to the placeholder
            image.uri = path.join('textures', textureNameWithoutPath);
          }
        }
      }
    }
    
    // Write the modified GLTF to the temp directory
    const tempGltfPath = path.join(tempDir, path.basename(inputPath));
    fs.writeFileSync(tempGltfPath, JSON.stringify(gltf, null, 2));
    console.log(`Created temporary GLTF file with updated references: ${tempGltfPath}`);
    
    // Print summary of missing resources and placeholder creation
    if (missingResources.bin.length > 0 || missingResources.textures.length > 0) {
      console.log('\n⚠️ Missing resources summary:');
      if (missingResources.bin.length > 0) {
        console.log(`- Created ${missingResources.bin.length} placeholder bin files:`, missingResources.bin.join(', '));
      }
      if (missingResources.textures.length > 0) {
        console.log(`- Created ${missingResources.textures.length} placeholder texture files:`, missingResources.textures.join(', '));
      }
      console.log('Note: Placeholders may affect model appearance but allow conversion to proceed.\n');
    }
    
    // Run the conversion on the temporary file
    console.log(`Converting prepared GLTF to GLB...`);
    const convertScript = path.join(__dirname, 'convert-gltf-to-glb.js');
    execSync(`node "${convertScript}" "${tempGltfPath}" "${outputPath}"`, { stdio: 'inherit' });
    
    console.log(`\nConversion complete!`);
    console.log(`Output GLB file: ${outputPath}`);
    
    // Ask if we want to keep the temporary directory
    console.log(`\nTemporary files are in: ${tempDir}`);
    console.log(`You can delete this directory if the conversion was successful.`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error preparing and converting GLTF: ${error.message}`);
    return false;
  }
}

// Run the preparation and conversion
prepareAndConvert();