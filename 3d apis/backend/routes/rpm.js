import express from 'express';
import axios from 'axios';
import { authenticateJWT } from '../lib/auth.js';

const router = express.Router();

// GET /api/readyplayer/token?userId=
// Generate a 15-second token for the Ready Player Me iframe
router.get('/token', authenticateJWT, async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const apiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
    const partner = process.env.RPM_PARTNER || process.env.NEXT_PUBLIC_RPM_SUBDOMAIN;
    if (!apiKey || !partner) {
      return res.status(500).json({ error: 'RPM configuration missing (RPM_API_KEY, RPM_PARTNER)' });
    }

    const resp = await axios.get('https://api.readyplayer.me/v1/auth/token', {
      params: { userId, partner },
      headers: { 'x-api-key': apiKey }
    });

    return res.json(resp.data);
  } catch (error) {
    console.error('RPM token error:', error?.response?.data || error?.message || error);
    return res.status(500).json({ error: 'Failed to create RPM token' });
  }
});

// GET /api/readyplayer/assets - Fetch RPM assets catalog
router.get('/assets', async (req, res) => {
  try {
    const apiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
    const appId = process.env.RPM_APP_ID;
    
    if (!apiKey || !appId) {
      return res.status(500).json({ error: 'RPM configuration missing (RPM_API_KEY, RPM_APP_ID)' });
    }

    const { type, gender, page = 1, limit = 24 } = req.query;

    // Fetch assets from RPM Asset Manager API
    const params = {
      applicationId: appId,
      ...(type && { type }), // outfit, top, bottom, footwear, etc.
      ...(gender && { gender }), // male, female
      page,
      limit
    };

    const resp = await axios.get('https://api.readyplayer.me/v1/assets', {
      params,
      headers: { 'x-api-key': apiKey }
    });

    // Process assets to extract GLB URLs if available
    const assets = resp.data?.data || [];
    const processedAssets = assets.map(asset => {
      // Check for GLB URL in various possible fields
      const glbUrl = asset.glbUrl || asset.modelUrl || asset.url || asset.model?.url || null;
      
      return {
        ...asset,
        glbUrl, // Add explicit glbUrl field
        // Log what we found for debugging
        _debug: process.env.NODE_ENV === 'development' ? {
          hasGlbUrl: !!glbUrl,
          availableFields: Object.keys(asset)
        } : undefined
      };
    });

    console.log(`📦 RPM Assets fetched: ${processedAssets.length} items, GLB URLs found: ${processedAssets.filter(a => a.glbUrl).length}`);

    return res.json({
      assets: processedAssets,
      pagination: resp.data?.pagination || { page: 1, limit: 24, total: 0 }
    });
  } catch (error_) {
    console.error('RPM assets fetch error:', error_?.response?.data || error_?.message || error_);
    return res.status(500).json({ 
      error: 'Failed to fetch RPM assets', 
      details: error_?.response?.data?.message || error_?.message 
    });
  }
});

// GET /api/readyplayer/assets/:assetId - Fetch individual asset details (may include GLB URL)
router.get('/assets/:assetId', async (req, res) => {
  try {
    const apiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
    const { assetId } = req.params;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'RPM configuration missing (RPM_API_KEY)' });
    }

    // Try to fetch detailed asset information
    const resp = await axios.get(`https://api.readyplayer.me/v1/assets/${assetId}`, {
      headers: { 'x-api-key': apiKey }
    });

    const asset = resp.data;
    console.log(`📦 RPM Asset ${assetId} details:`, JSON.stringify(asset, null, 2));

    return res.json(asset);
  } catch (error_) {
    console.error('RPM asset detail fetch error:', error_?.response?.data || error_?.message || error_);
    return res.status(500).json({ 
      error: 'Failed to fetch RPM asset details', 
      details: error_?.response?.data?.message || error_?.message 
    });
  }
});

// GET /api/readyplayer/assets/:assetId/download - Download asset GLB with authentication
router.get('/assets/:assetId/download', async (req, res) => {
  try {
    const apiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
    const { assetId } = req.params;
    
    if (!apiKey) {
      console.error('❌ RPM_API_KEY not configured');
      return res.status(500).json({ error: 'RPM configuration missing (RPM_API_KEY)' });
    }

    console.log(`🔽 Attempting to download RPM asset GLB: ${assetId}`);

    // ReadyPlayerMe assets are designed to be applied to RPM avatars via their platform
    // They don't provide direct GLB download URLs in their API
    // This endpoint would need RPM's asset download API which may require special permissions
    
    console.error('❌ RPM asset direct download not available - assets are designed for RPM avatar customization');
    return res.status(501).json({ 
      error: 'RPM assets cannot be downloaded directly',
      message: 'ReadyPlayerMe assets are designed to be applied to RPM avatars through their platform. Use the RPM avatar customizer instead.',
      assetId: assetId
    });

  } catch (error_) {
    console.error('RPM asset download error:', error_?.response?.data || error_?.message || error_);
    return res.status(500).json({ 
      error: 'Failed to download RPM asset', 
      details: error_?.response?.data?.message || error_?.message 
    });
  }
});

// POST /api/readyplayer/generate-avatar
// Generate avatar from photo, gender, bodyType
router.post('/generate-avatar', authenticateJWT, async (req, res) => {
  try {
    const { userId, photo, gender, bodyType } = req.body;
    if (!userId || !photo || !gender || !bodyType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Call RPM API to generate avatar
    const apiKey = process.env.RPM_API_KEY || process.env.Readyplayerme_api_key;
    const partner = process.env.RPM_PARTNER || process.env.NEXT_PUBLIC_RPM_SUBDOMAIN;
    if (!apiKey || !partner) {
      return res.status(500).json({ error: 'RPM configuration missing (RPM_API_KEY, RPM_PARTNER)' });
    }
    // Example RPM API endpoint for avatar creation (replace with actual endpoint)
    const resp = await axios.post('https://api.readyplayer.me/v1/avatar', {
      userId,
      image: photo,
      gender,
      bodyType,
      partner
    }, {
      headers: { 'x-api-key': apiKey }
    });
    // Assume response contains avatarUrl
    const avatarUrl = resp.data?.avatarUrl || resp.data?.url;
    if (!avatarUrl) {
      return res.status(500).json({ error: 'RPM did not return avatar URL' });
    }
    return res.json({ avatarUrl });
  } catch (error) {
    console.error('RPM avatar generation error:', error?.response?.data || error?.message || error);
    return res.status(500).json({ error: 'Failed to generate avatar', details: error?.message });
  }
});

export default router;
