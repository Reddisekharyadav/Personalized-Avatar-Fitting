import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Configure axios base URL once
axios.defaults.baseURL = API_BASE_URL;

// Helper to attach/remove Authorization token from localStorage
export function setAuthToken(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try { localStorage.setItem('token', token); } catch {}
  } else {
    delete axios.defaults.headers.common['Authorization'];
    try { localStorage.removeItem('token'); } catch {}
  }
}

// On load, attach token if present
try {
  const existing = localStorage.getItem('token');
  if (existing) setAuthToken(existing);
} catch {}

/**
 * Utility class for making API calls to the backend
 */
export default class ApiClient {
  // Generate avatar from photo, gender, bodyType
  static async generateAvatar({ userId, photo, gender, bodyType }) {
    const res = await axios.post('/readyplayer/generate-avatar', { userId, photo, gender, bodyType });
    return res.data;
  }
  /**
   * Get user profile data by email
   * @param {string} email User email
   * @returns {Promise<Object>} User data
   */
  static async getUserProfile(email) {
    try {
      const res = await axios.get(`/profile/${encodeURIComponent(email)}`);
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
      const res = await axios.get(`/outfits?q=${query}`);
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
      const res = await axios.post(`/user/outfit`, { email, outfitGlbUrl });
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
      const res = await axios.post(`/outfits/download`, { uid });
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
    const origin = (typeof globalThis !== 'undefined' && globalThis.location) ? globalThis.location.origin : '';
    if (url.startsWith(`${API_BASE_URL}`) || (origin && url.startsWith(origin))) return url;
    if (!url.startsWith('http')) return url;
    return `/proxy?url=${encodeURIComponent(url)}`;
  }

  /**
   * Generate 2D try-on image
   * @param {string} userId
   * @param {string} productLink URL of the product image
   * @param {string} userImage Base64 data URL of the user's photo
   */
  static async tryOn2D(userId, productLink, userImage) {
    try {
      const res = await axios.post(`/tryon2d`, { userId, productLink, userImage });
      return res.data;
    } catch (error) {
      console.error('Error generating 2D try-on:', error);
      throw error;
    }
  }

  // Modern auth endpoints
  static async register({ username, email, password, photo, avatarUrl, avatarId, metadata }) {
    const res = await axios.post('/auth/register', { username, email, password, photo, avatarUrl, avatarId, metadata });
    if (res.data?.token) setAuthToken(res.data.token);
    return res.data;
  }

  static async login({ email, password }) {
    const res = await axios.post('/auth/login', { email, password });
    if (res.data?.token) setAuthToken(res.data.token);
    return res.data;
  }

  static async logout() {
    try { await axios.post('/auth/logout'); } catch {}
    setAuthToken(null);
  }

  // Upload a user photo file (convert to base64 for /upload-photo endpoint)
  static async uploadPhoto({ email, file }) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  const res = await axios.post('/upload-photo', { email, photo: dataUrl });
  return res.data;
  }

  // Avatar receive: copy RPM GLB to storage and save metadata on user
  static async receiveAvatar({ userId, avatarId, rpmUrl, metadata }) {
    const res = await axios.post('/avatar/receive', { userId, avatarId, rpmUrl, metadata });
    return res.data;
  }

  static async getMyAvatar() {
    const res = await axios.get('/avatar/me');
    return res.data;
  }

  // Assets
  static async getAssets({ owner = 'public', page = 1, limit = 20 } = {}) {
    const res = await axios.get(`/assets?owner=${owner}&page=${page}&limit=${limit}`);
    return res.data;
  }
  static async applyAsset({ assetId }) {
    const res = await axios.post('/assets/apply', { assetId });
    return res.data;
  }

  // Ready Player Me integration
  static async getRpmToken({ userId }) {
    const res = await axios.get(`/readyplayer/token?userId=${encodeURIComponent(userId)}`);
    return res.data;
  }

  static async getRpmAssets({ type, gender, page = 1, limit = 24 } = {}) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (gender) params.append('gender', gender);
    params.append('page', page);
    params.append('limit', limit);
    const res = await axios.get(`/readyplayer/assets?${params.toString()}`);
    return res.data;
  }

  static async saveAvatar({ avatarUrl }) {
    const res = await axios.post('/users/avatar', { avatarUrl });
    return res.data;
  }

  static async linkRpm({ email, newUserId }) {
    const res = await axios.post('/auth/link', { email, newUserId });
    return res.data;
  }
}