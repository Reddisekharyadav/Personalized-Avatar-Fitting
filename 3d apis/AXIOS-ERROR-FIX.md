# Fix for "axios is not defined" Error

If you're seeing the error "axios is not defined" when trying to load outfits or models from Sketchfab, follow these steps to fix it:

## Fixes Applied

1. Added axios import to the rate limiter utility:
   ```javascript
   // At the top of rateLimiter.js
   import axios from 'axios';
   ```

2. Updated the import in sketchfab.js:
   ```javascript
   // Changed from
   import { getModelDownloadWithRateLimit, ... } from '../utils/rateLimiter.js';
   
   // To
   import rateLimiter from '../utils/rateLimiter.js';
   const { getModelDownloadWithRateLimit, ... } = rateLimiter;
   ```

3. Made sure export styles are consistent across files

## How to Fix Similar Issues

If you see "X is not defined" errors in Node.js:

1. Check that the module is imported in the file where it's used
2. Check that the import/export styles match between files
3. Make sure the file paths are correct, including file extensions if needed
4. Verify that the package is installed in package.json

## Background

This error occurred because the `rateLimiter.js` utility was using axios without importing it. Since JavaScript modules have their own scope, axios needs to be imported in every file where it's used, even if it's imported in other files that use the module.

## Rate Limiter Usage

The rate limiter helps prevent Sketchfab API rate limit errors (HTTP 429) by:
- Spacing out requests to stay under rate limits
- Automatically retrying failed requests with exponential backoff
- Falling back to embed mode when direct downloads fail

To use it:
```javascript
import rateLimiter from '../utils/rateLimiter.js';

// Use the rate-limited API calls
const response = await rateLimiter.searchModelsWithRateLimit(params, token);
```