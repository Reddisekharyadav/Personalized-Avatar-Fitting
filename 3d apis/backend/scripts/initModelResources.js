import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import modelResourceHelper from '../utils/modelResourceHelper.js';

// This script initializes the model resources by:
// 1. Finding all textures and bin files
// 2. Copying them to the central locations
// 3. Creating necessary directories

async function initModelResources() {
  console.log('Initializing model resources...');
  
  // Ensure directories exist
  const avatarsDir = path.join(process.cwd(), 'avatars');
  const texturesDir = path.join(avatarsDir, 'textures');
  const binDir = path.join(avatarsDir, 'bin');
  
  try { 
    fs.mkdirSync(avatarsDir, { recursive: true }); 
    fs.mkdirSync(texturesDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
  } catch (e) { 
    console.warn(`Warning creating directories: ${e.message}`);
  }
  
  // Find and copy all textures
  const textureFiles = await modelResourceHelper.findAllTextureFiles();
  console.log(`Found ${textureFiles.length} texture files`);
  
  for (const file of textureFiles) {
    const targetPath = path.join(texturesDir, path.basename(file));
    if (!fs.existsSync(targetPath)) {
      try {
        fs.copyFileSync(file, targetPath);
        console.log(`Copied texture: ${path.basename(file)} to central location`);
      } catch (e) {
        console.error(`Failed to copy texture ${file}: ${e.message}`);
      }
    }
  }
  
  // Find and copy all bin files
  const binFiles = await modelResourceHelper.findAllBinFiles();
  console.log(`Found ${binFiles.length} bin files`);
  
  for (const file of binFiles) {
    const targetPath = path.join(binDir, path.basename(file));
    if (!fs.existsSync(targetPath)) {
      try {
        fs.copyFileSync(file, targetPath);
        console.log(`Copied bin file: ${path.basename(file)} to central location`);
      } catch (e) {
        console.error(`Failed to copy bin file ${file}: ${e.message}`);
      }
    }
  }
  
  console.log('Model resources initialization complete');
}

// Run if this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initModelResources().catch(err => {
    console.error('Error initializing model resources:', err);
    process.exit(1);
  });
}

export default initModelResources;