/**
 * Model Resource Helper
 * 
 * This utility helps with managing model resources like textures and bin files
 * for GLTF models.
 */

import fs from 'fs';
import path from 'path';

// Base directories
const ROOT_DIR = process.cwd();
const AVATARS_DIR = path.join(ROOT_DIR, 'avatars');
const TEXTURES_DIR = path.join(AVATARS_DIR, 'textures');
const MODEL_CACHE_DIR = path.join(ROOT_DIR, 'model-cache');

// Make sure directories exist
try { fs.mkdirSync(TEXTURES_DIR, { recursive: true }); } catch (e) { /* ignore */ }
try { fs.mkdirSync(path.join(MODEL_CACHE_DIR, 'bin'), { recursive: true }); } catch (e) { /* ignore */ }
try { fs.mkdirSync(path.join(MODEL_CACHE_DIR, 'textures'), { recursive: true }); } catch (e) { /* ignore */ }

/**
 * Find all texture files across model directories
 * @returns {Array<string>} Array of texture file paths
 */
export function findAllTextureFiles() {
  const results = [];
  
  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Special handling for 'textures' directories
          if (entry.name === 'textures') {
            const textureFiles = fs.readdirSync(fullPath)
              .filter(name => name.match(/\.(png|jpg|jpeg|webp)$/i))
              .map(name => path.join(fullPath, name));
            results.push(...textureFiles);
          } else {
            // Recurse into other directories
            scanDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
          // Add texture files found outside of textures directories
          results.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error scanning directory ${dir}:`, e.message);
    }
  }
  
  scanDir(AVATARS_DIR);
  return results;
}

/**
 * Find all bin files across model directories
 * @returns {Array<string>} Array of bin file paths
 */
export function findAllBinFiles() {
  const results = [];
  
  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name === 'scene.bin') {
          results.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error scanning directory ${dir}:`, e.message);
    }
  }
  
  scanDir(AVATARS_DIR);
  return results;
}

/**
 * Copy texture files to the central textures directory
 * @returns {Object} Statistics about the copy operation
 */
export function consolidateTextureFiles() {
  const texturePaths = findAllTextureFiles();
  console.log(`Found ${texturePaths.length} texture files to consolidate`);
  
  let copied = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const texturePath of texturePaths) {
    const fileName = path.basename(texturePath);
    const targetPath = path.join(TEXTURES_DIR, fileName);
    
    try {
      // Skip if already exists
      if (fs.existsSync(targetPath)) {
        skipped++;
        continue;
      }
      
      fs.copyFileSync(texturePath, targetPath);
      copied++;
    } catch (e) {
      errors++;
      console.error(`Error copying texture ${texturePath}:`, e.message);
    }
  }
  
  return { copied, skipped, errors, total: texturePaths.length };
}

/**
 * Copy bin files to the central bin directory
 * @returns {Object} Statistics about the copy operation
 */
export function consolidateBinFiles() {
  const binPaths = findAllBinFiles();
  console.log(`Found ${binPaths.length} bin files to consolidate`);
  
  const binCacheDir = path.join(MODEL_CACHE_DIR, 'bin');
  let copied = 0;
  let skipped = 0;
  let errors = 0;
  
  // Copy the most recent scene.bin to the cache directory
  if (binPaths.length > 0) {
    try {
      // Sort by modified time (most recent first)
      binPaths.sort((a, b) => {
        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
      });
      
      const mostRecentBin = binPaths[0];
      const targetPath = path.join(binCacheDir, 'scene.bin');
      
      fs.copyFileSync(mostRecentBin, targetPath);
      console.log(`Copied most recent bin file to cache: ${mostRecentBin}`);
      copied++;
    } catch (e) {
      errors++;
      console.error('Error copying most recent bin file:', e.message);
    }
  }
  
  return { copied, skipped, errors, total: binPaths.length };
}

/**
 * Initialize the resource system by consolidating all needed files
 */
export function initializeResourceSystem() {
  console.log('Initializing model resource system...');
  
  const textureStats = consolidateTextureFiles();
  console.log(`Texture consolidation: ${textureStats.copied} copied, ${textureStats.skipped} skipped, ${textureStats.errors} errors`);
  
  const binStats = consolidateBinFiles();
  console.log(`Bin file consolidation: ${binStats.copied} copied, ${binStats.skipped} skipped, ${binStats.errors} errors`);
  
  console.log('Model resource system initialized');
}

export default {
  findAllTextureFiles,
  findAllBinFiles,
  consolidateTextureFiles,
  consolidateBinFiles,
  initializeResourceSystem,
  
  // Directories for external use
  directories: {
    root: ROOT_DIR,
    avatars: AVATARS_DIR,
    textures: TEXTURES_DIR,
    modelCache: MODEL_CACHE_DIR
  }
};