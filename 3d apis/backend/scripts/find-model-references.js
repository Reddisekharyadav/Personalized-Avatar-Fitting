import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to scan JavaScript/JSX files for GLTF references and suggest changes
function scanCodeForModelReferences(directory) {
  console.log(`\nScanning code in: ${directory}`);
  console.log('===========================================================');
  
  const files = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isDirectory()) {
      // Skip node_modules and .git directories
      if (!['.git', 'node_modules', 'cache'].includes(file.name)) {
        scanCodeForModelReferences(path.join(directory, file.name));
      }
    } else if (file.name.endsWith('.js') || file.name.endsWith('.jsx') || file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      const filePath = path.join(directory, file.name);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Look for model-viewer components and GLTF references
      const modelViewerRegex = /<model-viewer[^>]*src=["']([^"']*\.gltf)["'][^>]*>/g;
      const urlRegex = /['"`]((https?:\/\/[^'"]*\.gltf)|(\/[^'"]*\.gltf)|([^'"\/]*\.gltf))['"`]/g;
      
      let modelViewerMatch;
      let urlMatch;
      let foundReferences = false;
      
      // Check for model-viewer components with GLTF sources
      while ((modelViewerMatch = modelViewerRegex.exec(fileContent)) !== null) {
        if (!foundReferences) {
          console.log(`\nFile: ${filePath}`);
          foundReferences = true;
        }
        
        console.log(`- Found model-viewer with GLTF source: ${modelViewerMatch[1]}`);
        console.log(`  Suggested change: Replace with ${modelViewerMatch[1].replace('.gltf', '.glb')}`);
      }
      
      // Check for URL strings that might reference GLTF files
      while ((urlMatch = urlRegex.exec(fileContent)) !== null) {
        if (!foundReferences) {
          console.log(`\nFile: ${filePath}`);
          foundReferences = true;
        }
        
        console.log(`- Found potential GLTF reference: ${urlMatch[1]}`);
        console.log(`  Suggested change: Replace with ${urlMatch[1].replace('.gltf', '.glb')}`);
      }
    }
  }
}

// Get the directory to scan from the command line or use the current directory
const targetDir = process.argv[2] || path.resolve(__dirname, '../..');

console.log('GLTF Reference Scanner');
console.log('=====================');
console.log('This utility scans your code for GLTF model references that should be updated to GLB');
console.log('After converting your models, use this to find where code changes are needed.');

// Start the scan
scanCodeForModelReferences(targetDir);

console.log('\n=================');
console.log('SCAN COMPLETE');
console.log('=================');
console.log('Review the suggested changes and update your code to reference the GLB versions of your models.');
console.log('Remember to run the model conversion scripts first:');
console.log('npm run scan-models    - to identify models needing conversion');
console.log('npm run convert-batch  - to convert those models to GLB format');