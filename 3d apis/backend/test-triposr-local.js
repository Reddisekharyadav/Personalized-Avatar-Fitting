/**
 * Test Local TripoSR Installation
 * Run: node test-triposr-local.js
 */

import { generateLocalTripoSR, isTripoSRInstalled } from './lib/triposrLocal.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLocalTripoSR() {
  console.log('🧪 Testing Local TripoSR (100% FREE)...\n');

  // Check installation
  if (!isTripoSRInstalled()) {
    console.log('❌ TripoSR not installed!');
    console.log('\n📦 Please run the setup script first:');
    console.log('   setup-triposr.bat\n');
    console.log('This will:');
    console.log('  1. Download TripoSR (open-source, MIT license)');
    console.log('  2. Install Python dependencies');
    console.log('  3. Set up everything for FREE local generation');
    console.log('\nNo API keys, no billing, no internet needed after setup!');
    return;
  }

  console.log('✅ TripoSR is installed!\n');

  // Test with a sample image
  const testImageUrl = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';
  
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'triposr-local-test.glb');

  console.log('📥 Test image:', testImageUrl);
  console.log('📤 Output path:', outputPath);
  console.log('\n⏳ Generating 3D model (first run downloads model ~2GB, then takes 10-30 seconds)...\n');

  try {
    const result = await generateLocalTripoSR(testImageUrl, outputPath);
    
    console.log('\n✅ SUCCESS!');
    console.log('Generated file:', result);
    
    const stats = fs.statSync(result);
    console.log('File size:', (stats.size / 1024).toFixed(2), 'KB');
    
    console.log('\n🎉 Local TripoSR WORKS!');
    console.log('This is 100% FREE - no API costs ever!');
    console.log('You can now integrate this into your backend.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('Python not found')) {
      console.log('\n📥 Please install Python 3.8+ from:');
      console.log('   https://www.python.org/downloads/');
    } else if (error.message.includes('not installed')) {
      console.log('\n📦 Please run: setup-triposr.bat');
    } else {
      console.log('\nFull error:', error);
    }
  }
}

testLocalTripoSR().catch(console.error);
