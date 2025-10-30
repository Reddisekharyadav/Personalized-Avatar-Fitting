import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import WardrobeViewer from '../components/WardrobeViewer';
import SketchfabModelViewer from '../components/SketchfabModelViewer';
import { resolveModelUrl } from '../utils/modelUtils';
import ApiClient, { setAuthToken } from '../utils/api';
import axios from 'axios';
import loadModelViewer from '../utils/loadModelViewer';

const Wardrobe = () => {
  const router = useRouter();
  const iframeRef = useRef(null);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [outfits, setOutfits] = useState([]);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [selectedOutfitUrl, setSelectedOutfitUrl] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null); // Track currently selected asset for preview
  const [isSketchfabEmbed, setIsSketchfabEmbed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('character 3d model avatar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState(''); // For non-error informational messages
  const [assets, setAssets] = useState([]);
  
  // New: RPM and Sketchfab assets for right sidebar
  const [rpmAssets, setRpmAssets] = useState([]);
  const [sketchfabAssets, setSketchfabAssets] = useState([]);
  const [activeTab, setActiveTab] = useState('rpm'); // 'rpm' or 'sketchfab'
  const [assetType, setAssetType] = useState('all');
  const [assetGender, setAssetGender] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  const subdomain = process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || 'mango-xwpbk6';

  // Debug: Log state changes
  useEffect(() => {
    console.log('========================================');
    console.log('🔄 ACTIVE TAB:', activeTab);
    console.log('📦 RPM ASSETS COUNT:', rpmAssets.length);
    console.log('🎭 SKETCHFAB ASSETS COUNT:', sketchfabAssets.length);
    console.log('⏳ LOADING:', loadingAssets);
    console.log('❌ ERROR:', error);
    console.log('========================================');
  }, [activeTab, rpmAssets, sketchfabAssets, loadingAssets, error]);

    // Debug: Track selected asset changes
  useEffect(() => {
    console.log('========================================');
    console.log('🎨 SELECTED ASSET CHANGED:', selectedAsset);
    console.log('🔗 SELECTED OUTFIT URL:', selectedOutfitUrl);
    console.log('========================================');
  }, [selectedAsset, selectedOutfitUrl]);

  // Auto-fetch Sketchfab when tab clicked and empty
  useEffect(() => {
    if (activeTab === 'sketchfab' && sketchfabAssets.length === 0 && !loadingAssets) {
      console.log('🎭 Sketchfab tab activated with no assets - auto-fetching...');
      fetchSketchfabAssets();
    }
  }, [activeTab]);

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (!email) {
      router.push('/login');
      return;
    }
    
    // 🔐 Restore auth token from localStorage to axios headers
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      console.log('🔐 Auth token restored from localStorage');
    } else {
      console.warn('⚠️ No auth token found in localStorage - avatar save will fail!');
    }
    // Ensure model-viewer is loaded once to avoid duplicate define errors
    loadModelViewer().catch(err => console.error('Failed loading model-viewer:', err));
    // Define reusable loader so Retry button can call it
    async function loadData() {
      try {
        console.log('🚀 STARTING WARDROBE LOAD for email:', email);
        setLoading(true);
        setError('');
        
        console.log('📡 Fetching user profile from API...');
        const profile = await ApiClient.getUserProfile(email);
        console.log('✅ Profile loaded:', profile);
        
        setUser(profile.user || null);
        // Prefer avatarUrl if present, else fallback to avatarGlbUrl
        const avatar = (profile.user && (profile.user.avatarUrl || profile.user.avatarGlbUrl)) || null;
        console.log('🔍 Avatar URL Debug:', {
          avatarUrl: profile.user?.avatarUrl,
          avatarGlbUrl: profile.user?.avatarGlbUrl,
          selected: avatar,
          userEmail: profile.user?.email
        });
        if (!avatar) {
          console.warn('⚠️ No avatar URL found! User should create avatar first.');
        }
        setAvatarUrl(avatar);

  // fetch outfits for user (backend returns { items: [...] })
        console.log('📥 Fetching wardrobe items...');
        const wardrobeEmail = profile.user?.email || email;
        const resp = await axios.get(`http://localhost:5000/api/wardrobe/${encodeURIComponent(wardrobeEmail)}`);
        let items = resp.data?.items || [];
        console.log(`✅ Wardrobe items fetched: ${items.length} items`);

        // Skip Sketchfab prefetch during initial load - it's too slow
        // Users can use the Sketchfab tab to search manually
        console.log('ℹ️ Skipped Sketchfab auto-fetch during initial load (use tabs to search)');

        setOutfits(items);

        // fetch RPM/Mongo assets (public) for modern flow
        try {
          const assetsRes = await ApiClient.getAssets({ owner: 'public', page: 1, limit: 24 });
          const fetchedAssets = assetsRes?.assets || [];
          console.log('📦 FETCHED ASSETS:', fetchedAssets.length);
          console.log('📦 FIRST ASSET SAMPLE:', JSON.stringify(fetchedAssets[0], null, 2));
          setAssets(fetchedAssets);
        } catch (e) {
          console.warn('Failed to fetch assets:', e?.message);
        }
        
        // Auto-load some RPM assets for the catalog
        try {
          console.log('📦 Auto-loading RPM assets...');
          const rpmData = await ApiClient.getRpmAssets({ limit: 24 });
          const fetchedRpm = rpmData?.assets || [];
          console.log(`✅ Auto-loaded ${fetchedRpm.length} RPM assets`);
          setRpmAssets(fetchedRpm);
        } catch (e) {
          console.warn('Failed to auto-load RPM assets:', e?.message);
        }
        
        // 🔐 RPM iframe - using subdomain-based authentication
        // The iframe uses the subdomain authentication, which allows editing when loading an existing avatar URL
        // No explicit token needed - RPM recognizes the subdomain and allows editing
        console.log('✅ RPM iframe will use subdomain authentication (mango-xwpbk6)');
      } catch (e) {
        console.error('❌ FAILED TO LOAD WARDROBE:', e);
        console.error('Error details:', e?.message, e?.response?.status);
        setError(e?.message || 'Failed to load wardrobe data');
      } finally {
        console.log('✅ WARDROBE LOAD COMPLETE - Setting loading to false');
        setLoading(false);
      }
    }

    // initial load
    console.log('🎬 Wardrobe component mounted - calling loadData()');
    loadData();

    // Setup iframe message listener for RPM events
    const handleMessage = (event) => {
      if (event.origin !== 'https://readyplayer.me') return;
      
      try {
        const json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (json?.source !== 'readyplayerme') return;

        // Handle avatar updated events (when outfit is applied in RPM)
        if (json.eventName === 'v2.avatar.exported' || json.eventName === 'v1.avatar.exported') {
          const url = json.data?.url;
          if (url) {
            console.log('🎨 Avatar updated with new outfit:', url);
            setAvatarUrl(url);
            // Save to backend
            ApiClient.saveAvatar({ avatarUrl: url })
              .then(() => console.log('✅ Avatar saved to backend:', url))
              .catch(err => {
                console.error('❌ Failed to save avatar:', err);
                if (err?.response?.status === 401) {
                  alert('⚠️ Session expired! Please login again.');
                  localStorage.removeItem('token');
                  localStorage.removeItem('userEmail');
                  router.push('/login');
                } else {
                  alert('Failed to save avatar. Changes may not persist.');
                }
              });
          }
        }

        // Handle asset selected events
        if (json.eventName === 'v1.asset.selected' || json.eventName === 'v2.asset.selected') {
          console.log('Asset selected:', json.data);
        }
      } catch (error_) {
        console.error('Error handling RPM message:', error_);
      }
    };

    if (globalThis.window !== undefined) {
      window.addEventListener('message', handleMessage);
    }
    
    return () => {
      if (globalThis.window !== undefined) {
        window.removeEventListener('message', handleMessage);
      }
    };
  }, [router, searchQuery]);

  // Fetch RPM Assets
  const fetchRpmAssets = async () => {
    try {
      setLoadingAssets(true);
      const params = {};
      if (assetType && assetType !== 'all') params.type = assetType;
      if (assetGender) params.gender = assetGender;
      params.limit = 50;
      
      const data = await ApiClient.getRpmAssets(params);
      console.log('✅ RPM Assets fetched:', data.assets?.length || 0);
      setRpmAssets(data.assets || []);
    } catch (err) {
      console.error('❌ Failed to fetch RPM assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  // Fetch Sketchfab Assets
  const fetchSketchfabAssets = async () => {
    try {
      setLoadingAssets(true);
      setError(''); // Clear previous errors
      const query = searchQuery || 'jacket shirt pants clothing fashion';
      console.log(`🔍 Fetching Sketchfab models for: "${query}"`);
      
      // Create a fresh axios instance to avoid baseURL interference
      const freshAxios = axios.create({
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const url = `http://localhost:5000/api/wardrobe/sketchfab/search?q=${encodeURIComponent(query)}`;
      console.log('🌐 Fetching from:', url);
      
      const resp = await freshAxios.get(url);
      
      console.log('📡 Response received:', resp.status);
      const items = resp.data?.items || [];
      
      console.log(`✅ Sketchfab API returned: ${items.length} models`);
      console.log('📦 Models data:', items.slice(0, 3)); // Log first 3 models
      
      if (items.length === 0) {
        setError('⚠️ No models found. Try different search terms like "jacket", "dress", "shirt", "pants", etc.');
      } else {
        console.log('🎨 Setting sketchfabAssets state with', items.length, 'items');
      }
      
      setSketchfabAssets(items);
    } catch (err) {
      console.error('❌ Failed to fetch Sketchfab assets:', err);
      console.error('❌ Error details:', {
        message: err?.message,
        code: err?.code,
        response: err?.response?.data
      });
      const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
      setError(`❌ Sketchfab API error: ${errorMsg}. Try refreshing or check backend logs.`);
    } finally {
      console.log('🏁 Setting loadingAssets to false');
      setLoadingAssets(false);
    }
  };

  // Apply asset overlay to avatar
  const applyAssetOverlay = async (asset) => {
    console.log('========================================');
    console.log('🎯 APPLYING ASSET:', asset);
    console.log('🔍 Asset isEmbed:', asset.isEmbed);
    console.log('🔍 Asset modelUrl:', asset.modelUrl);
    console.log('🔍 Asset iconUrl:', asset.iconUrl);
    console.log('🔍 Asset type:', asset.type);
    console.log('🔍 Asset source:', asset.source);
    console.log('🔍 Asset id:', asset.id);
    console.log('========================================');
    
    // Save the selected asset for preview
    console.log('📝 CALLING setSelectedAsset with:', asset);
    setSelectedAsset(asset);
    console.log('✅ setSelectedAsset called');
    
    // NEW APPROACH: Try to overlay ALL models by fetching downloadable GLB
    // Even Sketchfab models can be converted/proxied through backend
    
    // PRIORITY 1: Check for MongoDB/uploaded assets (these have rpmAssetUrl or s3Url)
    if (asset._id || asset.source === 'uploaded' || asset.source === 'rpm' || asset.source === 'created-from-amazon') {
      const overlayUrl = asset.rpmAssetUrl || asset.s3Url || asset.modelUrl;
      if (overlayUrl && (overlayUrl.endsWith('.glb') || overlayUrl.endsWith('.gltf'))) {
        console.log('✅ MongoDB asset with 3D model found:', overlayUrl);
        setSelectedOutfitUrl(overlayUrl);
        setInfoMessage('');
        setError('');
        return;
      } else if (overlayUrl) {
        console.log('⚠️ MongoDB asset found but not a 3D model file:', overlayUrl);
        setInfoMessage('⚠️ This asset is not a 3D model file. Try another asset.');
        return;
      }
    }
    
    // PRIORITY 2: Sketchfab models - PREVIEW ONLY (no overlay)
    // Sketchfab models are typically ZIP archives requiring download/extraction
    // This would be too slow and storage-intensive for production
    if (asset.id && (asset.isEmbed || asset.modelUrl?.includes('sketchfab.com'))) {
      console.log('🎨 Sketchfab model detected - showing preview only');
      setInfoMessage('💡 Sketchfab models show as preview only. For overlay, use RPM Assets or Legacy Collections with ready-to-use GLB files.');
      // Keep the preview (selectedAsset) but don't set overlay URL
      return;
    }
    
    // PRIORITY 3: RPM Assets - fetch GLB URL from API
    if (asset.iconUrl && asset.id && !asset.isEmbed) {
      console.log('🔍 Attempting to fetch GLB for RPM asset:', asset.name);
      try {
        const response = await axios.get(`http://localhost:5000/api/readyplayer/assets/${asset.id}`);
        const detailedAsset = response.data;
        const glbUrl = detailedAsset.glbUrl || detailedAsset.modelUrl || detailedAsset.url || detailedAsset.model?.url;
        
        if (glbUrl && (glbUrl.endsWith('.glb') || glbUrl.endsWith('.gltf'))) {
          console.log('✅ Found 3D model URL for RPM asset:', glbUrl);
          setSelectedOutfitUrl(glbUrl);
          setInfoMessage('');
          setError('');
          return;
        } else {
          console.log('⚠️ RPM asset details:', detailedAsset);
          setInfoMessage('💡 This RPM asset does not have a downloadable file. Preview only.');
          return;
        }
      } catch (err) {
        console.error('❌ Failed to fetch RPM asset details:', err);
        setInfoMessage('💡 Could not fetch file for this RPM asset. Preview only.');
        return;
      }
    }
    
    // PRIORITY 3: Check if this is a Sketchfab model that needs GLB resolution
    if (asset.needsGlbResolution && asset.id) {
      try {
        console.log('🔍 Resolving GLB URL for Sketchfab model:', asset.id);
        setInfoMessage('⏳ Fetching 3D model file...');
        
        const response = await axios.get(`http://localhost:5000/api/wardrobe/sketchfab/resolve/${asset.id}`);
        const { glbUrl, success, message, isZip } = response.data;
        
        if (success && glbUrl && !isZip) {
          console.log('✅ Found GLB URL:', glbUrl);
          setSelectedOutfitUrl(glbUrl);
          setInfoMessage('');
          return;
        } else if (isZip) {
          console.log('⚠️ Model is a ZIP archive');
          setInfoMessage('⚠️ This model is provided as a ZIP archive and cannot be displayed directly. Sketchfab models typically require download and extraction. Try browsing the Legacy Collections or RPM assets instead for direct try-on.');
          return;
        } else {
          console.log('⚠️ No GLB available for this model');
          setInfoMessage(message || '⚠️ This model does not have a downloadable GLB file. Try another model.');
          return;
        }
      } catch (err) {
        console.error('❌ Failed to resolve GLB URL:', err);
        setInfoMessage('❌ Could not fetch 3D model file. Most Sketchfab models are provided as archives and cannot be displayed directly. Try the Legacy Collections instead.');
        return;
      }
    }
    
    // PRIORITY 4: Try generic GLB/model URL from legacy collections
    const url = asset.glbUrl || asset.modelUrl || asset.preferredModelUrl || asset.s3Url || asset.rpmAssetUrl || '';
    
    console.log('🔍 Checking generic asset URLs:');
    console.log('  - glbUrl:', asset.glbUrl);
    console.log('  - modelUrl:', asset.modelUrl);
    console.log('  - preferredModelUrl:', asset.preferredModelUrl);
    console.log('  - s3Url:', asset.s3Url);
    console.log('  - rpmAssetUrl:', asset.rpmAssetUrl);
    console.log('  - Final URL:', url);
    
    if (!url) {
      console.warn('⚠️ Asset has no valid model URL:', asset);
      setError(''); // Clear any errors
      setInfoMessage('This asset does not have a 3D model file available for try-on.');
      return;
    }
    
    // Check if it's actually a model file (not an image)
    if (url.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
      console.warn('⚠️ Asset URL is an image, not a 3D model:', url);
      setInfoMessage('This asset only has a thumbnail image, not a 3D model file.');
      return;
    }
    
    console.log('✅ Setting overlay URL:', url);
    setSelectedOutfitUrl(url);
    setInfoMessage(''); // Clear any previous messages
    setError(''); // Clear any previous errors
    console.log('🎨 Applied asset overlay:', asset.name || asset.title, 'URL:', url);
    console.log('🔗 SELECTED OUTFIT URL:', url);
    console.log('========================================');
  };

  const handleTryOn = (outfit) => {
    // Normalize the outfit URL to use preferredModelUrl when available
    const url = outfit?.preferredModelUrl || outfit?.modelUrl || outfit?.glbUrl || outfit?.itemUrl || outfit?.metadata?.url || null;
    // Only allow Try On for GLB or proxied GLB URLs. Many Sketchfab items are archives or embed-only and
    // cannot be overlaid directly. Proxied URLs from our backend will include '/api/proxy?url='.
    const overlayable = url && (url.endsWith('.glb') || url.includes('/api/proxy?url='));
    if (!overlayable) {
      alert('This outfit cannot be tried on directly. It is embed-only or an archive. Try outfits labeled "Try-on supported".');
      return;
    }

    setSelectedOutfit(outfit || null);
    setSelectedOutfitUrl(url);
  };

  const handleApplyAsset = async (asset) => {
    try {
      await ApiClient.applyAsset({ assetId: asset._id });
      // For a texture/clothing asset, simply set selectedOutfitUrl to the asset file if available
      const url = asset.rpmAssetUrl || asset.s3Url || (asset.thumbnails && asset.thumbnails[0]) || '';
      if (url) setSelectedOutfitUrl(url);
    } catch (e) {
      console.error('Failed to apply asset:', e?.message || e);
      alert('Failed to apply asset');
    }
  };

  const handleSaveOutfit = async () => {
    if (!user || !selectedOutfit) return;
    try {
      await ApiClient.saveUserOutfit(user.email, selectedOutfit.preferredModelUrl || selectedOutfit.modelUrl);
      alert('Outfit saved to your profile');
    } catch (e) {
      console.error('Failed to save outfit:', e);
      alert('Failed to save outfit');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading wardrobe...</div>;
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 720, background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>Network error</h3>
        <p style={{ marginTop: 0, color: '#6b7280' }}>The app could not reach the backend API at <code>http://localhost:5000</code>. This usually means the backend server is not running.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={() => {
            // Retry by reloading the page which will re-run the effect
            if (globalThis && globalThis.location && typeof globalThis.location.reload === 'function') {
              globalThis.location.reload();
            }
          }} style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', color: '#fff', border: 'none' }}>Retry</button>
          <button onClick={() => alert('Start backend: open a terminal and run:\ncd backend; npm run dev') } style={{ padding: '8px 12px', borderRadius: 8, background: '#e5e7eb', color: '#111827', border: 'none' }}>How to start backend</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
          <div>Suggested command (PowerShell):</div>
          <pre style={{ background: '#f3f4f6', padding: 8, borderRadius: 6 }}>cd backend; npm run dev</pre>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>
          <strong>Details:</strong> {String(error)}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <div style={{ fontWeight: 800, color: '#1f2937' }}>VirtualDressing</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            onClick={() => router.push('/asset-creator')} 
            style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>✨</span>
            <span>Create Asset</span>
          </button>
          {user && (
            <button onClick={() => router.push('/profile')} style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, fontWeight: 700, color: '#111827' }} aria-label="Open profile">
              {user.username || user.email}
            </button>
          )}
          <button onClick={() => { localStorage.removeItem('userEmail'); router.push('/login'); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#ef4444', color: 'white', border: 'none' }}>Logout</button>
          <button onClick={() => router.push('/tryon2d')} style={{ padding: '8px 12px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none' }}>2D Try-On</button>
        </div>
      </nav>

      {/* RPM Iframe - COMMENTED OUT - Using asset overlay instead */}
      {/* {avatarUrl && (
        <div style={{ margin: '20px', background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>
              Ready Player Me - Avatar Creator 🎨
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>
              Create or customize your avatar - changes save automatically when you click "Done"!
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
              Current avatar: {avatarUrl}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#fef3c7', background: 'rgba(254,243,199,0.15)', padding: '8px 12px', borderRadius: 6 }}>
              💡 Tip: You can start fresh or customize your existing avatar. Click "Done" in the iframe to save changes.
            </p>
          </div>
          <div style={{ padding: 16 }}>
            <iframe
              ref={iframeRef}
              src={`https://${subdomain}.readyplayer.me/avatar?frameApi&bodyType=fullbody&clearCache`}
              allow="camera *; microphone *; clipboard-write"
              title="Ready Player Me Avatar Customizer"
              style={{ width: '100%', height: '600px', border: 'none', borderRadius: 8 }}
            />
          </div>
        </div>
      )} */}

      <div style={{ display: 'flex', gap: 20, padding: 20, alignItems: 'flex-start' }}>
        <div style={{ width: '40%', minWidth: 360 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: '6px 0', fontSize: 18, fontWeight: 800 }}>Your Avatar</h2>
              {selectedOutfitUrl && (
                <div style={{ 
                  background: '#10b981', 
                  color: '#fff', 
                  padding: '4px 12px', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  fontWeight: 700,
                  animation: 'pulse 2s infinite'
                }}>
                  🎨 OVERLAY ACTIVE
                </div>
              )}
            </div>
            {selectedOutfitUrl && (
              <div style={{ 
                background: '#ecfdf5', 
                border: '1px solid #10b981', 
                borderRadius: 6, 
                padding: 8, 
                marginBottom: 8,
                fontSize: 11
              }}>
                <strong>Overlaying:</strong> {selectedAsset?.name || selectedAsset?.title || 'Clothing Item'}
              </div>
            )}
            <div style={{ width: '100%', height: 560 }}>
              {avatarUrl ? (
                <>
                  {console.log('🎭 Rendering WardrobeViewer with:', { avatarUrl, selectedOutfitUrl })}
                  {console.log('🔗 OUTFIT URL TYPE:', typeof selectedOutfitUrl, 'VALUE:', selectedOutfitUrl)}
                  <WardrobeViewer avatarUrl={avatarUrl} outfitUrl={selectedOutfitUrl} />
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>No Avatar Yet</h3>
                  <p style={{ color: '#6b7280', marginBottom: 16 }}>Create your 3D avatar to try on outfits</p>
                  <button 
                    onClick={() => router.push('/avatar-creator')} 
                    style={{ padding: '10px 20px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Create Avatar
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { 
                  setSelectedOutfit(null); 
                  setSelectedOutfitUrl(null); 
                  setSelectedAsset(null);
                  setInfoMessage('');
                  console.log('🧹 Cleared outfit and asset selection');
                }} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  background: selectedOutfitUrl ? '#ef4444' : '#9ca3af', 
                  color: '#fff', 
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {selectedOutfitUrl ? '✖️ Clear Overlay' : 'Clear'}
              </button>
              <button 
                onClick={handleSaveOutfit} 
                disabled={!selectedOutfit || !avatarUrl} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  background: (selectedOutfit && avatarUrl) ? '#111827' : '#d1d5db', 
                  color: '#fff', 
                  border: 'none',
                  cursor: (selectedOutfit && avatarUrl) ? 'pointer' : 'not-allowed'
                }}
              >
                Save Outfit
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} key={`preview-wrapper-${selectedAsset?.id || 'empty'}`}>
          {/* Sketchfab/Asset Model Preview - shown when any asset is selected */}
          {console.log('🖼️ RENDERING PREVIEW SECTION, selectedAsset:', selectedAsset)}
          {selectedAsset && (
            <>
            {console.log('✅ PREVIEW CONDITIONAL TRUE, rendering preview for:', selectedAsset.name)}
            <div key={`preview-${selectedAsset.id}`} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Selected: {selectedAsset.name} 👀</h2>
                <button 
                  onClick={() => { setSelectedAsset(null); setSelectedOutfitUrl(null); }}
                  style={{ padding: '6px 12px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}
                >
                  Clear
                </button>
              </div>
              <div style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
                {selectedAsset.isEmbed || selectedAsset.modelUrl?.includes('sketchfab.com/models') ? (
                  <SketchfabModelViewer 
                    modelUrl={selectedAsset.modelUrl} 
                    alt={selectedAsset.name} 
                    forceEmbed={true} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                    <img src={selectedAsset.thumbnail || selectedAsset.iconUrl} alt={selectedAsset.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                    <p style={{ fontSize: 14, color: '#6b7280' }}>{selectedAsset.name}</p>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                {selectedAsset.isEmbed ? (
                  <span>� <strong>Preview Only</strong> - Sketchfab models are ZIP archives and cannot be overlaid. Use Legacy Collections for overlay.</span>
                ) : (
                  <span>� This model is being overlaid on your avatar on the left</span>
                )}
              </p>
            </div>
            </>
          )}

          {/* Assets Catalog with Tabs */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Assets Catalog 🎭</h2>
            <div style={{ background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: '#1e40af', margin: 0 }}>
                ✨ <strong>RPM Assets</strong> support full overlay (click to try on)<br/>
                👀 <strong>Sketchfab Models</strong> show preview only (ZIP archives require download)<br/>
                💡 For best overlay experience, use RPM Assets or Legacy Collections
              </p>
            </div>
            
            {/* Tab Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '2px solid #e5e7eb', paddingBottom: 12 }}>
              <button 
                onClick={() => { setActiveTab('rpm'); fetchRpmAssets(); }}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px 8px 0 0', 
                  background: activeTab === 'rpm' ? '#3b82f6' : '#f3f4f6', 
                  color: activeTab === 'rpm' ? '#fff' : '#111827', 
                  border: 'none', 
                  cursor: 'pointer',
                  fontWeight: activeTab === 'rpm' ? 700 : 500,
                  fontSize: 14
                }}
              >
                🎨 Ready Player Me Assets
              </button>
              <button 
                onClick={() => { 
                  console.log('🖱️ SKETCHFAB TAB CLICKED!');
                  setActiveTab('sketchfab');
                  // Fetch immediately when clicked (useEffect will also trigger if needed)
                  setTimeout(() => fetchSketchfabAssets(), 100);
                }}
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px 8px 0 0', 
                  background: activeTab === 'sketchfab' ? '#3b82f6' : '#f3f4f6', 
                  color: activeTab === 'sketchfab' ? '#fff' : '#111827', 
                  border: 'none', 
                  cursor: 'pointer',
                  fontWeight: activeTab === 'sketchfab' ? 700 : 500,
                  fontSize: 14
                }}
              >
                🎭 Sketchfab 3D Models
              </button>
            </div>

            {/* Filters for RPM */}
            {activeTab === 'rpm' && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <select 
                  value={assetType} 
                  onChange={(e) => setAssetType(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
                >
                  <option value="all">All Types</option>
                  <option value="outfit">Outfit</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="footwear">Footwear</option>
                  <option value="glasses">Glasses</option>
                  <option value="facewear">Facewear</option>
                </select>
                <select 
                  value={assetGender} 
                  onChange={(e) => setAssetGender(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff' }}
                >
                  <option value="">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="neutral">Neutral</option>
                </select>
                <button 
                  onClick={fetchRpmAssets}
                  style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Apply Filters
                </button>
              </div>
            )}

            {/* Search for Sketchfab */}
            {activeTab === 'sketchfab' && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Sketchfab (character, avatar, clothing, accessories, etc.)"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSketchfabAssets()}
                />
                <button 
                  onClick={fetchSketchfabAssets}
                  style={{ padding: '8px 16px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Search
                </button>
              </div>
            )}

            {/* Info Message Display */}
            {infoMessage && (
              <div style={{ background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: '#075985', margin: 0 }}>{infoMessage}</p>
              </div>
            )}

            {/* Assets Grid */}
            {loadingAssets ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: 16, color: '#6b7280' }}>Loading assets...</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, maxHeight: '600px', overflowY: 'auto' }}>
                {activeTab === 'rpm' && rpmAssets.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>👔</div>
                    <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No RPM assets loaded</p>
                    <p style={{ fontSize: 14, marginBottom: 16 }}>Select filters and click "Apply Filters" to load assets.</p>
                    <p style={{ fontSize: 13, color: '#3b82f6', background: '#eff6ff', padding: '12px', borderRadius: 8, marginTop: 16 }}>
                      ℹ️ <strong>Tip:</strong> We'll attempt to load GLB files from RPM assets when you click them. If they don't have downloadable models, you can apply them through the RPM editor at the top, or use Legacy Collections below for guaranteed try-on overlays.
                    </p>
                  </div>
                )}
                {activeTab === 'sketchfab' && sketchfabAssets.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                    <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No Sketchfab assets found</p>
                    <p style={{ fontSize: 14, marginBottom: 16 }}>The Sketchfab API may be rate-limited or unavailable.</p>
                    <p style={{ fontSize: 13, color: '#9ca3af' }}>
                      💡 <strong>Tip:</strong> Use the RPM Assets tab instead for clothing options, or try searching for different terms.
                    </p>
                    <button 
                      onClick={() => setActiveTab('rpm')}
                      style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Switch to RPM Assets
                    </button>
                  </div>
                )}
                {activeTab === 'rpm' && rpmAssets.map((asset, idx) => (
                  <div 
                    key={asset.id || idx}
                    style={{ 
                      background: '#f9fafb', 
                      borderRadius: 8, 
                      overflow: 'hidden', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      border: '1px solid #e5e7eb'
                    }}
                    onClick={() => applyAssetOverlay(asset)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {asset.iconUrl ? (
                      <img 
                        src={asset.iconUrl} 
                        alt={asset.name}
                        style={{ width: '100%', height: 140, objectFit: 'cover', background: '#e5e7eb' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: 140, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40 }}>
                        👕
                      </div>
                    )}
                    <div style={{ padding: 10 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.name || 'Unnamed'}
                      </h4>
                      {asset.type && (
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>
                          {asset.type}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {activeTab === 'sketchfab' && sketchfabAssets.map((asset, idx) => (
                  <div 
                    key={asset.id || idx}
                    style={{ 
                      background: '#f9fafb', 
                      borderRadius: 8, 
                      overflow: 'hidden', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      border: '1px solid #e5e7eb',
                      position: 'relative'
                    }}
                    onClick={() => applyAssetOverlay(asset)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, background: '#3b82f6', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 6px', borderRadius: 4 }}>
                      PREVIEW ONLY
                    </div>
                    {asset.thumbnail ? (
                      <img 
                        src={asset.thumbnail} 
                        alt={asset.name}
                        style={{ width: '100%', height: 140, objectFit: 'cover', background: '#e5e7eb' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: 140, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40 }}>
                        🎨
                      </div>
                    )}
                    <div style={{ padding: 10 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.name || 'Unnamed'}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Original Legacy Collections Section - REMOVED, using tabs above instead */}
          {/* Use the Assets Catalog with RPM and Sketchfab tabs for all model browsing */}

          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>RPM/Mongo Assets (Legacy)</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', background: '#d1fae5', padding: '4px 10px', borderRadius: 6 }}>
                ✓ OVERLAY SUPPORTED
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}>
                {assets.length} items
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {assets.map(asset => (
                <div key={asset._id} style={{ background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                  <div style={{ height: 160, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 8 }}>
                    {asset.thumbnails?.[0] ? (
                      <img src={asset.thumbnails[0]} alt={asset.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ color: '#9ca3af' }}>No preview</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{asset.title}</div>
                    <button onClick={() => applyAssetOverlay(asset)} style={{ padding: '6px 10px', borderRadius: 8, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer' }}>Try On</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default Wardrobe;
