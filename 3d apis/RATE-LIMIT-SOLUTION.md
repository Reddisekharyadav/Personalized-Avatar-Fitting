# Handling Sketchfab API Rate Limits

## Problem Solved

This document addresses the following issues that were occurring in the Virtual Dressing Room application:

1. **Permissions Policy Violations**:
   - `[Violation] Permissions policy violation: accelerometer is not allowed in this document.`
   - `The deviceorientation events are blocked by permissions policy.`

2. **Sketchfab API Rate Limiting**:
   - `Couldn't get download URL for model: Request failed with status code 429`

## Solutions Implemented

### 1. Permissions Policy Fixes

We removed the accelerometer and gyroscope permissions from the Sketchfab iframe since they aren't necessary for our use case:

```javascript
// Before
allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope"

// After
allow="autoplay; fullscreen; xr-spatial-tracking"
```

We also added the `loading="lazy"` attribute to improve page performance.

### 2. Rate Limiting Solution

We implemented a rate limiting solution to handle Sketchfab API limits:

1. **ApiRateLimiter Class**: Created a queue-based system in `utils/rateLimiter.js` that:
   - Limits requests to 0.5 per second (1 request every 2 seconds)
   - Implements exponential backoff for retry attempts
   - Handles 429 responses gracefully

2. **Background Processing**: Modified the `/outfits` endpoint to:
   - Return basic model information immediately to the UI
   - Fetch detailed download URLs in the background without blocking the response
   - Avoid timeout issues while still preparing data for the "Try On" feature

3. **Fallback Mechanism**: Added automatic fallback to embed URLs when rate limiting occurs:
   - Detects 429 status codes and falls back to embed instead of failing
   - Provides clear logging for debugging rate limit issues
   - Returns a successful response with `method: 'embed-fallback'` to indicate the fallback was used

## Usage Guidelines

### API Request Best Practices

1. **Use Rate-Limited API Calls**: Always use the rate-limited versions of API calls:
   ```javascript
   import { getModelDownloadWithRateLimit, getModelDetailsWithRateLimit, searchModelsWithRateLimit } from '../utils/rateLimiter.js';
   
   // Instead of direct axios calls
   const response = await searchModelsWithRateLimit(params, token);
   ```

2. **Prefer Embed Mode**: When possible, use embed mode to avoid API calls entirely:
   ```javascript
   // In frontend requests
   const response = await axios.post('/api/sketchfab/download', {
     uid: modelId,
     forceEmbed: true
   });
   ```

3. **UI Loading States**: Implement proper loading states in the UI to account for the rate-limited API calls that may take longer to complete.

### Tuning Rate Limits

If needed, you can adjust the rate limits in `utils/rateLimiter.js`:

```javascript
// Adjust requests per second - lower value = more conservative (fewer requests)
const sketchfabRateLimiter = new ApiRateLimiter(0.5); // 0.5 requests/second
```

## Monitoring & Troubleshooting

- Check console logs for messages like `Rate limited (429), retrying in X seconds...`
- If rate limits are still being hit frequently, consider:
  1. Reducing the rate further (e.g., 0.25 requests/second)
  2. Caching model URLs in a database to reduce API calls
  3. Implementing a more robust queue with persistence

## References

- [Sketchfab API Rate Limits](https://sketchfab.com/developers/oauth)
- [Permissions Policy Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy)