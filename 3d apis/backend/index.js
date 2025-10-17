import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
// AdmZip already imported above
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import wardrobeRoutes from './routes/wardrobe.js';
import sketchfabRoutes from './routes/sketchfab.js';
import tryon2dRoutes from './routes/tryon2d.js';
import modelResourceHelper from './utils/modelResourceHelper.js';

dotenv.config();

// Setup model caching system
const setupModelCache = () => {
  const cacheDir = path.join(process.cwd(), 'model-cache');
  
  // Create main cache directory if needed
  try { 
    fs.mkdirSync(cacheDir, { recursive: true }); 
    console.log('Created model cache directory:', cacheDir);
  } catch (e) { 
    console.log('Cache directory already exists:', cacheDir);
  }
  
  // Create directories for different types of assets
  const binDir = path.join(cacheDir, 'bin');
  const texturesDir = path.join(cacheDir, 'textures');
  const modelsDir = path.join(cacheDir, 'models');
  
  try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) { /* ignore */ }
  try { fs.mkdirSync(texturesDir, { recursive: true }); } catch (e) { /* ignore */ }
  try { fs.mkdirSync(modelsDir, { recursive: true }); } catch (e) { /* ignore */ }
  
  console.log('Model cache system initialized with directories:');
  console.log('- Bin files:', binDir);
  console.log('- Textures:', texturesDir);
  console.log('- Models:', modelsDir);
  
  return {
    cacheDir,
    binDir,
    texturesDir,
    modelsDir,
    
    // Get cache path for an asset
    getCachePath: (assetType, filename) => {
      switch (assetType) {
        case 'bin':
          return path.join(binDir, filename);
        case 'texture':
          return path.join(texturesDir, filename);
        case 'model':
          return path.join(modelsDir, filename);
        default:
          return path.join(cacheDir, filename);
      }
    },
    
    // Check if asset exists in cache
    hasAsset: (assetType, filename) => {
      const cachePath = path.join(
        assetType === 'bin' ? binDir : 
        assetType === 'texture' ? texturesDir : 
        assetType === 'model' ? modelsDir :
        cacheDir,
        filename
      );
      return fs.existsSync(cachePath);
    },
    
    // Save asset to cache
    saveAsset: (assetType, filename, data) => {
      const cachePath = path.join(
        assetType === 'bin' ? binDir : 
        assetType === 'texture' ? texturesDir : 
        assetType === 'model' ? modelsDir :
        cacheDir,
        filename
      );
      fs.writeFileSync(cachePath, data);
      console.log(`Cached ${assetType} asset: ${filename}`);
      return cachePath;
    },
    
    // Get asset from cache
    getAsset: (assetType, filename) => {
      const cachePath = path.join(
        assetType === 'bin' ? binDir : 
        assetType === 'texture' ? texturesDir : 
        assetType === 'model' ? modelsDir :
        cacheDir,
        filename
      );
      if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath);
      }
      return null;
    }
  };
};

const modelCache = setupModelCache();

// Helper: normalize/copy image assets referenced by a .gltf file so relative URIs resolve.
async function normalizeGltfAssets(gltfAbsolutePath) {
  // Try to ensure the .gltf's image URIs resolve by copying or rewriting image URIs to real files.
  // Returns a mapping { originalUri: finalUri } for debugging.
  try {
    if (!fs.existsSync(gltfAbsolutePath)) return null;
    const dir = path.dirname(gltfAbsolutePath);
    const txt = await fs.promises.readFile(gltfAbsolutePath, 'utf8');
    let obj = null;
    try { obj = JSON.parse(txt); } catch (e) { return null; }
  const images = (obj.images || []).map(img => img.uri).filter(Boolean);
  const buffersUris = (obj.buffers || []).map(b => b.uri).filter(Boolean);
    if (!images.length) return null;

    // gather candidate files recursively under dir
    const walk = (d) => {
      const map = {};
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const it of items) {
        const p = path.join(d, it.name);
        if (it.isDirectory()) {
          const inner = walk(p);
          Object.assign(map, inner);
        } else if (it.isFile()) {
          map[it.name] = p;
        }
      }
      return map;
    };

    const candidates = walk(dir);
    const mapping = {};

    // Helper to choose best candidate for a missing basename
    const chooseBestCandidate = (basename) => {
      const lower = basename.toLowerCase();
      // exact basename
      if (candidates[basename]) return candidates[basename];
      // substring match (token based)
      const token = lower.split(/[^a-z0-9]+/).filter(Boolean)[0] || lower;
      let found = Object.keys(candidates).find(k => k.toLowerCase().includes(token));
      if (found) return candidates[found];
      // fallback: find candidate with longest common substring
      let best = null, bestScore = 0;
      for (const k of Object.keys(candidates)) {
        const a = k.toLowerCase(), b = lower;
        // simple score: count of common characters in order
        let score = 0, i = 0, j = 0;
        while (i < a.length && j < b.length) {
          if (a[i] === b[j]) { score++; i++; j++; }
          else { i++; }
        }
        if (score > bestScore) { bestScore = score; best = k; }
      }
      if (best && bestScore > Math.max(3, Math.floor(b.length / 4))) return candidates[best];
      return null;
    };

    // First try to normalize binary buffers (scene.bin etc.) so buffer URIs resolve
    for (const uri of buffersUris) {
      if (!uri) continue;
      const basename = path.basename(uri);
      const targetPath = path.join(dir, uri);
      if (fs.existsSync(targetPath)) {
        mapping[uri] = uri;
        continue;
      }

      // Try to find a candidate .bin file
      let candidate = Object.keys(candidates).find(k => k.toLowerCase().endsWith('.bin'));
      // prefer exact basename match
      if (candidates[basename]) candidate = basename;
      if (candidate) {
        try {
          const candidatePath = candidates[candidate] || candidate;
          const destDir = path.dirname(targetPath);
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(candidatePath, targetPath);
          mapping[uri] = uri;
          continue;
        } catch (e) {
          console.warn('normalize buffer copy failed', e?.message || e);
        }
      }

      // fallback: try fuzzy match based on basename
      const fuzzy = chooseBestCandidate(basename);
      if (fuzzy) {
        try {
          const relToDir = path.relative(dir, fuzzy).split(path.sep).join('/');
          // update buffer uri to point to the discovered relative path
          for (let i = 0; i < (obj.buffers || []).length; i++) {
            if (obj.buffers[i] && obj.buffers[i].uri === uri) {
              obj.buffers[i].uri = relToDir;
              mapping[uri] = relToDir;
            }
          }
          // also copy candidate into avatars root for absolute requests
          try {
            const avatarsRoot = path.join(process.cwd(), 'avatars');
            const fallbackPath = path.join(avatarsRoot, path.basename(fuzzy));
            fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
            if (!fs.existsSync(fallbackPath)) fs.copyFileSync(fuzzy, fallbackPath);
          } catch (e) { /* non-fatal */ }
          continue;
        } catch (e) {
          console.warn('normalize buffer rewrite failed', e?.message || e);
        }
      }

      mapping[uri] = null;
    }

    // Then normalize images (textures)
    for (const uri of images) {
      const basename = path.basename(uri);
      const targetPath = path.join(dir, uri);
      if (fs.existsSync(targetPath)) {
        mapping[uri] = uri; // unchanged
        continue;
      }

      // First try to copy an exact or fuzzy candidate into the expected path
      let candidate = chooseBestCandidate(basename);
      if (candidate) {
        try {
          const rel = path.relative(dir, candidate).split(path.sep).join('/');
          // If expected path already includes subfolder (textures/...), create that dir
          const destDir = path.dirname(targetPath);
          fs.mkdirSync(destDir, { recursive: true });
          // copy file into expected path
          fs.copyFileSync(candidate, targetPath);
          mapping[uri] = uri; // copied to expected place

          // Additionally copy a fallback into avatars/textures/<basename> so absolute
          // requests like /avatars/textures/<basename> will resolve from the top-level
          try {
            const avatarsRoot = path.join(process.cwd(), 'avatars');
            const avatarsTexturesDir = path.join(avatarsRoot, 'textures');
            fs.mkdirSync(avatarsTexturesDir, { recursive: true });
            const fallbackPath = path.join(avatarsTexturesDir, basename);
            if (!fs.existsSync(fallbackPath)) {
              fs.copyFileSync(candidate, fallbackPath);
            }
          } catch (e) {
            // non-fatal
            console.warn('normalize: failed to write avatars/textures fallback', e?.message || e);
          }

          continue;
        } catch (e) {
          // copying failed; we'll attempt rewrite below
        }
      }

      // If we couldn't copy into the expected path, try rewriting the glTF image URI to point to the candidate's relative path
      if (!candidate) candidate = chooseBestCandidate(basename);
      if (candidate) {
        const relToDir = path.relative(dir, candidate).split(path.sep).join('/');
        // Update the obj.images entries that match this original uri
        for (let i = 0; i < (obj.images || []).length; i++) {
          if (obj.images[i] && obj.images[i].uri === uri) {
            obj.images[i].uri = relToDir;
            mapping[uri] = relToDir;
          }
        }
        // Also ensure a top-level avatars/textures/<basename> exists for absolute texture requests
        try {
          const avatarsRoot = path.join(process.cwd(), 'avatars');
          const avatarsTexturesDir = path.join(avatarsRoot, 'textures');
          fs.mkdirSync(avatarsTexturesDir, { recursive: true });
          const basename = path.basename(candidate);
          const fallbackPath = path.join(avatarsTexturesDir, basename);
          if (!fs.existsSync(fallbackPath)) {
            fs.copyFileSync(candidate, fallbackPath);
          }
        } catch (e) {
          console.warn('normalize: failed to write avatars/textures fallback (rewrite)', e?.message || e);
        }
      } else {
        // No candidate found, leave as-is but note missing
        mapping[uri] = null;
        // Create a tiny transparent PNG fallback under avatars/textures/<basename>
        try {
          const avatarsRoot = path.join(process.cwd(), 'avatars');
          const avatarsTexturesDir = path.join(avatarsRoot, 'textures');
          fs.mkdirSync(avatarsTexturesDir, { recursive: true });
          const fallbackBasename = path.basename(uri);
          const fallbackPath = path.join(avatarsTexturesDir, fallbackBasename);
          if (!fs.existsSync(fallbackPath)) {
            // 1x1 transparent PNG
            const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
            const buf = Buffer.from(tinyPngBase64, 'base64');
            fs.writeFileSync(fallbackPath, buf);
          }
          // Also ensure the glTF's expected relative path exists (targetPath) so relative URI loads
          try {
            const destDir = path.dirname(targetPath);
            fs.mkdirSync(destDir, { recursive: true });
            if (!fs.existsSync(targetPath)) {
              fs.copyFileSync(fallbackPath, targetPath);
            }
            // rewrite obj image URI to point to textures/<basename> so relative/absolute both work
            for (let i = 0; i < (obj.images || []).length; i++) {
              if (obj.images[i] && obj.images[i].uri === uri) {
                obj.images[i].uri = path.posix.join('textures', fallbackBasename);
                mapping[uri] = path.posix.join('textures', fallbackBasename);
              }
            }
          } catch (e) {
            console.warn('normalize: failed to create target fallback', e?.message || e);
          }
        } catch (e) {
          console.warn('normalize: failed to write avatars/textures fallback (missing)', e?.message || e);
        }
      }
    }

    // If we changed any URIs, write the glTF back
    try {
      await fs.promises.writeFile(gltfAbsolutePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to write updated glTF', e?.message || e);
    }

    return mapping;
  } catch (err) {
    console.warn('normalizeGltfAssets error', err?.message || err);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
// Permissions-Policy header: allow accelerometer/gyroscope for same-origin embeds
app.use((req, res, next) => {
  // adjust origins as needed; here we allow same-origin (self)
  res.setHeader('Permissions-Policy', "accelerometer=(self), gyroscope=(self)");
  next();
});

// Serve static files from avatars directory
app.use('/avatars', express.static(path.join(process.cwd(), 'avatars')));

// Add dedicated routes for texture and bin files to ensure proper loading
app.use('/textures', express.static(path.join(process.cwd(), 'avatars', 'textures')));
app.use('/bin', express.static(path.join(process.cwd(), 'avatars', 'bin')));

// Specific route for texture files - high priority
app.get('/textures/:filename', (req, res) => {
  const { filename } = req.params;
  if (!filename) return res.status(404).send('Texture filename not specified');
  
  // Check in the central textures directory first
  const texturePath = path.join(process.cwd(), 'avatars', 'textures', filename);
  if (fs.existsSync(texturePath)) {
    console.log(`Serving texture from central location: ${texturePath}`);
    
    // Set content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') res.setHeader('Content-Type', 'image/png');
    else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
    else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
    
    return res.sendFile(texturePath);
  }
  
  // If not found in central location, check model cache
  const cacheTexturePath = modelCache.getCachePath('texture', filename);
  if (fs.existsSync(cacheTexturePath)) {
    console.log(`Serving texture from cache: ${cacheTexturePath}`);
    
    // Set content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') res.setHeader('Content-Type', 'image/png');
    else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
    else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
    
    return res.sendFile(cacheTexturePath);
  }
  
  // Not found in any location
  res.status(404).send(`Texture ${filename} not found`);
});

// Specific route for scene.bin file - high priority
app.get('/scene.bin', (req, res) => {
  const binPath = path.join(process.cwd(), 'avatars', 'bin', 'scene.bin');
  if (fs.existsSync(binPath)) {
    console.log(`Serving scene.bin from central location: ${binPath}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(binPath);
  }
  
  // If not found in central location, check model cache
  const cacheBinPath = modelCache.getCachePath('bin', 'scene.bin');
  if (fs.existsSync(cacheBinPath)) {
    console.log(`Serving scene.bin from cache: ${cacheBinPath}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(cacheBinPath);
  }
  
  // Not found
  res.status(404).send('scene.bin not found');
});

// Auth routes (must be after app is initialized)
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/sketchfab', sketchfabRoutes);
app.use('/api/tryon2d', tryon2dRoutes);

// Helper to finalize a downloaded/extracted asset: normalize glTF assets, optionally persist to user, and send response
async function finalizeDownload({ req, res, relPath, absolutePath, email, cached = false }) {
  try {
    // If we have an absolute path to a .gltf, run normalize and return mapping
    let mapping = null;
    if (absolutePath && absolutePath.toLowerCase().endsWith('.gltf')) {
      try { mapping = await normalizeGltfAssets(absolutePath); } catch (e) { console.warn('normalizeGltfAssets failed', e); }
    }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    const encoded = relPath.split('/').map(encodeURIComponent).join('/');
    const url = `${protocol}://${host}/avatars/${encoded}`;

    if (email) {
      try {
        await User.findOneAndUpdate({ email }, { $set: { outfitGlbUrl: url } }, { upsert: true });
        console.log('[outfits] persisted outfit for', email, url);
      } catch (e) { console.warn('Failed to persist outfit to user', e); }
    }

    console.log('[outfits] returning', { url, relPath, cached });

    // If normalization detected missing buffers (mapping contains null for buffers)
    // attempt to produce a packed .glb fallback when possible.
    try {
      const missingBuffer = mapping && Object.values(mapping).some(v => v === null);
      if (missingBuffer && absolutePath && absolutePath.toLowerCase().endsWith('.gltf')) {
        // Try optional packing using gltf-pipeline (if installed). This is best-effort.
        try {
          // Dynamically require to avoid hard dependency at startup
          const gltfPipeline = await import('gltf-pipeline');
          const { processGltf } = gltfPipeline;
          const gltfData = JSON.parse(await fs.promises.readFile(absolutePath, 'utf8'));
          const gltfDir = path.dirname(absolutePath);
          // Read any external resources into memory via relative paths
          // gltf-pipeline expects options with resourceDirectory
          const resOpt = { resourceDirectory: gltfDir };
          const result = await processGltf(gltfData, resOpt);
          if (result && result.glb) {
            const outGlb = absolutePath.replace(/\.gltf$/i, '.packed.glb');
            await fs.promises.writeFile(outGlb, result.glb);
            // expose the packed .glb as the public URL (same relPath but .packed.glb)
            const packedRel = relPath.replace(/\.gltf$/i, '.packed.glb');
            const packedEncoded = packedRel.split('/').map(encodeURIComponent).join('/');
            const packedUrl = `${protocol}://${host}/avatars/${packedEncoded}`;
            // copy packed file into avatars root if not already under it
            // (absolutePath already under avatars)
            if (email) {
              try { await User.findOneAndUpdate({ email }, { $set: { outfitGlbUrl: packedUrl } }, { upsert: true }); } catch (e) {}
            }
            console.log('[outfits] produced packed glb fallback', packedUrl);
            return res.json({ success: true, url: packedUrl, relPath: packedRel, cached: !!cached, mapping });
          }
        } catch (packErr) {
          console.warn('GLTF->GLB packing not available or failed', packErr?.message || packErr);
        }
      }
    } catch (e) {
      console.warn('Packing attempt failed', e?.message || e);
    }

    return res.json({ success: true, url, relPath, cached: !!cached, mapping });
  } catch (err) {
    console.error('finalizeDownload failed', err);
    return res.json({ success: false, error: err?.message || err });
  }
}

// Serve locally downloaded avatar assets with a fallback resolver.
const avatarsDir = path.join(process.cwd(), 'avatars');
try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch (e) { /* ignore */ }

// Middleware for serving model assets with dependency support
app.use('/model-assets', async (req, res, next) => {
  try {
    const relPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
    
    // Log all model asset requests to help debug
    console.log(`[model-assets] Request for: ${relPath}`);
    
    // Check if this is a scene.bin file request
    const isBinFile = relPath === 'scene.bin' || relPath.endsWith('/scene.bin');
    
    // Check if this is a texture file request
    const isTextureFile = relPath.startsWith('textures/') || 
                          relPath.includes('/textures/') ||
                          relPath.match(/\.(png|jpg|jpeg|webp)$/i);
    
    // Determine asset type
    let assetType = 'other';
    if (isBinFile) {
      assetType = 'bin';
    } else if (isTextureFile) {
      assetType = 'texture';
    } else if (relPath.match(/\.(gltf|glb)$/i)) {
      assetType = 'model';
    }
    
    // For texture files, first check in our dedicated textures directory
    if (isTextureFile) {
      // Create textures directory if it doesn't exist
      const mainTexturesDir = path.join(process.cwd(), 'avatars', 'textures');
      try { fs.mkdirSync(mainTexturesDir, { recursive: true }); } catch (e) { /* ignore */ }
      
      const fileName = path.basename(relPath);
      const mainTexturePath = path.join(mainTexturesDir, fileName);
      
      // Check if we have the texture in the main textures directory
      if (fs.existsSync(mainTexturePath)) {
        console.log(`[model-assets] Found texture in main textures directory: ${mainTexturePath}`);
        const ext = path.extname(fileName).toLowerCase();
        if (ext === '.png') res.setHeader('Content-Type', 'image/png');
        else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
        else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
        
        return res.sendFile(mainTexturePath);
      }
    }
    
    // Special handling for scene.bin - look in all model-specific directories
    if (isBinFile) {
      console.log(`[model-assets] Searching for scene.bin in all model directories`);
      
      // Check in the cache directories first
      const cacheBinPath = modelCache.getCachePath('bin', 'scene.bin');
      if (fs.existsSync(cacheBinPath)) {
        console.log(`[model-assets] Found scene.bin in cache: ${cacheBinPath}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(cacheBinPath);
      }
      
      // If not found in cached directories, check all model directories
      const allDirs = fs.readdirSync(avatarsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(avatarsDir, dirent.name));
      
      for (const modelDir of allDirs) {
        const binPath = path.join(modelDir, 'scene.bin');
        if (fs.existsSync(binPath)) {
          console.log(`[model-assets] Found scene.bin in ${modelDir}`);
          res.setHeader('Content-Type', 'application/octet-stream');
          
          try {
            const data = fs.readFileSync(binPath);
            modelCache.saveAsset('bin', 'scene.bin', data);
          } catch (e) {
            console.error(`[model-assets] Error caching bin file: ${e.message}`);
          }
          
          return res.sendFile(binPath);
        }
      }
    }
    
    // Special handling for texture files - look in all model-specific texture directories
    if (isTextureFile) {
      const fileName = path.basename(relPath);
      console.log(`[model-assets] Searching for texture: ${fileName} in all model directories`);
      
      // First look in textures subfolder of each model's cached directory
      const modelDirs = fs.readdirSync(avatarsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name.includes('-cached'))
        .map(dirent => path.join(avatarsDir, dirent.name));
      
      for (const modelDir of modelDirs) {
        const texturesDir = path.join(modelDir, 'textures');
        if (fs.existsSync(texturesDir) && fs.statSync(texturesDir).isDirectory()) {
          const texturePath = path.join(texturesDir, fileName);
          if (fs.existsSync(texturePath)) {
            console.log(`[model-assets] Found texture in ${texturePath}`);
            
            const ext = path.extname(fileName).toLowerCase();
            if (ext === '.png') res.setHeader('Content-Type', 'image/png');
            else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
            else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
            
            try {
              const data = fs.readFileSync(texturePath);
              modelCache.saveAsset('texture', fileName, data);
            } catch (e) {
              console.error(`[model-assets] Error caching texture: ${e.message}`);
            }
            
            return res.sendFile(texturePath);
          }
        }
      }
      
      // If not found in cached directories, check all model directories
      const allDirs = fs.readdirSync(avatarsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(avatarsDir, dirent.name));
      
      for (const modelDir of allDirs) {
        const texturesDir = path.join(modelDir, 'textures');
        if (fs.existsSync(texturesDir) && fs.statSync(texturesDir).isDirectory()) {
          const texturePath = path.join(texturesDir, fileName);
          if (fs.existsSync(texturePath)) {
            console.log(`[model-assets] Found texture in ${texturePath}`);
            
            const ext = path.extname(fileName).toLowerCase();
            if (ext === '.png') res.setHeader('Content-Type', 'image/png');
            else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
            else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
            
            try {
              const data = fs.readFileSync(texturePath);
              modelCache.saveAsset('texture', fileName, data);
            } catch (e) {
              console.error(`[model-assets] Error caching texture: ${e.message}`);
            }
            
            return res.sendFile(texturePath);
          }
        }
      }
    }
    
    // Check if we have this specific file in the cache
    if (modelCache.hasAsset(assetType, path.basename(relPath))) {
      console.log(`[model-assets] Found in ${assetType} cache: ${relPath}`);
      const data = modelCache.getAsset(assetType, path.basename(relPath));
      
      // Set appropriate content type
      if (isBinFile) {
        res.setHeader('Content-Type', 'application/octet-stream');
      } else if (isTextureFile) {
        // Set content type based on file extension
        const ext = path.extname(relPath).toLowerCase();
        if (ext === '.png') res.setHeader('Content-Type', 'image/png');
        else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
        else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
      } else if (relPath.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      } else if (relPath.endsWith('.gltf')) {
        res.setHeader('Content-Type', 'model/gltf+json');
      }
      
      return res.send(data);
    }
    
    // Create a record of what we've looked for to avoid circular searching
    const searchedLocations = [];
    
    // First try the exact path in avatars directory
    const avatarsFilePath = path.join(avatarsDir, relPath);
    searchedLocations.push(avatarsFilePath);
    
    // Also try looking for the file directly in the avatars root (without subdirectory)
    // This is needed when front-end passes just the filename
    const fileName = path.basename(relPath);
    const directFilePath = path.join(avatarsDir, fileName);
    searchedLocations.push(directFilePath);
    
    // Check if the file exists at the direct path
    if (fs.existsSync(directFilePath) && fs.statSync(directFilePath).isFile()) {
      console.log(`[model-assets] Serving file directly from avatars root: ${directFilePath}`);
      
      // If it's a cacheable asset type, cache it
      if (assetType !== 'other') {
        try {
          const data = fs.readFileSync(directFilePath);
          modelCache.saveAsset(assetType, path.basename(relPath), data);
        } catch (e) {
          console.error(`[model-assets] Error caching file: ${e.message}`);
        }
      }
      
      // Set appropriate content type
      if (isBinFile) {
        res.setHeader('Content-Type', 'application/octet-stream');
      } else if (isTextureFile) {
        const ext = path.extname(relPath).toLowerCase();
        if (ext === '.png') res.setHeader('Content-Type', 'image/png');
        else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
        else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
      } else if (relPath.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      } else if (relPath.endsWith('.gltf')) {
        res.setHeader('Content-Type', 'model/gltf+json');
      }
      
      return res.sendFile(directFilePath);
    }
    
    // Check if file exists at the original full path
    if (fs.existsSync(avatarsFilePath) && fs.statSync(avatarsFilePath).isFile()) {
      console.log(`[model-assets] Serving file directly: ${avatarsFilePath}`);
      
      // If it's a cacheable asset type, cache it
      if (assetType !== 'other') {
        try {
          const data = fs.readFileSync(avatarsFilePath);
          modelCache.saveAsset(assetType, path.basename(relPath), data);
        } catch (e) {
          console.error(`[model-assets] Error caching file: ${e.message}`);
        }
      }
      
      // Set appropriate content type
      if (isBinFile) {
        res.setHeader('Content-Type', 'application/octet-stream');
      } else if (isTextureFile) {
        // Set content type based on file extension
        const ext = path.extname(relPath).toLowerCase();
        if (ext === '.png') res.setHeader('Content-Type', 'image/png');
        else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
        else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
      } else if (relPath.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      } else if (relPath.endsWith('.gltf')) {
        res.setHeader('Content-Type', 'model/gltf+json');
      }
      
      return res.sendFile(avatarsFilePath);
    }
    
    // If not in specific cache, look in base cache dir
    const baseCachePath = path.join(modelCache.cacheDir, path.basename(relPath));
    if (fs.existsSync(baseCachePath)) {
      console.log(`[model-assets] Serving from base cache: ${baseCachePath}`);
      return res.sendFile(baseCachePath);
    }
    
    // If we can't find the exact file, try searching in model directories for dependencies
    // This is especially important for scene.bin and texture files
    if (isBinFile || isTextureFile) {
      console.log(`[model-assets] Searching for dependency: ${relPath}`);
      
      // First, check if the request includes a model identifier
      const parts = relPath.split('/');
      const modelId = parts[0];
      
      if (modelId && modelId.length > 0) {
        // Check if we have a directory for this model
        const modelDir = path.join(avatarsDir, modelId);
        
        if (fs.existsSync(modelDir) && fs.statSync(modelDir).isDirectory()) {
          console.log(`[model-assets] Searching in model directory: ${modelDir}`);
          
          // Check for cached version of this model folder
          const cachedModelDir = path.join(avatarsDir, `${modelId}-cached`);
          
          if (fs.existsSync(cachedModelDir) && fs.statSync(cachedModelDir).isDirectory()) {
            console.log(`[model-assets] Searching in cached model directory: ${cachedModelDir}`);
            
            // For scene.bin files
            if (isBinFile) {
              const binPath = path.join(cachedModelDir, 'scene.bin');
              
              if (fs.existsSync(binPath)) {
                console.log(`[model-assets] Found scene.bin in cached model directory: ${binPath}`);
                
                // Cache the file for future use
                try {
                  const data = fs.readFileSync(binPath);
                  modelCache.saveAsset('bin', 'scene.bin', data);
                  
                  res.setHeader('Content-Type', 'application/octet-stream');
                  return res.sendFile(binPath);
                } catch (e) {
                  console.error(`[model-assets] Error caching bin file: ${e.message}`);
                }
              }
            }
            
            // For texture files
            if (isTextureFile) {
              const fileName = path.basename(relPath);
              
              // Try in the model root
              const texturePath = path.join(cachedModelDir, fileName);
              
              if (fs.existsSync(texturePath)) {
                console.log(`[model-assets] Found texture in cached model directory: ${texturePath}`);
                
                try {
                  const data = fs.readFileSync(texturePath);
                  modelCache.saveAsset('texture', fileName, data);
                  
                  const ext = path.extname(fileName).toLowerCase();
                  if (ext === '.png') res.setHeader('Content-Type', 'image/png');
                  else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
                  else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
                  
                  return res.sendFile(texturePath);
                } catch (e) {
                  console.error(`[model-assets] Error caching texture: ${e.message}`);
                }
              }
              
              // Check in textures subdirectory
              const texturesSubdir = path.join(cachedModelDir, 'textures');
              
              if (fs.existsSync(texturesSubdir) && fs.statSync(texturesSubdir).isDirectory()) {
                const textureInSubPath = path.join(texturesSubdir, fileName);
                
                if (fs.existsSync(textureInSubPath)) {
                  console.log(`[model-assets] Found texture in cached model textures subdirectory: ${textureInSubPath}`);
                  
                  try {
                    const data = fs.readFileSync(textureInSubPath);
                    modelCache.saveAsset('texture', fileName, data);
                    
                    const ext = path.extname(fileName).toLowerCase();
                    if (ext === '.png') res.setHeader('Content-Type', 'image/png');
                    else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
                    else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
                    
                    return res.sendFile(textureInSubPath);
                  } catch (e) {
                    console.error(`[model-assets] Error caching texture: ${e.message}`);
                  }
                }
              }
          
          // If not found in cached directory, check in the original model directory
          // For scene.bin files
          if (isBinFile) {
            const binPath = path.join(modelDir, 'scene.bin');
            
            if (fs.existsSync(binPath)) {
              console.log(`[model-assets] Found scene.bin in model directory: ${binPath}`);
              
              try {
                const data = fs.readFileSync(binPath);
                modelCache.saveAsset('bin', 'scene.bin', data);
                
                res.setHeader('Content-Type', 'application/octet-stream');
                return res.sendFile(binPath);
              } catch (e) {
                console.error(`[model-assets] Error caching bin file: ${e.message}`);
              }
            }
          }
        }
      }
    }
    } // <-- Add this closing brace to properly close the if (fs.existsSync(texturesSubdir) ...) block

    // If specific model directory not found, search all directories (last resort)
    // Recursive search function - limited depth to avoid performance issues
    const findAsset = (dir, assetName, maxDepth = 3, currentDepth = 0) => {
      if (currentDepth > maxDepth) return [];
      
      const results = [];
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            results.push(...findAsset(fullPath, assetName, maxDepth, currentDepth + 1));
          } else if (file.name === assetName || 
                    (assetName.includes('_baseColor') && file.name.includes('_baseColor')) ||
                    (assetName.includes('_normal') && file.name.includes('_normal')) ||
                    (assetName.includes('_emissive') && file.name.includes('_emissive'))) {
            results.push(fullPath);
          }
        }
      } catch (err) {
        console.error(`Error searching directory ${dir}:`, err);
      }
      return results;
    };
    
    // For scene.bin files
    if (isBinFile) {
      const foundBins = findAsset(avatarsDir, 'scene.bin');
      if (foundBins.length > 0) {
        console.log(`[model-assets] Found ${foundBins.length} bin files, using first one: ${foundBins[0]}`);
        
        try {
          const data = fs.readFileSync(foundBins[0]);
          modelCache.saveAsset('bin', 'scene.bin', data);
          
          res.setHeader('Content-Type', 'application/octet-stream');
          return res.sendFile(foundBins[0]);
        } catch (e) {
          console.error(`[model-assets] Error caching bin file: ${e.message}`);
        }
      }
    }
    
    // For texture files
    if (isTextureFile) {
      const fileName = path.basename(relPath);
      const foundTextures = findAsset(avatarsDir, fileName);
      if (foundTextures.length > 0) {
        console.log(`[model-assets] Found ${foundTextures.length} textures, using first one: ${foundTextures[0]}`);
        
        try {
          const data = fs.readFileSync(foundTextures[0]);
          modelCache.saveAsset('texture', fileName, data);
          
          const ext = path.extname(fileName).toLowerCase();
          if (ext === '.png') res.setHeader('Content-Type', 'image/png');
          else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
          else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
          
          return res.sendFile(foundTextures[0]);
        } catch (e) {
          console.error(`[model-assets] Error caching texture: ${e.message}`);
        }
      }
    }
  }
  
  // If nothing is found, return a 404 with helpful debug information
  console.log(`[model-assets] Could not find: ${relPath}`);
  console.log(`[model-assets] Searched locations: ${JSON.stringify(searchedLocations, null, 2)}`);
  
  // Gather information about available models and their structure for debugging
  let modelStructureInfo = {};
  try {
    // Get all directories in avatars folder
    const modelDirs = fs.readdirSync(avatarsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // For each directory, get its structure
    for (const dir of modelDirs) {
      const dirPath = path.join(avatarsDir, dir);
      let structure = { files: [] };
      
      try {
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const file of files) {
          if (file.isDirectory()) {
            // For texture directories, list their contents
            if (file.name === 'textures') {
              const textureFiles = fs.readdirSync(path.join(dirPath, 'textures'))
                .filter(name => name.match(/\.(png|jpg|jpeg|webp)$/i));
              structure.textures = textureFiles;
            }
          } else {
            structure.files.push(file.name);
          }
        }
        
        modelStructureInfo[dir] = structure;
      } catch (e) {
        modelStructureInfo[dir] = { error: e.message };
      }
    }
  } catch (e) {
    modelStructureInfo = { error: e.message };
  }
  
  return res.status(404).json({
    error: `Asset not found: ${relPath}`,
    assetType,
    searchedLocations,
    baseCachePath,
    modelCacheInfo: {
      cacheDir: modelCache.cacheDir,
      binDir: modelCache.binDir,
      texturesDir: modelCache.texturesDir,
      modelsDir: modelCache.modelsDir
    },
    availableFiles: fs.existsSync(avatarsDir) ? 
      fs.readdirSync(avatarsDir)
        .filter(file => !fs.statSync(path.join(avatarsDir, file)).isDirectory()) 
        .slice(0, 20) : [], // Limit to 20 files for readability
    modelStructureInfo
  });
} catch (err) {
  console.error('[model-assets] Error:', err);
  return res.status(500).json({ error: `Server error: ${err.message}` });
}
});

// Add API endpoint to help with model dependency resolution
app.get('/api/model/resolve-dependencies', async (req, res) => {
  try {
    const { modelId } = req.query;
    
    if (!modelId) {
      return res.status(400).json({ error: 'Missing modelId parameter' });
    }
    
    console.log(`[resolve-dependencies] Resolving dependencies for model: ${modelId}`);
    
    // Get model file path (with or without extension)
    const modelFilePattern = new RegExp(`^${modelId}.*\\.(gltf|glb)$`, 'i');
    
    // List avatars directory
    const avatarFiles = fs.readdirSync(avatarsDir, { withFileTypes: true });
    
    // Find model file
    const modelFile = avatarFiles.find(file => 
      file.isFile() && modelFilePattern.test(file.name)
    );
    
    if (!modelFile) {
      return res.status(404).json({ error: 'Model file not found' });
    }
    
    // Check if we have a cached directory for this model
    const cachedDirName = `${modelId}-cached`;
    const hasCachedDir = avatarFiles.some(dirent => 
      dirent.isDirectory() && dirent.name === cachedDirName
    );
    
    // Gather dependency info
    const dependencies = {
      modelFile: modelFile.name,
      modelPath: path.join(avatarsDir, modelFile.name),
      hasCachedDir,
      cachedPath: hasCachedDir ? path.join(avatarsDir, cachedDirName) : null,
      binFile: null,
      textures: []
    };
    
    // Check for bin file
    if (hasCachedDir) {
      const cachedFiles = fs.readdirSync(path.join(avatarsDir, cachedDirName));
      
      // Look for scene.bin
      if (cachedFiles.includes('scene.bin')) {
        dependencies.binFile = path.join(avatarsDir, cachedDirName, 'scene.bin');
      }
      
      // Look for textures directory
      const texturesDir = path.join(avatarsDir, cachedDirName, 'textures');
      if (fs.existsSync(texturesDir) && fs.statSync(texturesDir).isDirectory()) {
        const textureFiles = fs.readdirSync(texturesDir);
        dependencies.textures = textureFiles.map(file => ({
          name: file,
          path: path.join(texturesDir, file)
        }));
      }
    }
    
    return res.json({
      success: true,
      modelId,
      dependencies
    });
  } catch (err) {
    console.error('[resolve-dependencies] Error:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

// Fallback middleware for avatars to help with dependencies
app.use('/avatars', async (req, res, next) => {
  try {
    const relPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
    const absRequested = path.join(avatarsDir, relPath);
    
    // Log all avatar asset requests to help debug
    console.log(`[avatars] Request for: ${relPath}`);
    
    // If file exists as requested, let static middleware serve it
    if (fs.existsSync(absRequested) && fs.statSync(absRequested).isFile()) {
      console.log(`[avatars] File exists directly: ${absRequested}`);
      return next();
    }
    
    // For dependencies (textures, scene.bin), redirect to model-assets endpoint
    if (relPath === 'scene.bin' || 
        relPath.endsWith('/scene.bin') || 
        relPath.startsWith('textures/') || 
        relPath.includes('/textures/')) {
      console.log(`[avatars] Redirecting to model-assets: ${relPath}`);
      return res.redirect(`/model-assets/${relPath}`);
    }
    
    // For other files, proceed to static middleware
    return next();
  } catch (err) {
    console.error('[avatars] Error:', err);
    return next(err);
  }
});

// static fallback: serve files directly from avatars directory
app.use('/avatars', express.static(avatarsDir));

// POST /api/upload-photo - receive base64 image (data URL or raw base64) and save
app.post('/api/upload-photo', async (req, res) => {
  try {
    const { email, photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'Missing photo' });

    // photo may be data:<mime>;base64,<data> or raw base64
    let matches = photo.match(/^data:(image\/\w+);base64,(.+)$/);
    let ext = 'png';
    let data = photo;
    if (matches) {
      ext = matches[1].split('/')[1];
      data = matches[2];
    }
    const fileName = `${Date.now()}-${(email||'anon').replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host');
    const publicUrl = `${protocol}://${host}/uploads/${encodeURIComponent(fileName)}`;

    // Optionally update the user photo field
    if (email) {
      await User.findOneAndUpdate({ email }, { $set: { photo: publicUrl } }, { upsert: true });
    }

    return res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('upload-photo error', err?.message || err);
    return res.status(500).json({ error: 'Failed to save photo' });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// GET /api/outfits
app.get('/api/outfits', async (req, res) => {
  try {
    const query = req.query.q || 'suit';
    const token = process.env.SKETCHFAB_API_TOKEN;
    const response = await axios.get('https://api.sketchfab.com/v3/search', {
      params: { type: 'models', downloadable: true, q: query },
      headers: { Authorization: `Token ${token}` }
    });
    const outfits = await Promise.all(response.data.results.map(async item => {
      // Fetch the direct model URL from Sketchfab
      let modelUrl = null;
      try {
        const downloadRes = await axios.get(`https://api.sketchfab.com/v3/models/${item.uid}/download`, {
          headers: { Authorization: `Token ${token}` }
        });
        
        // Get the GLB download URL if available
        const glbDownload = downloadRes.data.gltf?.url || null;
        
        return {
          name: item.name,
          thumbnail: item.thumbnails.images[0]?.url,
          uid: item.uid,
          // Direct URL to the Sketchfab model viewer (embedded)
          viewerUrl: `https://sketchfab.com/models/${item.uid}/embed`,
          // Direct download URL if available
          glbUrl: glbDownload,
          // Sketchfab embed URL as fallback
          embedUrl: `https://sketchfab.com/models/${item.uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&dnt=1`
        };
      } catch (dlErr) {
        console.log(`Couldn't get download URL for model ${item.uid}: ${dlErr.message}`);
        return {
          name: item.name,
          thumbnail: item.thumbnails.images[0]?.url,
          uid: item.uid,
          viewerUrl: `https://sketchfab.com/models/${item.uid}/embed`,
          embedUrl: `https://sketchfab.com/models/${item.uid}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&dnt=1`
        };
      }
    }));
    
    return res.json({ outfits });
  } catch (err) {
    console.error('Sketchfab API error:', err?.response?.data || err.message || err);
    return res.status(500).json({
      error: 'Failed to fetch outfits.',
      details: err?.response?.data || err.message || err
    });
  }
});

// POST /api/outfits/download
// Body: { uid }
app.post('/api/outfits/download', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing model uid' });
  
  try {
    // Call Sketchfab API to get the model URL
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) return res.status(500).json({ error: 'SKETCHFAB_API_TOKEN not configured on server' });

    // Get the model download information from Sketchfab
    const resp = await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}/download`, 
      { headers: { Authorization: `Token ${token}` } }
    );

    // Look for direct GLB URL
    let modelUrl = null;
    
    if (sketchfabResp?.data?.gltf?.url) {
      // Direct GLB/GLTF URL
      modelUrl = sketchfabResp.data.gltf.url;
    } else if (sketchfabResp?.data?.formats) {
      // Look through formats for GLB
      const glbFormat = sketchfabResp.data.formats.find(f => 
        (f.format && /gltf|glb/i.test(f.format)) || 
        (f.url && /\.glb$/i.test(f.url))
      );
      
      if (glbFormat?.url) {
        modelUrl = glbFormat.url;
      }
    }
    // Check cache - any saved file that starts with uid-
    const files = await fs.promises.readdir(avatarsDir);
    // Prefer glb/gltf cache
    let existing = files.find(f => f.startsWith(`${uid}-`) && (f.toLowerCase().endsWith('.glb') || f.toLowerCase().endsWith('.gltf')));
    if (existing) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host');
      // If the cached file sits at avatars root, move it into a uid-named folder so
      // relative references inside glTF (scene.bin, textures/...) resolve there.
      const extractDirName = `${uid}-cached`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const extractDir = path.join(avatarsDir, extractDirName);
      try {
        if (!fs.existsSync(path.join(avatarsDir, existing))) {
          // weird: file not present, fall back
          const url = `${protocol}://${host}/avatars/${encodeURIComponent(existing)}`;
          return await finalizeDownload({ req, res, relPath: existing, absolutePath: path.join(avatarsDir, existing), cached: true, email: req.body.email });
        }
        fs.mkdirSync(extractDir, { recursive: true });
        const src = path.join(avatarsDir, existing);
        const dest = path.join(extractDir, existing);
        // move file into the folder
        fs.renameSync(src, dest);

        // If the moved file is a .gltf, ensure accompanying assets exist (scene.bin, textures/...).
        // If not present, do not return here; continue to the download/extract flow so we can fetch the full package.
        const movedItems = fs.readdirSync(extractDir);
        const hasAdditionalAssets = movedItems.some((n) => {
          const ln = n.toLowerCase();
          return ln.endsWith('.bin') || ln.endsWith('.bin.gz') || ln === 'textures' || ln.startsWith('textures') || ln.endsWith('.png') || ln.endsWith('.jpg') || ln.endsWith('.jpeg');
        });
        if (hasAdditionalAssets) {
          const relPath = `${extractDirName}/${existing}`.split(path.sep).join('/');
          const absPath = path.join(avatarsDir, relPath);
          return await finalizeDownload({ req, res, relPath, absolutePath: absPath, cached: true, email: req.body.email });
        }

        // No accompanying assets found; continue to download/extract logic below to get full archive
        console.debug && console.debug('Moved cached glTF but missing assets, continuing to download/extract for uid', uid);
        } catch (e) {
        console.error('failed moving cached asset into folder', e);
        return await finalizeDownload({ req, res, relPath: existing, absolutePath: path.join(avatarsDir, existing), cached: true, email: req.body.email });
      }
    }
    // If a zip exists in cache, extract it into a folder and return the gltf inside
    const existingZip = files.find(f => f.startsWith(`${uid}-`) && f.toLowerCase().endsWith('.zip'));
    if (existingZip) {
      try {
        const zipPath = path.join(avatarsDir, existingZip);
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();
        const extractDirName = `${uid}-cached`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const extractDir = path.join(avatarsDir, extractDirName);
        fs.mkdirSync(extractDir, { recursive: true });
        entries.forEach(entry => {
          const targetPath = path.join(extractDir, entry.entryName);
          if (entry.isDirectory) {
            try { fs.mkdirSync(targetPath, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
          } else {
            const dir = path.dirname(targetPath);
            try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
            fs.writeFileSync(targetPath, entry.getData());
          }
        });
        const findFile = (dir) => {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const it of items) {
            const p = path.join(dir, it.name);
            if (it.isDirectory()) {
              const r = findFile(p);
              if (r) return r;
            } else if (it.isFile()) {
              if (it.name.toLowerCase().endsWith('.glb') || it.name.toLowerCase().endsWith('.gltf')) return path.relative(avatarsDir, p).split(path.sep).join('/');
            }
          }
          return null;
        };
        const foundRel = findFile(extractDir);
        if (foundRel) {
          const absPath = path.join(avatarsDir, foundRel);
          return await finalizeDownload({ req, res, relPath: foundRel, absolutePath: absPath, cached: true, email: req.body.email });
        }
      } catch (e) {
        console.error('cached zip extraction failed', e);
      }
    }

    // Call Sketchfab download endpoint
    // Already declared above, using the same token
    // const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) return res.status(500).json({ error: 'SKETCHFAB_API_TOKEN not configured on server' });

    // Allow caller to request that we prefer a GLB format when available
    const preferGlb = !!req.body.preferGlb;
    let downloadEndpoint = `https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}/download`;
    if (preferGlb) {
      try {
        const meta = await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}`, { headers: { Authorization: `Token ${token}` } });
        const fm = meta?.data?.formats;
        if (fm && Array.isArray(fm)) {
          const glbFmt = fm.find(x => x && x.url && x.url.toLowerCase().endsWith('.glb'));
          if (glbFmt && glbFmt.url) {
            downloadEndpoint = glbFmt.url;
            console.log('[outfits] preferGlb: using direct glb URL from metadata');
          }
        }
      } catch (e) {
        console.warn('preferGlb metadata lookup failed', e?.message || e);
      }
    }

    // First request - Sketchfab returns either a JSON with file links or streams directly
    const sketchfabResp = await axios.get(downloadEndpoint, { headers: { Authorization: `Token ${token}` } , timeout: 20000});

    // If JSON with formats, find a glb/gltf url
    let glbUrl = null;
    if (sketchfabResp && sketchfabResp.data) {
      // If Sketchfab returns an object with 'gltf' or 'archives'
      const data = sketchfabResp.data;
      // Try common shapes
      if (data.gltf && data.gltf.url) glbUrl = data.gltf.url;
      else if (data.formats) {
        // formats is an array - try to find glb
        const fm = data.formats.find(f => (f.format && /gltf/i.test(f.format)) || (f.url && f.url.toLowerCase().endsWith('.glb')) );
        if (fm && fm.url) glbUrl = fm.url;
      }
    }

    // If no direct GLB URL found in JSON, try to request download endpoint as stream (some endpoints redirect to file)
    if (!glbUrl) {
      // Attempt to follow redirects to get binary (arraybuffer) so we can detect zips
      const streamResp = await axios.get(downloadEndpoint, { headers: { Authorization: `Token ${token}` }, responseType: 'arraybuffer', maxRedirects: 5, timeout: 60000 });
      if (streamResp && streamResp.data) {
        const buffer = Buffer.from(streamResp.data);
        // Detect ZIP by magic bytes PK
        const isZip = buffer.slice(0, 4).toString() === 'PK\u0003\u0004' || (streamResp.headers['content-type'] && streamResp.headers['content-type'].includes('zip')) || (downloadEndpoint.toLowerCase().endsWith('.zip'));
        if (isZip) {
          try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            // Try to find a single .glb or .gltf inside the archive
            const candidate = entries.find(e => e.entryName.toLowerCase().endsWith('.glb') || e.entryName.toLowerCase().endsWith('.gltf'));
            if (candidate) {
              // Extract entire archive into a folder so binary and textures stay alongside the glTF
              const extractDirName = `${uid}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '_');
              const extractDir = path.join(avatarsDir, extractDirName);
              fs.mkdirSync(extractDir, { recursive: true });
              entries.forEach(entry => {
                const targetPath = path.join(extractDir, entry.entryName);
                if (entry.isDirectory) {
                  try { fs.mkdirSync(targetPath, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
                } else {
                  const dir = path.dirname(targetPath);
                  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
                  fs.writeFileSync(targetPath, entry.getData());
                }
              });
              const relPath = path.join(extractDirName, candidate.entryName).split(path.sep).join('/');
              const absPath = path.join(avatarsDir, relPath);
              return await finalizeDownload({ req, res, relPath, absolutePath: absPath, cached: true, email: req.body.email });
            }

            // No single candidate: extract entire archive into a folder and search
            const extractDirName = `${uid}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '_');
            const extractDir = path.join(avatarsDir, extractDirName);
            fs.mkdirSync(extractDir, { recursive: true });
            entries.forEach(entry => {
              const targetPath = path.join(extractDir, entry.entryName);
              if (entry.isDirectory) {
                try { fs.mkdirSync(targetPath, { recursive: true }); } catch (e) { /* ignore */ }
              } else {
                const dir = path.dirname(targetPath);
                try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
                fs.writeFileSync(targetPath, entry.getData());
              }
            });

            // Recursively search extracted folder for glb/gltf
            const findFile = (dir) => {
              const items = fs.readdirSync(dir, { withFileTypes: true });
              for (const it of items) {
                const p = path.join(dir, it.name);
                if (it.isDirectory()) {
                  const r2 = findFile(p);
                  if (r2) return r2;
                } else if (it.isFile()) {
                  if (it.name.toLowerCase().endsWith('.glb') || it.name.toLowerCase().endsWith('.gltf')) return path.relative(avatarsDir, p).split(path.sep).join('/');
                }
              }
              return null;
            };
            const foundRel = findFile(extractDir);
            if (foundRel) {
              const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
              const host = req.get('host');
              // encode each path segment separately so slashes are preserved for express.static
              const encoded = foundRel.split('/').map(encodeURIComponent).join('/');
              try { await normalizeGltfAssets(path.join(avatarsDir, foundRel)); } catch (e) { console.warn('normalize failed', e); }
              const url = `${protocol}://${host}/avatars/${encoded}`;
              return res.json({ success: true, url, cached: false });
            }
          } catch (zipErr) {
            console.error('ZIP extraction failed', zipErr);
          }
        }

        // Not a zip or extraction failed: write buffer to .glb only if it is likely a GLB
  const filename = `${uid}-${Date.now()}.glb`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(avatarsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  const relPath = filename;
  return await finalizeDownload({ req, res, relPath, absolutePath: filePath, cached: false, email: req.body.email });
      }
    }

    // If we have a glbUrl (absolute), download it
    if (glbUrl) {
      const parsed = new URL(glbUrl);
      const r = await axios.get(glbUrl, { responseType: 'stream', maxRedirects: 5, timeout: 60000 });
      const contentType = (r.headers && r.headers['content-type']) || '';
      const looksLikeZip = contentType.includes('zip') || parsed.pathname.toLowerCase().endsWith('.zip');
      if (looksLikeZip) {
        // collect stream into buffer and try to extract
        const chunks = [];
        await new Promise((resolve, reject) => {
          r.data.on('data', (c) => chunks.push(c));
          r.data.on('end', resolve);
          r.data.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        try {
          const zip = new AdmZip(buffer);
          const entries = zip.getEntries();
          const candidate = entries.find(e => e.entryName.toLowerCase().endsWith('.glb') || e.entryName.toLowerCase().endsWith('.gltf'));
          if (candidate) {
            const outName = `${uid}-${path.basename(candidate.entryName)}`.replace(/[^a-zA-Z0-9._-]/g, '_');
            const outPath = path.join(avatarsDir, outName);
            fs.writeFileSync(outPath, candidate.getData());
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.get('host');
            const url = `${protocol}://${host}/avatars/${encodeURIComponent(outName)}`;
            return res.json({ success: true, url, cached: false });
          }
          // fallback: extract entire archive and search
          const extractDirName = `${uid}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '_');
          const extractDir = path.join(avatarsDir, extractDirName);
          fs.mkdirSync(extractDir, { recursive: true });
          entries.forEach(entry => {
            const targetPath = path.join(extractDir, entry.entryName);
            if (entry.isDirectory) {
              try { fs.mkdirSync(targetPath, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
            } else {
              const dir = path.dirname(targetPath);
              try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error('mkdir error', e); }
              fs.writeFileSync(targetPath, entry.getData());
            }
          });
          const findFile = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const it of items) {
              const p = path.join(dir, it.name);
              if (it.isDirectory()) {
                const r2 = findFile(p);
                if (r2) return r2;
              } else if (it.isFile()) {
                if (it.name.toLowerCase().endsWith('.glb') || it.name.toLowerCase().endsWith('.gltf')) return path.relative(avatarsDir, p).split(path.sep).join('/');
              }
            }
            return null;
          };
          const foundRel = findFile(extractDir);
          if (foundRel) {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.get('host');
            const encoded = foundRel.split('/').map(encodeURIComponent).join('/');
            const url = `${protocol}://${host}/avatars/${encoded}`;
            return res.json({ success: true, url, cached: false });
          }
          try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) { console.error('cleanup', e); }
          return res.status(502).json({ error: 'No GLB/GLTF found inside downloaded archive' });
        } catch (e) {
          console.error('zip handling failed', e);
          return res.status(502).json({ error: 'Failed to extract downloaded archive' });
        }
      } else {
        // write stream directly to file
        const filename = `${uid}-${path.basename(parsed.pathname)}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(avatarsDir, filename);
        const writer = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          r.data.pipe(writer);
          let err = null;
          writer.on('error', e => { err = e; writer.close(); reject(e); });
          writer.on('close', () => { if (!err) resolve(); });
        });
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host');
        const url = `${protocol}://${host}/avatars/${encodeURIComponent(filename)}`;
        return res.json({ success: true, url, cached: false });
      }
    }

    return res.status(502).json({ error: 'Could not obtain GLB url from Sketchfab' });
  } catch (err) {
    console.error('Sketchfab download error', err?.response?.data || err.message || err);
    return res.status(500).json({ error: 'Failed to download model', details: err?.response?.data || err.message || err });
  }
});

// POST /api/user/avatar
// Body: { email, avatarGlbUrl }
app.post('/api/user/avatar', async (req, res) => {
  const { email, avatarGlbUrl } = req.body;
  if (!email || !avatarGlbUrl) return res.status(400).json({ error: 'Missing email or avatarGlbUrl' });
  try {
    let toSaveUrl = avatarGlbUrl;
    // If URL is remote (http/https), download it and save locally under /avatars
    try {
      const parsed = new URL(avatarGlbUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const fileName = `${Date.now()}-${path.basename(parsed.pathname)}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(avatarsDir, fileName);
        const writer = fs.createWriteStream(filePath);
        const response = await axios.get(avatarGlbUrl, { responseType: 'stream', timeout: 20000 });
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          let error = null;
          writer.on('error', err => { error = err; writer.close(); reject(err); });
          writer.on('close', () => { if (!error) resolve(); });
        });
        // Build accessible URL for the saved file
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host');
        toSaveUrl = `${protocol}://${host}/avatars/${encodeURIComponent(fileName)}`;
      }
    } catch (e) {
      // Not a valid URL or download failed: keep original value
      console.debug('avatar download skipped or failed:', e?.message || e);
      toSaveUrl = avatarGlbUrl;
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { avatarGlbUrl: toSaveUrl } },
      { upsert: true, new: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});

// POST /api/user/outfit
// Body: { email, outfitGlbUrl }
app.post('/api/user/outfit', async (req, res) => {
  const { email, outfitGlbUrl } = req.body;
  if (!email || !outfitGlbUrl) return res.status(400).json({ error: 'Missing email or outfitGlbUrl' });
  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { outfitGlbUrl } },
      { upsert: true, new: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save outfit' });
  }
});

// GET /api/user/:email
app.get('/api/user/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// DEV helper: list files under avatars for debugging (recursive)
app.get('/api/debug/avatars', async (req, res) => {
  try {
    const walk = (dir) => {
      const items = [];
      const names = fs.readdirSync(dir, { withFileTypes: true });
      for (const n of names) {
        const p = path.join(dir, n.name);
        if (n.isDirectory()) {
          items.push({ name: n.name, type: 'dir', children: walk(p) });
        } else {
          items.push({ name: n.name, type: 'file', size: fs.statSync(p).size });
        }
      }
      return items;
    };
    if (!fs.existsSync(avatarsDir)) return res.json({ avatars: [] });
    const data = walk(avatarsDir);
    return res.json({ avatars: data });
  } catch (err) {
    console.error('debug avatars error', err);
    return res.status(500).json({ error: 'Failed to list avatars dir', details: err?.message || err });
  }
});

// Temporary debug endpoint: fetch Sketchfab model metadata (formats/download links)
app.get('/api/outfits/meta', async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid query param' });
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'SKETCHFAB_API_TOKEN not configured' });
  try {
    const meta = await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}`, { headers: { Authorization: `Token ${token}` }, timeout: 20000 });
    return res.json({ success: true, meta: meta.data });
  } catch (e) {
    console.error('meta fetch failed', e?.response?.data || e?.message || e);
    return res.status(502).json({ error: 'Failed to fetch metadata', details: e?.response?.data || e?.message || e });
  }
});

// Debug endpoint: call Sketchfab /download endpoint which may return formats/archives
app.get('/api/outfits/download-meta', async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'SKETCHFAB_API_TOKEN not configured' });
  try {
    const dl = await axios.get(`https://api.sketchfab.com/v3/models/${encodeURIComponent(uid)}/download`, { headers: { Authorization: `Token ${token}` }, timeout: 20000 });
    return res.json({ success: true, data: dl.data, headers: dl.headers });
  } catch (e) {
    console.error('download-meta failed', e?.response?.data || e?.message || e);
    return res.status(502).json({ error: 'Failed to fetch download metadata', details: e?.response?.data || e?.message || e });
  }
});

