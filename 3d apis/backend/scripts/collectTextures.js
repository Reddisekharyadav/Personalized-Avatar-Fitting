/**
 * Texture Collector Script
 * 
 * This script finds textures from all model directories and copies them to a central location
 * to make them easier to serve via the /model-assets route.
 */

import fs from 'fs';
import path from 'path';

// Main directories
const avatarsDir = path.join(process.cwd(), 'avatars');
const targetTexturesDir = path.join(avatarsDir, 'textures');

// Create target directory if it doesn't exist
try {
  fs.mkdirSync(targetTexturesDir, { recursive: true });
  console.log(`Created textures directory: ${targetTexturesDir}`);
} catch (e) {
  if (e.code !== 'EEXIST') {
    console.error(`Error creating textures directory: ${e.message}`);
    process.exit(1);
  }
}

// Helper function to find all texture files in a directory
function findTexturesInDir(dir) {
  const results = [];
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        // If this is a textures directory, collect all files directly
        if (file.name === 'textures') {
          const textureFiles = fs.readdirSync(fullPath)
            .filter(name => name.match(/\.(png|jpg|jpeg|webp)$/i))
            .map(name => path.join(fullPath, name));
          results.push(...textureFiles);
        } else {
          // Otherwise recurse into the directory
          results.push(...findTexturesInDir(fullPath));
        }
      } else if (file.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
        // Also collect texture files outside of textures directories
        results.push(fullPath);
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${dir}: ${e.message}`);
  }
  return results;
}

// Find all textures in the avatars directory
console.log('Searching for texture files...');
const textureFiles = findTexturesInDir(avatarsDir);
console.log(`Found ${textureFiles.length} texture files`);

// Copy textures to the target directory
let copied = 0;
let skipped = 0;
let errors = 0;

for (const texturePath of textureFiles) {
  const fileName = path.basename(texturePath);
  const targetPath = path.join(targetTexturesDir, fileName);
  
  try {
    // Skip if file already exists in target
    if (fs.existsSync(targetPath)) {
      skipped++;
      continue;
    }
    
    // Copy the file
    fs.copyFileSync(texturePath, targetPath);
    copied++;
    console.log(`Copied: ${texturePath} -> ${targetPath}`);
  } catch (e) {
    errors++;
    console.error(`Error copying ${texturePath}: ${e.message}`);
  }
}

console.log(`
Texture collection complete:
- ${copied} files copied
- ${skipped} files skipped (already exist)
- ${errors} errors encountered

Textures directory: ${targetTexturesDir}
`);