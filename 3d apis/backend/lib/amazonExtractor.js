import axios from 'axios';
import { load } from 'cheerio';

/**
 * Amazon Product Image Extractor
 * Requirement F: safe extraction of product images from Amazon URLs
 * 
 * LEGAL NOTE: This module extracts only publicly available product images
 * using standard HTML metadata (og:image, schema.org). Always respect
 * Amazon's Terms of Service and robots.txt. Use rate limiting (see rateLimiter.js).
 */

const TIMEOUT_MS = 10000; // 10 seconds
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Whitelist of allowed domains to prevent SSRF attacks (Requirement H)
const ALLOWED_DOMAINS = [
  'amazon.com',
  'amazon.in',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.ca',
  'amazon.co.jp',
  'amazon.com.au'
];

/**
 * Validate Amazon URL to prevent SSRF
 * @param {string} url - URL to validate
 * @returns {boolean} - true if valid
 */
function isValidAmazonUrl(url) {
  try {
    const parsed = new URL(url);
    // Check protocol
    if (parsed.protocol !== 'https:') return false;
    // Check domain against whitelist
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Extract product image URL from Amazon page
 * @param {string} amazonUrl - Amazon product URL
 * @returns {Promise<string|null>} - extracted image URL or null
 */
export async function extractImageFromAmazon(amazonUrl) {
  // Validate URL to prevent SSRF (Requirement H)
  if (!isValidAmazonUrl(amazonUrl)) {
    throw new Error('Invalid Amazon URL or domain not whitelisted');
  }

  console.log(`Fetching Amazon page: ${amazonUrl}`);

  let html;
  try {
    const response = await axios.get(amazonUrl, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5
    });
    html = response.data;
  } catch (error) {
    console.error('Failed to fetch Amazon page:', error.message);
    throw new Error(`Failed to fetch Amazon page: ${error.message}`);
  }

  // Parse HTML with cheerio
  const $ = load(html);

  // Strategy 1: Try og:image meta tag (Requirement F.1)
  let imageUrl = $('meta[property="og:image"]').attr('content');
  if (imageUrl && isValidImageUrl(imageUrl)) {
    console.log('Found image via og:image:', imageUrl);
    return imageUrl;
  }

  // Strategy 2: Try data-old-hires or #landingImage (Requirement F.2)
  imageUrl = $('#landingImage').attr('data-old-hires') || $('#landingImage').attr('src');
  if (imageUrl && isValidImageUrl(imageUrl)) {
    console.log('Found image via #landingImage:', imageUrl);
    return imageUrl;
  }

  // Strategy 3: Try imageBlock data-a-dynamic-image (common Amazon pattern)
  const dynamicImageData = $('#imgBlkFront').attr('data-a-dynamic-image') || 
                           $('#landingImage').attr('data-a-dynamic-image');
  if (dynamicImageData) {
    try {
      const images = JSON.parse(dynamicImageData);
      const imageUrls = Object.keys(images);
      if (imageUrls.length > 0) {
        // Pick highest resolution (last entry usually highest)
        imageUrl = imageUrls[imageUrls.length - 1];
        if (isValidImageUrl(imageUrl)) {
          console.log('Found image via data-a-dynamic-image:', imageUrl);
          return imageUrl;
        }
      }
    } catch (e) {
      console.warn('Failed to parse data-a-dynamic-image:', e.message);
    }
  }

  // Strategy 4: Try schema.org JSON-LD (Requirement F.3)
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const jsonData = JSON.parse($(elem).html());
      if (jsonData.image) {
        const img = Array.isArray(jsonData.image) ? jsonData.image[0] : jsonData.image;
        if (typeof img === 'string' && isValidImageUrl(img)) {
          imageUrl = img;
          return false; // break loop
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  if (imageUrl && isValidImageUrl(imageUrl)) {
    console.log('Found image via schema.org JSON-LD:', imageUrl);
    return imageUrl;
  }

  console.warn('No valid image found on Amazon page');
  return null;
}

/**
 * Validate extracted image URL
 * @param {string} url - image URL
 * @returns {boolean} - true if valid
 */
function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Must be HTTPS (Requirement F)
    if (parsed.protocol !== 'https:') return false;
    // Must point to image domain (basic check)
    const hostname = parsed.hostname.toLowerCase();
    // Allow Amazon domains, CDNs, and common image hosts
    return hostname.includes('amazon') || 
           hostname.includes('ssl-images-amazon') ||
           hostname.includes('media-amazon') ||
           hostname.includes('m.media-amazon') ||
           hostname.includes('images-na.ssl-images-amazon') ||
           url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i); // Any direct image URL
  } catch {
    return false;
  }
}

export default {
  extractImageFromAmazon,
  isValidAmazonUrl
};