// Proxy endpoint to fetch remote assets (GLB) and return with CORS header
// Use for loading .glb files that may not have Access-Control-Allow-Origin set.
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url query param' });
  try {
    // Allowlist remote hosts to reduce abuse risk
  const allowedHosts = ['models.readyplayer.me', 'cdn.readyplayer.me', 'example.com', 'localhost', '127.0.0.1', 'sketchfab.com', 'static.sketchfab.com', 's3.amazonaws.com', 'sketchfab-prod-media.s3.amazonaws.com'];
    const parsed = new URL(url);
    
    // Use more flexible hostname check
    if (!allowedHosts.some(host => parsed.hostname.includes(host))) {
      console.error(`Host not allowed in proxy: ${parsed.hostname}`);
      return res.status(400).json({ error: 'Host not allowed', host: parsed.hostname });
    }

    console.log(`Standard proxy handling: ${url}`);

    // Add user agent to avoid some CDN blocks
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000 // 15 second timeout
    });

    // Log the response content type for debugging
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const buf = Buffer.from(response.data);
    console.log(`Proxy for ${url} received content-type: ${contentType}, size: ${buf.length} bytes`);

  // In-memory cache for extracted GLBs from ZIP downloads
  if (!global.__zipExtractCache) global.__zipExtractCache = new Map();
  const zipCache = global.__zipExtractCache;
  // Configurable limits via environment variables
  const CACHE_MAX = parseInt(process.env.PROXY_ZIP_CACHE_MAX || '50', 10); // max entries
  const CACHE_TTL = parseInt(process.env.PROXY_ZIP_CACHE_TTL || String(24 * 60 * 60 * 1000), 10); // default 24h
  const MAX_ARCHIVE_BYTES = parseInt(process.env.PROXY_MAX_ARCHIVE_BYTES || String(20 * 1024 * 1024), 10); // default 20 MB

    // Helper to prune cache
    const pruneCacheIfNeeded = () => {
      if (zipCache.size <= CACHE_MAX) return;
      // remove oldest entries
      const items = Array.from(zipCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
      while (zipCache.size > CACHE_MAX) {
        const oldestKey = items.shift();
        if (!oldestKey) break;
        zipCache.delete(oldestKey[0]);
      }
    };

    // Detect ZIP by content-type or magic bytes (PK..)
    const magic = buf.slice(0, 4).toString('binary');
    const isZip = /zip|octet-stream|application\/x-zip/i.test(contentType) || magic.startsWith('PK');

    if (isZip) {
      // If we already extracted this URL recently, serve from memory
      if (buf.length > MAX_ARCHIVE_BYTES) {
        console.warn('Archive too large to process in-memory:', url, 'size:', buf.length);
        return res.status(413).json({ error: 'Archive too large to process', maxBytes: MAX_ARCHIVE_BYTES });
      }
      const cached = zipCache.get(url);
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
        console.log('Serving extracted GLB from in-memory cache for', url);
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', 'model/gltf-binary');
        return res.send(cached.buffer);
      }

      // Attempt to extract .glb from ZIP in-memory
      try {
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();
        // Prefer existing .glb inside archive
        const glbEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.glb'));
        if (glbEntry) {
          const glbBuf = glbEntry.getData();
          // cache it in memory
          zipCache.set(url, { buffer: glbBuf, ts: Date.now() });
          pruneCacheIfNeeded();
          console.log('Extracted GLB from ZIP and cached in memory for', url, 'size:', glbBuf.length);
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Content-Type', 'model/gltf-binary');
          return res.send(glbBuf);
        }

        // If no .glb, look for a .gltf entry and attempt in-memory packing
        const gltfEntry = entries.find(e => e.entryName.toLowerCase().endsWith('.gltf'));
        if (gltfEntry) {
          try {
            const gltfText = gltfEntry.getData().toString('utf8');
            const gltfJson = JSON.parse(gltfText);

            // Helper to find entry by relative path or basename
            const findEntryByUri = (uri) => {
              if (!uri) return null;
              // Try exact match
              let found = entries.find(en => en.entryName === uri || en.entryName === ('/' + uri));
              if (found) return found;
              // Try basename match
              const base = uri.split('/').pop();
              found = entries.find(en => en.entryName.split('/').pop() === base);
              return found || null;
            };

            // Inline buffers as data URIs
            if (Array.isArray(gltfJson.buffers)) {
              for (const bufRef of gltfJson.buffers) {
                if (!bufRef || !bufRef.uri) continue;
                if (bufRef.uri.startsWith('data:')) continue;
                const entry = findEntryByUri(bufRef.uri);
                if (entry) {
                  const data = entry.getData();
                  const dataUri = `data:application/octet-stream;base64,${data.toString('base64')}`;
                  bufRef.uri = dataUri;
                }
              }
            }

            // Inline images as data URIs
            if (Array.isArray(gltfJson.images)) {
              for (const imgRef of gltfJson.images) {
                if (!imgRef || !imgRef.uri) continue;
                if (imgRef.uri.startsWith('data:')) continue;
                const entry = findEntryByUri(imgRef.uri);
                if (entry) {
                  const data = entry.getData();
                  // Try to infer mime-type from extension
                  const ext = path.extname(entry.entryName).toLowerCase();
                  let mime = 'application/octet-stream';
                  if (ext === '.png') mime = 'image/png';
                  else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
                  else if (ext === '.webp') mime = 'image/webp';
                  const dataUri = `data:${mime};base64,${data.toString('base64')}`;
                  imgRef.uri = dataUri;
                }
              }
            }

            // Now use gltf-pipeline to pack into GLB entirely in-memory
            try {
              const gltfPipeline = await import('gltf-pipeline');
              const gltfToGlb = gltfPipeline.gltfToGlb || (gltfPipeline.default && gltfPipeline.default.gltfToGlb);
              if (!gltfToGlb) throw new Error('gltfToGlb not available from gltf-pipeline');
              const options = { resourceDirectory: '' };
              const results = await gltfToGlb(gltfJson, options);
              if (results && results.glb) {
                const outBuf = Buffer.from(results.glb);
                zipCache.set(url, { buffer: outBuf, ts: Date.now() });
                pruneCacheIfNeeded();
                console.log('Packed GLTF->GLB in-memory from ZIP for', url, 'size:', outBuf.length);
                res.set('Access-Control-Allow-Origin', '*');
                res.set('Content-Type', 'model/gltf-binary');
                return res.send(outBuf);
              }
            } catch (packErr) {
              console.warn('In-memory GLTF->GLB packing failed for', url, packErr && packErr.message);
            }
          } catch (inner) {
            console.warn('Failed to parse GLTF inside ZIP for', url, inner && inner.message);
          }
        }

        // No GLB or packable glTF inside ZIP - cannot serve as single GLB
        console.warn('ZIP archive contained no packable .glb or .gltf entries for', url);
        return res.status(415).json({ error: 'Archive contains no .glb or packable .gltf file; cannot serve as GLB', suggestion: 'Use Sketchfab embed or request a GLB' });
      } catch (zipErr) {
        console.error('Failed to extract ZIP in-memory for', url, zipErr && zipErr.message);
        return res.status(502).json({ error: 'Failed to extract ZIP archive', details: zipErr && zipErr.message });
      }
    }

    // Not a ZIP - stream bytes back
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);
    return res.send(buf);
  } catch (err) {
    console.error('Proxy fetch error:', err?.message || err, 'URL:', url);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response headers:', err.response.headers);
    }
    return res.status(502).json({ 
      error: 'Failed to fetch remote resource', 
      details: err?.message || 'Unknown error',
      url: url
    });
  }
});

