import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Utility class for making API calls to the backend
 */
export default class ApiClient {
  /**
   * Get user profile data by email
   * @param {string} email User email
   * @returns {Promise<Object>} User data
   */
  static async getUserProfile(email) {
    try {
      // Corrected to use 'profile' route rather than non-existent 'user'
      const res = await axios.get(`${API_BASE_URL}/profile/${encodeURIComponent(email)}`);
      return res.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Search for outfits
   * @param {string} query Search query
   * @returns {Promise<Array>} Array of outfit objects
   */
  static async searchOutfits(query = 'suit') {
    try {
      const res = await axios.get(`${API_BASE_URL}/outfits?q=${query}`);
      return res.data.outfits || [];
    } catch (error) {
      console.error('Error searching outfits:', error);
      throw error;
    }
  }

  /**
   * Save a user's selected outfit
   * @param {string} email User email
   * @param {string} outfitGlbUrl URL of the outfit GLB file
   * @returns {Promise<Object>} Success response
   */
  static async saveUserOutfit(email, outfitGlbUrl) {
    try {
      const res = await axios.post(`${API_BASE_URL}/user/outfit`, { email, outfitGlbUrl });
      return res.data;
    } catch (error) {
      console.error('Error saving user outfit:', error);
      throw error;
    }
  }

  /**
   * Download an outfit by UID
   * @param {string} uid Outfit unique ID
   * @returns {Promise<Object>} Download URL and metadata
   */
  static async downloadOutfit(uid) {
    try {
      const res = await axios.post(`${API_BASE_URL}/outfits/download`, { uid });
      return res.data;
    } catch (error) {
      console.error('Error downloading outfit:', error);
      throw error;
    }
  }

  /**
   * Proxy a remote URL to avoid CORS issues
   * @param {string} url The URL to proxy
   * @returns {string} Proxied URL
   */
  static proxyUrl(url) {
    if (!url) return url;
    try {
      // If the URL is same-origin (localhost:5000) or already points to our backend, return directly
      if (url.startsWith(`${API_BASE_URL}`) || url.startsWith(window.location.origin)) return url;
      if (!url.startsWith('http')) return url;
      // Otherwise proxy remote origins that may lack CORS
      return `${API_BASE_URL}/proxy?url=${encodeURIComponent(url)}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * Generate 2D try-on image
   * @param {string} userId
   * @param {string} productLink URL of the product image
   * @param {string} userImage Base64 data URL of the user's photo
   */
  static async tryOn2D(userId, productLink, userImage) {
    try {
      const res = await axios.post(`${API_BASE_URL}/tryon2d`, { userId, productLink, userImage });
      return res.data;
    } catch (error) {
      console.error('Error generating 2D try-on:', error);
      throw error;
    }
  }
}