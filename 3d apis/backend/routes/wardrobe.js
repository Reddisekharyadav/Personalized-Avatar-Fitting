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

export default router;

// New: search Sketchfab models and return resolved items (GLB when possible)
router.get('/sketchfab/search', async (req, res) => {
  const q = req.query.q || 'clothes';
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'SKETCHFAB_API_TOKEN not configured' });
  try {
    // Use rate-limited search helper if available
    const { searchModelsWithRateLimit } = await import('../utils/rateLimiter.js');

    // Allow configurable caps via env vars to avoid unbounded fetching
    const MAX_PAGES = Math.max(1, parseInt(process.env.SKETCHFAB_SEARCH_MAX_PAGES || '5', 10));
    const PER_PAGE = Math.max(6, parseInt(process.env.SKETCHFAB_SEARCH_PER_PAGE || '24', 10));

    // Accumulate results across pages and deduplicate by UID
    async function accumulateModels() {
      const acc = new Map();
      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await searchModelsWithRateLimit({ q, page, per_page: PER_PAGE }, token);
        const models = response?.data?.results || [];
        if (!models || models.length === 0) break;
        for (const m of models) if (m && m.uid && !acc.has(m.uid)) acc.set(m.uid, m);
        if (models.length < PER_PAGE) break;
      }
      return Array.from(acc.values());
    }

    const byUidList = await accumulateModels();

    const items = [];
    // For each model, attempt to mark tryOnSupported when a direct GLB URL is found
    for (const m of byUidList) {
      const title = m.name || m.title || 'Sketchfab outfit';
      const { preferred, tryOnSupported } = await resolveModelTryOn(m.uid, token);
      items.push({ id: m.uid, name: title, thumbnail: m.thumbnails?.images?.[0]?.url || m.representation?.thumbnail, modelUrl: m.viewerUrl || m.viewer_url, preferredModelUrl: preferred, tryOnSupported });
    }

    return res.json({ items });
  } catch (err) {
    console.error('Sketchfab search error:', err?.message || err);
    return res.status(502).json({ error: 'Sketchfab search failed', details: err?.message || err });
  }
});