// Resource proxy endpoint for GLTF files and their dependencies
// This handles GLTF files that reference external resources like scene.bin
app.get('/api/proxy/resource', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url query param' });
  
  try {
    // Allowlist remote hosts to reduce abuse risk
  const allowedHosts = ['models.readyplayer.me', 'cdn.readyplayer.me', 'example.com', 'localhost', '127.0.0.1', 'sketchfab.com', 'static.sketchfab.com', 's3.amazonaws.com', 'sketchfab-prod-media.s3.amazonaws.com'];
    const parsed = new URL(url);
    if (!allowedHosts.some(host => parsed.hostname.includes(host))) {
      console.error(`Host not allowed: ${parsed.hostname}`);
      return res.status(400).json({ error: 'Host not allowed' });
    }

    console.log(`Resource proxy handling: ${url}`);
    
    // Get the base URL path for resolving relative references
    const basePath = url.substring(0, url.lastIndexOf('/') + 1);
    console.log(`Base path for relative references: ${basePath}`);
    
    // Fetch the GLTF file as bytes first so we can detect archives (ZIP) safely
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    if (!response || !response.data) {
      console.error('No data in GLTF response');
      return res.status(502).json({ error: 'Invalid GLTF data received' });
    }

    const contentType = (response.headers && response.headers['content-type']) || '';
    // Detect ZIP by content-type or by magic bytes (PK..)
    const buf = Buffer.from(response.data);
    const magic = buf.slice(0,4).toString('binary');
    if (/zip|octet-stream|application\/x-zip/i.test(contentType) || magic.startsWith('PK')) {
      console.warn('Resource proxy detected archive/ZIP for URL, refusing to treat as GLTF:', url, 'content-type:', contentType);
      return res.status(415).json({ error: 'Archive/ZIP not supported by resource proxy', suggestion: 'Provide a direct .glb URL or use the Sketchfab embed if applicable' });
    }

    // Try to parse the response bytes as JSON (gltf)
    let gltfData = null;
    try {
      const text = buf.toString('utf8');
      gltfData = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse GLTF JSON from response bytes for URL:', url, parseErr && parseErr.message);
      return res.status(502).json({ error: 'Failed to parse GLTF JSON from remote resource', details: parseErr && parseErr.message });
    }
    console.log(`GLTF data received, processing buffers and images...`);
    
    // Process buffers - update URI references to use our proxy
    if (gltfData.buffers) {
      console.log(`Found ${gltfData.buffers.length} buffers to process`);
      for (const buffer of gltfData.buffers) {
        if (buffer.uri) {
          // Store original for debugging
          const originalUri = buffer.uri;
          
          // If it's a relative path or doesn't start with http/https, resolve it against the base URL
          if (!buffer.uri.startsWith('http')) {
            const absoluteUri = new URL(buffer.uri, basePath).href;
            // Replace with proxied URL
            buffer.uri = `http://localhost:5000/api/proxy?url=${encodeURIComponent(absoluteUri)}`;
            console.log(`Processed buffer: ${originalUri} → ${buffer.uri}`);
          } else {
            // Already absolute, just proxy it
            buffer.uri = `http://localhost:5000/api/proxy?url=${encodeURIComponent(buffer.uri)}`;
            console.log(`Processed absolute buffer: ${originalUri} → ${buffer.uri}`);
          }
        }
      }
    } else {
      console.log('No buffers found in GLTF data');
    }
    
    // Process images - update URI references to use our proxy
    if (gltfData.images) {
      console.log(`Found ${gltfData.images.length} images to process`);
      for (const image of gltfData.images) {
        if (image.uri) {
          // Store original for debugging
          const originalUri = image.uri;
          
          // If it's a relative path or doesn't start with http/https, resolve it against the base URL
          if (!image.uri.startsWith('http')) {
            const absoluteUri = new URL(image.uri, basePath).href;
            // Replace with proxied URL
            image.uri = `http://localhost:5000/api/proxy?url=${encodeURIComponent(absoluteUri)}`;
            console.log(`Processed image: ${originalUri} → ${image.uri}`);
          } else {
            // Already absolute, just proxy it
            image.uri = `http://localhost:5000/api/proxy?url=${encodeURIComponent(image.uri)}`;
            console.log(`Processed absolute image: ${originalUri} → ${image.uri}`);
          }
        }
      }
    } else {
      console.log('No images found in GLTF data');
    }
    
    // Return the modified GLTF with proxied resource URLs
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', 'application/json');
    return res.json(gltfData);
  } catch (err) {
    console.error('GLTF Resource proxy error:', err?.message || err, 'URL:', url);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response headers:', err.response.headers);
    }
    return res.status(502).json({ 
      error: 'Failed to process GLTF resource', 
      details: err?.message || 'Unknown error',
      url: url
    });
  }
});

// POST /api/user/update-avatar-from-photo
// Body: { email, photo }
app.post('/api/user/update-avatar-from-photo', async (req, res) => {
  const { email, photo } = req.body;
  if (!email || !photo) return res.status(400).json({ error: 'Missing email or photo' });
  try {
    // Use the same placeholder logic as registration
    // In production, call your 3D model service here and get the avatarGlbUrl
    const avatarGlbUrl = await generate3DModelFromPhoto(photo);
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { avatarGlbUrl, photo } },
      { upsert: true, new: true }
    );
    res.json({ success: true, avatarGlbUrl, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update avatar from photo' });
  }
});

// Dummy 3D model generation function (reuse from auth.js if not already global)
async function generate3DModelFromPhoto(photo) {
  // Simulate 3D model generation and return a placeholder URL
  // In production, call your 3D avatar service here
  return 'https://example.com/generated-avatar.glb';
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  
  // Import and run the model resource initialization script
  try {
    const initModelResources = (await import('./scripts/initModelResources.js')).default;
    await initModelResources();
    console.log('Model resources initialized successfully');
  } catch (error) {
    console.error('Error initializing model resources:', error);
  }
});
