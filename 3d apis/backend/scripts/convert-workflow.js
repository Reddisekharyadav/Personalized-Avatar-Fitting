import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for confirmation
function confirm(question) {
  return new Promise((resolve) => {
    rl.question(question + ' (y/n): ', (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Main function to run the workflow
async function runConversionWorkflow() {
  console.log('\n=== GLTF to GLB Conversion Workflow ===');
  console.log('This script will guide you through the process of converting GLTF models to GLB format');
  console.log('--------------------------------------------------\n');
  
  // Get the target directory
  let targetDir = process.argv[2] || rootDir;
  
  console.log(`Target directory: ${targetDir}`);
  
  // Step 1: Scan for models that need conversion
  console.log('\n[Step 1/4] Scanning for models that need conversion...');
  try {
    execSync(`node "${path.join(__dirname, 'scan-models.js')}" "${targetDir}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error scanning models:', error.message);
    process.exit(1);
  }
  
  // Ask for confirmation to proceed
  const proceedWithConversion = await confirm('\nDo you want to proceed with the conversion?');
  if (!proceedWithConversion) {
    console.log('Conversion cancelled. Exiting...');
    rl.close();
    return;
  }
  
  // Step 2: Convert models
  console.log('\n[Step 2/4] Converting models to GLB format...');
  
  try {
    if (process.platform === 'win32') {
      // Use batch script for Windows
      execSync(`"${path.join(__dirname, 'convert-batch.bat')}" "${targetDir}"`, { stdio: 'inherit' });
    } else {
      // Use node script directly for other platforms
      const gltfFiles = findGltfFiles(targetDir);
      for (const file of gltfFiles) {
        const outputFile = file.replace('.gltf', '.glb');
        console.log(`Converting ${file} to ${outputFile}...`);
        execSync(`node "${path.join(__dirname, 'convert-gltf-to-glb.js')}" "${file}" "${outputFile}"`, { stdio: 'inherit' });
      }
    }
  } catch (error) {
    console.error('Error converting models:', error.message);
    
    // Ask if they want to continue despite errors
    const continueAfterError = await confirm('There were errors during conversion. Do you want to continue with the workflow?');
    if (!continueAfterError) {
      console.log('Workflow cancelled. Exiting...');
      rl.close();
      return;
    }
  }
  
  // Step 3: Find code references
  console.log('\n[Step 3/4] Scanning code for GLTF references that need updating...');
  try {
    execSync(`node "${path.join(__dirname, 'find-model-references.js')}" "${targetDir}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error scanning code references:', error.message);
  }
  
  // Step 4: Verify conversion results
  console.log('\n[Step 4/4] Verifying conversion results...');
  verifyConversionResults(targetDir);
  
  console.log('\n=== Conversion Workflow Complete ===');
  console.log('Next steps:');
  console.log('1. Update your code to reference the new GLB files');
  console.log('2. Test your application to ensure models load correctly');
  console.log('3. If needed, run additional conversions for specific models');
  
  rl.close();
}

// Helper function to find GLTF files
function findGltfFiles(directory) {
  const results = [];
  
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['.git', 'node_modules', 'cache'].includes(entry.name) && !entry.name.endsWith('-cached')) {
          scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.gltf')) {
        results.push(fullPath);
      }
    }
  }
  
  scan(directory);
  return results;
}

// Helper function to verify conversion results
function verifyConversionResults(directory) {
  const gltfFiles = findGltfFiles(directory);
  const glbFiles = [];
  
  function findGlbFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['.git', 'node_modules', 'cache'].includes(entry.name) && !entry.name.endsWith('-cached')) {
          findGlbFiles(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.glb')) {
        glbFiles.push(fullPath);
      }
    }
  }
  
  findGlbFiles(directory);
  
  console.log(`Found ${gltfFiles.length} GLTF files and ${glbFiles.length} GLB files`);
  
  // Check for corresponding GLB files
  let missingGlbCount = 0;
  for (const gltfFile of gltfFiles) {
    const expectedGlbFile = gltfFile.replace('.gltf', '.glb');
    if (!fs.existsSync(expectedGlbFile)) {
      console.log(`Missing GLB file for: ${gltfFile}`);
      missingGlbCount++;
    }
  }
  
  if (missingGlbCount === 0) {
    console.log('All GLTF files have corresponding GLB versions. Conversion successful!');
  } else {
    console.log(`${missingGlbCount} GLTF files do not have corresponding GLB versions. Some conversions may have failed.`);
  }
}

// Run the workflow
runConversionWorkflow();