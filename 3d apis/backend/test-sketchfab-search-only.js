/**
 * Test Sketchfab Search Only
 * This test only searches for models without trying to download them
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function testSearch() {
  console.log('=== Testing Sketchfab Search API ===\n');

  try {
    // Test: Search for clothing
    console.log('Searching for clothing models...');
    const searchResponse = await axios.get(`${BASE_URL}/api/sketchfab-tryon/search-clothing`, {
      params: { q: 'shirt simple' }
    });

    console.log(`✓ Found ${searchResponse.data.count} models\n`);
    
    if (searchResponse.data.models.length > 0) {
      console.log('Top 5 Models:');
      searchResponse.data.models.slice(0, 5).forEach((model, index) => {
        console.log(`\n${index + 1}. "${model.name}"`);
        console.log(`   Author: ${model.author}`);
        console.log(`   UID: ${model.uid}`);
        console.log(`   Likes: ${model.likeCount}`);
        console.log(`   Thumbnail: ${model.thumbnail}`);
      });
    } else {
      console.log('⚠ No models found in search results');
    }

    console.log('\n=== Search Test Passed ===');

  } catch (error) {
    console.error('❌ Test Failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${error.response.data.error || error.response.data}`);
    } else {
      console.error(`   ${error.message}`);
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠ Make sure the backend server is running on port 5000');
      console.error('   Run: npm start');
    }
  }
}

testSearch();
