/**
 * Test Sketchfab Try-On API
 * 
 * This script tests the Sketchfab try-on endpoints:
 * 1. Search for clothing models
 * 2. Extract and process a model
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function testSketchfabTryon() {
  console.log('=== Testing Sketchfab Try-On API ===\n');

  try {
    // Test 1: Search for clothing
    console.log('1. Searching for clothing models...');
    const searchResponse = await axios.get(`${BASE_URL}/api/sketchfab-tryon/search-clothing`, {
      params: { q: 'shirt' }
    });

    console.log(`✓ Found ${searchResponse.data.count} models`);
    
    if (searchResponse.data.models.length > 0) {
      const firstModel = searchResponse.data.models[0];
      console.log(`   First model: "${firstModel.name}" by ${firstModel.author}`);
      console.log(`   UID: ${firstModel.uid}`);
      console.log(`   Likes: ${firstModel.likeCount}\n`);

      // Test 2: Extract clothing model
      console.log('2. Extracting clothing model...');
      console.log(`   Processing model: ${firstModel.uid}`);
      
      const extractResponse = await axios.post(`${BASE_URL}/api/sketchfab-tryon/extract-clothing`, {
        uid: firstModel.uid,
        avatarUrl: 'https://models.readyplayer.me/test.glb' // dummy URL for testing
      });

      if (extractResponse.data.success) {
        console.log('✓ Model extracted successfully!');
        console.log(`   GLB URL: ${extractResponse.data.glbUrl}`);
        console.log(`   Size: ${(extractResponse.data.size / 1024).toFixed(2)} KB`);
        console.log(`   Method: ${extractResponse.data.method}\n`);
      }
    } else {
      console.log('⚠ No models found in search results');
    }

    console.log('=== All Tests Passed ===');

  } catch (error) {
    console.error('❌ Test Failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${error.response.data.error || error.response.data}`);
      if (error.response.data.details) {
        console.error(`   Details: ${error.response.data.details}`);
      }
    } else {
      console.error(`   ${error.message}`);
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠ Make sure the backend server is running on port 5000');
      console.error('   Run: cd backend && npm start');
    }
  }
}

// Run tests
testSketchfabTryon();
