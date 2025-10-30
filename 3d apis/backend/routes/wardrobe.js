import express from 'express';
import User from '../models/User.js';
import WardrobeItem from '../models/WardrobeItem.js';
import { getModelDownloadWithRateLimit, getModelDetailsWithRateLimit } from '../utils/rateLimiter.js';
import axios from 'axios';

const router = express.Router();

// Simple in-memory cache for resolved preferredModelUrl -> { url, ts }
const resolutionCache = new Map();

// Persist preferredModelUrl back to WardrobeItem (best-effort)
async function persistPreferredModelUrl(itemId, url) {
  try {
    await WardrobeItem.findOneAndUpdate({ itemId }, { $set: { 'metadata.preferredModelUrl': url } });
  } catch (upErr) {
    console.warn('Failed to persist preferredModelUrl for', itemId, upErr && upErr.message);
  }
}

// Check if a .glb sibling exists for a remote .gltf
async function checkGlbSibling(url) {
  if (!url || !url.toLowerCase().endsWith('.gltf')) return null;
  const potentialGlb = url.replace(/\.gltf$/i, '.glb');
  try {
    const head = await axios.head(potentialGlb, { maxRedirects: 5, timeout: 5000 }).catch(() => null);
    if (head && head.status && head.status >= 200 && head.status < 400) return potentialGlb;
  } catch (err) {
    console.warn('Error checking GLB sibling for', url, err && err.message);
  }
  return null;
}

// Try to resolve a Sketchfab model to a direct GLB URL using metadata or download endpoints
async function resolveSketchfabToGlb(uid, modelUrl, token, itemId) {
  if (!uid || !token) return null;
  try {
    const meta = await getModelDetailsWithRateLimit(uid, token);
    const formats = meta?.data?.formats || [];
    const glbFormat = formats.find(f => (f.format && /glb/i.test(f.format)) || (f.url && /\.glb$/i.test(f.url)));
    if (glbFormat && glbFormat.url) {
      // cache and persist
      resolutionCache.set(modelUrl, { url: glbFormat.url, ts: Date.now() });
      if (itemId) await persistPreferredModelUrl(itemId, glbFormat.url).catch(() => {});
      return { url: glbFormat.url, method: 'sketchfab-metadata-glb' };
    }
  } catch (merr) {
    console.warn('Sketchfab metadata fetch failed for', uid, merr && merr.message);
  }

  try {
    const dl = await getModelDownloadWithRateLimit(uid, token);
    const glbUrl = dl?.data?.gltf?.url || null;
    if (glbUrl) {
      resolutionCache.set(modelUrl, { url: glbUrl, ts: Date.now() });
      if (itemId) await persistPreferredModelUrl(itemId, glbUrl).catch(() => {});
      return { url: glbUrl, method: 'sketchfab-download-gltf' };
    }
  } catch (dlerr) {
    console.warn('Sketchfab download endpoint failed for', uid, dlerr && dlerr.message);
  }

  return null;
}

// Resolve preferredModelUrl for a single mapped item
async function resolveSketchfabPreferred(it, token) {
  if (!it.modelUrl || !it.modelUrl.includes('sketchfab.com')) return false;
  try {
    const uidMatch = it.modelUrl.match(/models\/(?:embed\/)?([a-zA-Z0-9_-]+)/);
    const uid = uidMatch ? uidMatch[1] : null;
    if (uid) {
      const resolved = await resolveSketchfabToGlb(uid, it.modelUrl, token, it.id);
      if (resolved && resolved.url) {
        it.preferredModelUrl = resolved.url;
        it._resolutionMethod = resolved.method;
        return true;
      }
    }
    // Fallback to embed
    const uidFallback = it.modelUrl.match(/models\/([a-zA-Z0-9_-]+)/)?.[1];
    if (uidFallback) {
      it.preferredModelUrl = `https://sketchfab.com/models/${uidFallback}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`;
      it._resolutionMethod = 'sketchfab-embed-fallback';
      resolutionCache.set(it.modelUrl, { url: it.preferredModelUrl, ts: Date.now() });
      return true;
    }
  } catch (err) {
    console.warn('Error resolving Sketchfab preferredModelUrl for item', it.id, err && err.message);
  }
  return false;
}

