/**
 * TripoSR Local Integration (100% FREE)
 * Calls local Python TripoSR installation
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate 3D model using local TripoSR installation
 * @param {string|Buffer} imageInput - Image file path, URL, or buffer
 * @param {string} outputPath - Where to save GLB file
 * @returns {Promise<string>} Path to generated GLB file
 */
export async function generateLocalTripoSR(imageInput, outputPath) {
  // Handle different input types
  let tempImagePath = null;
  let imagePath;

  if (Buffer.isBuffer(imageInput)) {
    // Save buffer to temp file
    tempImagePath = path.join(__dirname, '..', 'temp', `input-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(tempImagePath), { recursive: true });
    fs.writeFileSync(tempImagePath, imageInput);
    imagePath = tempImagePath;
  } else if (typeof imageInput === 'string' && imageInput.startsWith('http')) {
    // Download URL to temp file
    const axios = (await import('axios')).default;
    tempImagePath = path.join(__dirname, '..', 'temp', `input-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(tempImagePath), { recursive: true });
    
    const response = await axios.get(imageInput, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempImagePath, response.data);
    imagePath = tempImagePath;
  } else if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
    // Use file path directly
    imagePath = imageInput;
  } else {
    throw new Error('Invalid image input: must be file path, URL, or Buffer');
  }

  try {
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Call Python script
    const pythonScript = path.join(__dirname, '..', 'triposr-generate.py');
    
    console.log('🎨 Generating 3D model with TripoSR...');
    console.log('Input:', imagePath);
    console.log('Output:', outputPath);

    // Use virtual environment Python if available
    const venvPath = path.join(__dirname, '..', 'triposr-local', 'venv');
    const pythonCmd = getPythonCommand(venvPath);
    
    await runPythonScript(pythonCmd, pythonScript, [imagePath, outputPath]);

    // Clean up temp file if created
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('GLB file was not generated');
    }

    const stats = fs.statSync(outputPath);
    console.log(`✅ Generated GLB: ${(stats.size / 1024).toFixed(2)} KB`);

    return outputPath;

  } catch (error) {
    // Clean up temp file on error
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
    throw error;
  }
}

/**
 * Get the appropriate Python command
 * Prefers virtual environment if available, falls back to system Python
 */
function getPythonCommand(venvPath) {
  const venvPython = path.join(venvPath, 'Scripts', 'python.exe');
  
  if (fs.existsSync(venvPython)) {
    console.log('✅ Using virtual environment Python:', venvPython);
    return venvPython;
  }
  
  console.log('⚠️  Virtual environment not found, using system Python');
  console.log('   Run setup-triposr-venv.bat to create isolated environment');
  return 'python';
}

/**
 * Run Python script and capture output
 */
function runPythonScript(pythonCmd, scriptPath, args) {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonCmd, [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Print progress to console
      if (output.includes('Loading') || output.includes('Generating') || output.includes('Saving')) {
        process.stdout.write(output);
      }
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        // Parse result path from output
        const match = stdout.match(/RESULT_PATH:(.+)/);
        if (match) {
          resolve(match[1].trim());
        } else {
          resolve(stdout);
        }
      } else {
        console.error('Python stderr:', stderr);
        
        if (stderr.includes('TripoSR not installed')) {
          reject(new Error(
            'TripoSR not installed. Please run setup-triposr-venv.bat first!'
          ));
        } else if (stderr.includes('No module named')) {
          reject(new Error(
            'Missing Python dependencies. Please run setup-triposr-venv.bat to install them.'
          ));
        } else {
          reject(new Error(`TripoSR failed (exit code ${code}): ${stderr}`));
        }
      }
    });

    python.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error(
          'Python not found. Please install Python 3.8+ from https://www.python.org/'
        ));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * Check if TripoSR is installed
 */
export function isTripoSRInstalled() {
  const triposrPath = path.join(__dirname, '..', 'triposr-local', 'TripoSR');
  return fs.existsSync(triposrPath);
}

export default {
  generateLocalTripoSR,
  isTripoSRInstalled
};
