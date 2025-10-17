// Rate limiting utility for Sketchfab API calls
// This helps prevent 429 Too Many Requests errors by adding delay between requests
import axios from 'axios';

// Queue for API requests with built-in delay
class ApiRateLimiter {
  constructor(requestsPerSecond = 1) {
    this.queue = [];
    this.processing = false;
    this.rateLimitMs = 1000 / requestsPerSecond;
    this.lastRequestTime = 0;
    this.retryBackoff = [1, 2, 4, 8, 16]; // Exponential backoff in seconds
  }

  // Add a request to the queue
  async enqueue(apiCall, params, retryCount = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        apiCall,
        params,
        retryCount,
        resolve,
        reject
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  // Process the queue with rate limiting
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If we've made a request recently, wait before making another
    if (timeSinceLastRequest < this.rateLimitMs) {
      const delay = this.rateLimitMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Process the next request
    const request = this.queue.shift();
    this.lastRequestTime = Date.now();
    
    try {
      const result = await request.apiCall(request.params);
      request.resolve(result);
    } catch (error) {
      // Handle rate limiting errors with retry logic
      if (
        error.response && 
        error.response.status === 429 && 
        request.retryCount < this.retryBackoff.length
      ) {
        console.log(`Rate limited (429), retrying in ${this.retryBackoff[request.retryCount]} seconds...`);
        
        // Wait and retry with exponential backoff
        const backoffTime = this.retryBackoff[request.retryCount] * 1000;
        setTimeout(() => {
          this.queue.unshift({
            ...request,
            retryCount: request.retryCount + 1
          });
        }, backoffTime);
      } else {
        request.reject(error);
      }
    }
    
    // Process the next item in the queue
    setTimeout(() => this.processQueue(), this.rateLimitMs);
  }
}

// Create global instance for the API rate limiter
const sketchfabRateLimiter = new ApiRateLimiter(0.5); // 0.5 requests per second (1 request every 2 seconds)

// Function to get model download URL with rate limiting
export async function getModelDownloadWithRateLimit(uid, token) {
  const apiCall = async ({ uid, token }) => {
    return await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}/download`, {
      headers: { Authorization: `Token ${token}` }
    });
  };
  
  return sketchfabRateLimiter.enqueue(apiCall, { uid, token });
}

// Function to get model details with rate limiting
export async function getModelDetailsWithRateLimit(uid, token) {
  const apiCall = async ({ uid, token }) => {
    return await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Token ${token}` }
    });
  };
  
  return sketchfabRateLimiter.enqueue(apiCall, { uid, token });
}

// Function to search models with rate limiting
export async function searchModelsWithRateLimit(params, token) {
  const apiCall = async ({ params, token }) => {
    return await axios.get('https://api.sketchfab.com/v3/search', {
      params,
      headers: { Authorization: `Token ${token}` }
    });
  };
  
  return sketchfabRateLimiter.enqueue(apiCall, { params, token });
}

// Export as named exports and default export
const rateLimiter = {
  sketchfabRateLimiter,
  getModelDownloadWithRateLimit,
  getModelDetailsWithRateLimit,
  searchModelsWithRateLimit
};

export default rateLimiter;