async function resolveGlbSiblingPreferred(it) {
  try {
    const sibling = await checkGlbSibling(it.modelUrl);
    if (sibling) {
      it.preferredModelUrl = sibling;
      it._resolutionMethod = 'glb-sibling';
      return true;
    }
  } catch (err) {
    console.warn('Error resolving GLB sibling for item', it.id, err && err.message);
  }
  return false;
}

async function resolvePreferredForItem(it, token) {
  // Check cache first
  if (it.modelUrl && resolutionCache.has(it.modelUrl)) {
    const cached = resolutionCache.get(it.modelUrl);
    if (Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      it.preferredModelUrl = cached.url;
      it._resolutionMethod = 'cache';
      return;
    }
    resolutionCache.delete(it.modelUrl);
  }
  if (await resolveSketchfabPreferred(it, token)) return;
  if (await resolveGlbSiblingPreferred(it)) return;
}

// Helper: resolve a single sketchfab model's preferred url and whether it's try-on capable
async function resolveModelTryOn(uid, token) {
  if (!uid || !token) return { preferred: null, tryOnSupported: false };
  let preferred = null;
  let tryOnSupported = false;
  try {
    const meta = await getModelDetailsWithRateLimit(uid, token);
    const formats = meta?.data?.formats || [];
    const glb = formats.find(f => (f.format && /glb/i.test(f.format)) || (f.url && /\.glb$/i.test(f.url)));
    if (glb && glb.url) {
      preferred = glb.url;
      tryOnSupported = true;
      return { preferred, tryOnSupported };
    }
  } catch (err) {
    // fallthrough to download endpoint
    console.warn('Sketchfab metadata failed (tryOn check) for', uid, err && err.message);
  }

  try {
    const dl = await getModelDownloadWithRateLimit(uid, token);
    preferred = dl?.data?.gltf?.url || dl?.data?.gltf?.gltf || dl?.data?.gltf?.glb || null;
    if (preferred && /\.glb$/i.test(preferred)) tryOnSupported = true;
  } catch (err) {
    console.warn('Sketchfab download failed (tryOn check) for', uid, err && err.message);
  }

  return { preferred, tryOnSupported };
}

// GET /api/wardrobe/:email - return outfitGlbUrl on User if present (simplified)
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Fetch wardrobe items stored in WardrobeItem collection
    const items = await WardrobeItem.find({ user: user._id }).lean().catch(() => []);

    function mapWardrobeDocsToItems(docs) {
      return (docs || []).map(i => ({
        id: i.itemId || i._id,
        name: i.itemName || i.metadata?.name || 'Outfit',
        description: i.metadata?.description || '',
        modelUrl: i.itemUrl,
        metadata: i.metadata || {},
        preferredModelUrl: i.itemUrl
      }));
    }

    const mappedItems = mapWardrobeDocsToItems(items);
    if (user.outfitGlbUrl) {
      mappedItems.push({ id: 'user-saved', name: 'Saved outfit', modelUrl: user.outfitGlbUrl, preferredModelUrl: user.outfitGlbUrl, description: 'Outfit saved to profile' });
    }

    // Attempt to resolve preferredModelUrl for items that may point to Sketchfab or GLTF
    const token = process.env.SKETCHFAB_API_TOKEN;
    await Promise.all(mappedItems.map(it => resolvePreferredForItem(it, token)));

    return res.json({ items: mappedItems });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch wardrobe' });
  }
});

