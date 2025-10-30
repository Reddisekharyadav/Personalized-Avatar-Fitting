/**
 * Search for available image-to-3D models on Replicate
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

async function searchModels() {
  try {
    console.log('🔍 Searching for image-to-3D models on Replicate...\n');
    
    // Try some known working models
    const modelsToTry = [
      'stability-ai/triposr',
      'cjwbw/triposr',
      'lucataco/triposr',
      'zsxkib/instant-mesh'
    ];
    
    for (const modelPath of modelsToTry) {
      try {
        console.log(`\n📦 Checking: ${modelPath}`);
        const response = await axios.get(
          `https://api.replicate.com/v1/models/${modelPath}`,
          {
            headers: {
              'Authorization': `Bearer ${REPLICATE_API_TOKEN}`
            }
          }
        );
        
        console.log(`   ✅ Found model!`);
        console.log(`   Description: ${response.data.description || 'N/A'}`);
        
        // Get the latest version
        if (response.data.latest_version) {
          const version = response.data.latest_version;
          console.log(`   📌 Latest version: ${version.id}`);
          console.log(`   Created: ${version.created_at}`);
          console.log('');
          console.log(`   USE THIS IN YOUR CODE:`);
          console.log(`   version: '${version.id}'`);
        }
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ❌ Not found`);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchModels();
