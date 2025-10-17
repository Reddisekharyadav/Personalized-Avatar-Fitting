import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to scan a directory for GLTF files and check if they have external dependencies
function scanDirectory(directory) {
  console.log(`\nScanning directory: ${directory}`);
  console.log('===========================================================');
  
  const files = fs.readdirSync(directory, { withFileTypes: true });
  
  let gltfCount = 0;
  let withExternalDeps = 0;
  let alreadyOptimized = 0;
  
  // Track models with issues for detailed reporting
  const modelsWithIssues = [];
  
  for (const file of files) {
    if (file.isDirectory()) {
      // Skip directories named "*-cached" as they contain processed files
      if (file.name.endsWith('-cached')) {
        continue;
      }
      
      // For real directories, scan them recursively
      if (!['.git', 'node_modules', 'cache'].includes(file.name)) {
        scanDirectory(path.join(directory, file.name));
      }
    } else if (file.name.endsWith('.gltf')) {
      gltfCount++;
      
      const filePath = path.join(directory, file.name);
      const modelData = fs.readFileSync(filePath, 'utf8');
      
      try {
        const modelJson = JSON.parse(modelData);
        const hasBuffers = modelJson.buffers && modelJson.buffers.some(b => b.uri && !b.uri.startsWith('data:'));
        const hasImages = modelJson.images && modelJson.images.some(i => i.uri && !i.uri.startsWith('data:'));
        
        if (hasBuffers || hasImages) {
          withExternalDeps++;
          
          // Collect details about the external dependencies
          const externalBuffers = hasBuffers ? 
            modelJson.buffers.filter(b => b.uri && !b.uri.startsWith('data:')).map(b => b.uri) : [];
          
          const externalImages = hasImages ? 
            modelJson.images.filter(i => i.uri && !i.uri.startsWith('data:')).map(i => i.uri) : [];
          
          modelsWithIssues.push({
            path: filePath,
            externalBuffers,
            externalImages
          });
        } else {
          alreadyOptimized++;
        }
      } catch (error) {
        console.error(`Error parsing ${filePath}: ${error.message}`);
        modelsWithIssues.push({
          path: filePath,
          error: error.message
        });
      }
    }
  }
  
  if (gltfCount > 0) {
    console.log(`Found ${gltfCount} GLTF files:`);
    console.log(`- ${withExternalDeps} models have external dependencies (need conversion)`);
    console.log(`- ${alreadyOptimized} models are already optimized (no external dependencies)`);
    
    if (modelsWithIssues.length > 0) {
      console.log('\nModels needing conversion:');
      modelsWithIssues.forEach(model => {
        console.log(`\n${model.path}`);
        if (model.error) {
          console.log(`  Error: ${model.error}`);
        } else {
          if (model.externalBuffers.length > 0) {
            console.log('  External buffers:');
            model.externalBuffers.forEach(buffer => console.log(`  - ${buffer}`));
          }
          if (model.externalImages.length > 0) {
            console.log('  External textures:');
            model.externalImages.forEach(image => console.log(`  - ${image}`));
          }
        }
      });
      
      console.log('\nRecommended action:');
      console.log('Run the following command to convert all models with external dependencies:');
      console.log('npm run convert-batch -- <directory>');
      console.log('or for PowerShell:');
      console.log('npm run convert-batch-ps -- <directory>');
    }
  }
  
  return { gltfCount, withExternalDeps, alreadyOptimized, modelsWithIssues };
}

// Get the directory to scan from the command line or use the current directory
const targetDir = process.argv[2] || path.resolve(__dirname, '..');

console.log('GLTF Model Scanner');
console.log('=================');
console.log('This utility scans for GLTF models and identifies those with external dependencies');
console.log('that should be converted to GLB format for better compatibility.');

// Start the scan
const results = scanDirectory(targetDir);

// Print summary
console.log('\n=================');
console.log('SCAN SUMMARY');
console.log('=================');
console.log(`Total GLTF files found: ${results.gltfCount}`);
console.log(`Models needing conversion: ${results.withExternalDeps}`);
console.log(`Already optimized models: ${results.alreadyOptimized}`);

if (results.modelsWithIssues.length > 0) {
  console.log('\nRun one of the following commands to convert all problematic models:');
  console.log('npm run convert-batch -- "path/to/models"');
  console.log('npm run convert-batch-ps -- "path/to/models"');
}