// GET /api/wardrobe/sketchfab/resolve/:uid - Resolve GLB URL for a specific Sketchfab model
router.get('/sketchfab/resolve/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const token = process.env.SKETCHFAB_API_TOKEN;
    
    if (!uid) {
      return res.status(400).json({ error: 'Model UID required' });
    }
    
    console.log(`🔍 Resolving GLB URL for Sketchfab model: ${uid}`);
    const { preferred, tryOnSupported } = await resolveModelTryOn(uid, token);
    
    if (preferred) {
      console.log(`✅ Found GLB URL for ${uid}: ${preferred}`);
      
      // Check if it's a ZIP file (Sketchfab often provides ZIP archives)
      if (preferred.includes('.zip')) {
        console.log(`⚠️ URL is a ZIP archive, not a direct GLB file`);
        return res.json({ 
          glbUrl: preferred, 
          tryOnSupported: false,
          success: false,
          isZip: true,
          message: 'This model is provided as a ZIP archive. Download and extraction would be required. Try another model with direct GLB support.'
        });
      }
      
      return res.json({ 
        glbUrl: preferred, 
        tryOnSupported,
        success: true,
        isZip: false
      });
    } else {
      console.log(`⚠️ No GLB URL found for ${uid}`);
      return res.json({ 
        glbUrl: null, 
        tryOnSupported: false,
        success: false,
        message: 'No downloadable GLB file available for this model'
      });
    }
  } catch (err) {
    console.error('GLB resolution error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to resolve GLB URL', details: err?.message || err });
  }
});

// GET /api/wardrobe/sketchfab/download/:uid - Download and convert Sketchfab model to GLB
router.get('/sketchfab/download/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const token = process.env.SKETCHFAB_API_TOKEN;
    
    if (!uid) {
      return res.status(400).json({ error: 'Model UID required' });
    }
    
    console.log(`📥 Attempting to download Sketchfab model: ${uid}`);
    
    // First, get the model's download info
    const headers = token ? { 'Authorization': `Token ${token}` } : {};
    const modelResponse = await axios.get(`https://api.sketchfab.com/v3/models/${uid}/download`, {
      headers,
      timeout: 10000
    });
    
    const downloadData = modelResponse.data;
    console.log(`📦 Download data:`, downloadData);
    
    // Look for GLTF or GLB format
    const gltfFormat = downloadData.gltf || downloadData.glb;
    if (!gltfFormat || !gltfFormat.url) {
      console.log(`⚠️ No GLTF/GLB download available for ${uid}`);
      return res.json({ 
        success: false,
        message: 'This model does not have a downloadable GLTF/GLB format'
      });
    }
    
    const downloadUrl = gltfFormat.url;
    console.log(`✅ Found download URL: ${downloadUrl}`);
    
    // Check if it's a ZIP file
    if (downloadUrl.includes('.zip') || downloadUrl.includes('archive')) {
      console.log(`⚠️ Download is a ZIP archive, not direct GLB`);
      
      // For ZIP files, we'd need to download, extract, and convert
      // For now, return the URL and let the frontend know it needs processing
      return res.json({
        success: false,
        glbUrl: downloadUrl,
        isZip: true,
        message: 'This model is provided as a ZIP archive. Direct overlay not supported. Try another model.'
      });
    }
    
    // If it's a direct GLB, return the URL
    if (downloadUrl.endsWith('.glb')) {
      console.log(`✅ Direct GLB file available`);
      return res.json({
        success: true,
        glbUrl: downloadUrl,
        isZip: false
      });
    }
    
    // If it's GLTF, we could convert it (but this requires downloading dependencies)
    // For now, try to return the GLTF URL and let model-viewer handle it
    if (downloadUrl.endsWith('.gltf')) {
      console.log(`✅ GLTF file available (model-viewer can handle it)`);
      return res.json({
        success: true,
        glbUrl: downloadUrl,
        isZip: false,
        isGltf: true
      });
    }
    
    // Unknown format
    return res.json({
      success: false,
      message: 'Unknown model format'
    });
    
  } catch (err) {
    console.error('Sketchfab download error:', err?.message || err);
    const status = err?.response?.status;
    
    if (status === 403 || status === 401) {
      return res.status(403).json({ 
        error: 'Authentication required or model not downloadable',
        success: false,
        message: 'This model requires authentication or is not available for download'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to download Sketchfab model', 
      details: err?.message || err,
      success: false
    });
  }
});

