import axios from 'axios';
import { load } from 'cheerio';

/**
 * Extract product image URL from a product link by scraping og:image or first img tag.
 * @param {string} productLink
 * @returns {Promise<string|null>} image URL or null if not found
 */
export async function extractProductImage(productLink) {
  try {
    const { data: html } = await axios.get(productLink, { timeout: 10000 });
  const $ = load(html);
    let imgUrl = $('meta[property="og:image"]').attr('content')
      || $('img').first().attr('src');
    if (imgUrl && imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
    return imgUrl || null;
  } catch (err) {
    console.warn('Failed to extract product image from link', productLink, err.message || err);
    return null;
  }
}