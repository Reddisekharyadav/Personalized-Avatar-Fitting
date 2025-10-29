#!/usr/bin/env node

/**
 * Test script to initialize model resources
 */

import path from 'path';
import { fileURLToPath } from 'url';
import initModelResources from './initModelResources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting model resources initialization test...');
console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);

// Run the initialization
initModelResources()
  .then(() => {
    console.log('Model resources initialization test completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error running model resources initialization:', err);
    process.exit(1);
  });