// New: search Sketchfab models and return resolved items (GLB when possible)
router.get('/sketchfab/search', async (req, res) => {
  const q = req.query.q || 'clothing fashion'; // Broader default search
  const token = process.env.SKETCHFAB_API_TOKEN;
  
  console.log(`🔍 Sketchfab search request: query="${q}"`);
  
  try {
    // Allow configurable caps via env vars to avoid unbounded fetching
    const MAX_PAGES = Math.max(1, Number.parseInt(process.env.SKETCHFAB_SEARCH_MAX_PAGES || '3', 10));
    const PER_PAGE = Math.max(6, Number.parseInt(process.env.SKETCHFAB_SEARCH_PER_PAGE || '24', 10));

    // Try direct Sketchfab API call (public + authenticated)
    async function fetchSketchfabPage(page) {
      const params = {
        q: q,
        type: 'models',
        downloadable: true, // Only get downloadable models
        page: page,
        count: PER_PAGE,
        sort_by: '-likeCount' // Most popular first
        // Removed categories filter to get more results
      };

      // Try with authentication header if token exists
      const headers = token ? { 'Authorization': `Token ${token}` } : {};
      
      console.log(`📡 Fetching Sketchfab page ${page} with params:`, params);
      
      const response = await axios.get('https://api.sketchfab.com/v3/models', {
        params,
        headers,
        timeout: 10000
      });

      return response.data;
    }

    // Accumulate results across pages and deduplicate by UID
    async function accumulateModels() {
      const acc = new Map();
      
      for (let page = 1; page <= MAX_PAGES; page++) {
        try {
          const data = await fetchSketchfabPage(page);
          const models = data?.results;
          
          // Debug logging
          console.log(`✅ Sketchfab page ${page} response:`, {
            resultsCount: Array.isArray(models) ? models.length : 0,
            totalResults: data?.cursors?.total || data?.count || 'unknown',
            next: data?.cursors?.next || data?.next || 'none'
          });
          
          // Guard: ensure models is an array before iterating
          if (!Array.isArray(models) || models.length === 0) {
            console.log(`⚠️ Sketchfab page ${page}: no results`);
            break;
          }
          
          for (const m of models) {
            if (m && m.uid && !acc.has(m.uid)) {
              acc.set(m.uid, m);
              console.log(`  ✓ Added model: ${m.name} (${m.uid})`);
            }
          }
          
          // Stop if no more pages
          if (!data?.cursors?.next && !data?.next) break;
          if (models.length < PER_PAGE) break;
          
          // Rate limiting - wait 500ms between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error_) {
          console.error(`❌ Error fetching Sketchfab page ${page}:`, {
            message: error_?.message,
            status: error_?.response?.status,
            statusText: error_?.response?.statusText,
            responseData: error_?.response?.data
          });
          
          // If first page fails, return empty to avoid breaking the app
          if (page === 1) {
            console.log('⚠️ First page failed - API may be rate limited or token invalid');
          }
          break;
        }
      }
      
      return Array.from(acc.values());
    }

    const byUidList = await accumulateModels();

    const items = [];
    // For each model, add basic info with Sketchfab viewer URL for direct embedding
    for (const m of byUidList) {
      const title = m.name || m.title || 'Sketchfab outfit';
      
      // Create Sketchfab embed URL for iframe viewing (no download needed!)
      const embedUrl = `https://sketchfab.com/models/${m.uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=1&ui_watermark=0&dnt=1`;
      
      items.push({ 
        id: m.uid, 
        name: title, 
        thumbnail: m.thumbnails?.images?.[0]?.url || m.representation?.thumbnail, 
        modelUrl: embedUrl,  // Direct embed URL - no download needed!
        sketchfabUrl: m.viewerUrl || m.viewer_url,  // Original Sketchfab page
        preferredModelUrl: embedUrl,  // Use embed as preferred
        tryOnSupported: true,  // Can be viewed via iframe
        isEmbed: true,  // Flag to indicate this uses Sketchfab embed
        needsGlbResolution: false  // No need to resolve - embed works directly
      });
      
      console.log(`✓ Added model: ${title}`);
    }

    console.log(`✅ Returning ${items.length} Sketchfab models`);
    return res.json({ items });
  } catch (err) {
    console.error('Sketchfab search error:', err?.message || err);
    return res.status(502).json({ error: 'Sketchfab search failed', details: err?.message || err });
  }
});

export default router;