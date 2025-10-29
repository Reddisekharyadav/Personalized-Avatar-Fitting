import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import rateLimiter from '../utils/rateLimiter.js';

const { getModelDownloadWithRateLimit, getModelDetailsWithRateLimit, searchModelsWithRateLimit } = rateLimiter;

dotenv.config();
const router = express.Router();

// GET /api/sketchfab/outfits - Get a list of outfits from Sketchfab
router.get('/outfits', async (req, res) => {
  try {
    const query = req.query.q || 'suit';
    const token = process.env.SKETCHFAB_API_TOKEN;
    
    if (!token) {
      return res.status(500).json({ 
        error: 'SKETCHFAB_API_TOKEN not configured on server'
      });
    }
    
    // Use rate-limited API call for search
    const response = await searchModelsWithRateLimit({ 
      type: 'models', 
      downloadable: true, 
      q: query 
    }, token);
    
    // Create an array to store processed outfit info
    const outfits = [];
    
    // Process each model one at a time to avoid overwhelming the API
    for (const item of response.data.results) {
      try {
        // Get basic info without API call first
        const outfitInfo = {
          name: item.name,
          thumbnail: item.thumbnails.images[0]?.url,
          uid: item.uid,
          // Direct URL to the Sketchfab model viewer (embedded)
          viewerUrl: `https://sketchfab.com/models/${item.uid}/embed`,
          // Default to embed URL which always works
          embedUrl: `https://sketchfab.com/models/${item.uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`
        };
        
        // Add to outfits immediately for the UI to have something to show
        outfits.push(outfitInfo);
      } catch (itemErr) {
        console.error(`Error processing outfit ${item.uid}:`, itemErr.message);
      }
    }
    
    // Return the outfits immediately to avoid timeout
    res.json({ outfits });
    
    // Background process: fetch download URLs without blocking the response
    // This avoids timeout issues while still preparing data for Try On
    setTimeout(async () => {
      try {
        for (let i = 0; i < outfits.length; i++) {
          const outfit = outfits[i];
          try {
            // Try to get the download URL in background
            const downloadRes = await getModelDownloadWithRateLimit(outfit.uid, token);
            const glbDownload = downloadRes.data.gltf?.url || null;
            
            if (glbDownload) {
              // Store the GLB URL in a cache or database
              console.log(`Got download URL for model ${outfit.uid}`);
              // You could update a cache here for future requests
            }
          } catch (dlErr) {
            console.error(`Couldn't get download URL for model ${outfit.uid}: ${dlErr.message}`);
          }
        }
      } catch (bgErr) {
        console.error('Background processing error:', bgErr);
      }
    }, 100);
    
  } catch (err) {
    console.error('Error fetching outfits:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sketchfab/download - Get direct model URL from Sketchfab
router.post('/download', async (req, res) => {
  const { uid, preferGlb, forceEmbed } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing model uid' });
  
  try {
    // If forceEmbed is true, just return the embed URL
    if (forceEmbed) {
      console.log('[download] Force embed mode requested for model:', uid);
      return res.json({
        success: true,
        url: `https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`,
        method: 'embed'
      });
    }

    // Call Sketchfab API to get the model URL
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) {
      return res.status(500).json({ 
        error: 'SKETCHFAB_API_TOKEN not configured on server' 
      });
    }

    let modelUrl = null;
    let method = 'unknown';

    // If preferGlb is true, try to get direct GLB URL from the model metadata first
    if (preferGlb) {
      try {
        const metaResp = await getModelDetailsWithRateLimit(uid, token);
        
        const formats = metaResp?.data?.formats;
        if (formats && Array.isArray(formats)) {
          // Try to find a GLB format
          const glbFormat = formats.find(f => 
            (f.format && /glb/i.test(f.format)) || 
            (f.url && /\.glb$/i.test(f.url))
          );
          
          if (glbFormat?.url) {
            modelUrl = glbFormat.url;
            method = 'metadata-glb';
            console.log('[download] Found direct GLB URL from metadata');
          }
        }
      } catch (metaErr) {
        console.warn('Error getting model metadata:', metaErr.message);
        // Continue to download endpoint as fallback
      }
    }

    // If we didn't get a GLB URL from metadata, try the download endpoint
    if (!modelUrl) {
      try {
        // Get the model download information from Sketchfab using rate limiter
        const resp = await getModelDownloadWithRateLimit(uid, token);

        // Look for direct GLB URL
        if (resp?.data?.gltf?.url) {
          // Direct GLB/GLTF URL
          modelUrl = resp.data.gltf.url;
          method = 'download-gltf';
        } else if (resp?.data?.formats) {
          // Look through formats for GLB
          const glbFormat = resp.data.formats.find(f => 
            (f.format && /gltf|glb/i.test(f.format)) || 
            (f.url && /\.glb$/i.test(f.url))
          );
          
          if (glbFormat?.url) {
            modelUrl = glbFormat.url;
            method = 'download-formats';
          }
        }
      } catch (downloadErr) {
        console.warn('Error from download endpoint:', downloadErr.message);
        // Fall through to embed as last resort
      }
    }

    // If we couldn't get a direct model URL or hit a rate limit, use embed
    if (!modelUrl) {
      // If no direct model URL found, return the Sketchfab embed URL
      console.log('[download] No direct model URL found, using embed URL for model:', uid);
      return res.json({
        success: true,
        url: `https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`,
        method: 'embed'
      });
    }

    // Return the direct model URL
    return res.json({
      success: true,
      url: modelUrl,
      method: method
    });
  } catch (err) {
    console.error('Sketchfab API download error:', err?.response?.data || err.message);
    
    // If we hit a rate limit error, return the embed URL instead of an error
    if (err.response && err.response.status === 429) {
      console.log('[download] Rate limited (429), falling back to embed URL for model:', uid);
      return res.json({
        success: true,
        url: `https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`,
        method: 'embed-fallback',
        rateLimited: true
      });
    }
    
    return res.status(500).json({
      error: 'Failed to get model download URL',
      details: err?.response?.data || err.message
    });
  }
});

export default router;