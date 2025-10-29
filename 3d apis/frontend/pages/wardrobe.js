import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import WardrobeViewer from '../components/WardrobeViewer';
import SketchfabModelViewer from '../components/SketchfabModelViewer';
import { resolveModelUrl } from '../utils/modelUtils';
import ApiClient from '../utils/api';
import axios from 'axios';
import loadModelViewer from '../utils/loadModelViewer';

const Wardrobe = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [outfits, setOutfits] = useState([]);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [selectedOutfitUrl, setSelectedOutfitUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productLinkInput, setProductLinkInput] = useState('');
  const [productImageInput, setProductImageInput] = useState(null);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState('');
  const [tryOnImages, setTryOnImages] = useState([]);

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (!email) {
      router.push('/login');
      return;
    }
    // Ensure model-viewer is loaded once to avoid duplicate define errors
    loadModelViewer().catch(err => console.error('Failed loading model-viewer:', err));
    // Define reusable loader so Retry button can call it
    async function loadData() {
      try {
        setLoading(true);
        setError('');
        const profile = await ApiClient.getUserProfile(email);
        setUser(profile.user || null);
        const avatar = (profile.user && profile.user.avatarGlbUrl) || '/default-avatar.glb';
        setAvatarUrl(avatar);

        // fetch outfits for user (backend returns { items: [...] })
        const wardrobeEmail = profile.user?.email || email;
        const resp = await axios.get(`http://localhost:5000/api/wardrobe/${encodeURIComponent(wardrobeEmail)}`);
        let items = resp.data?.items || [];

        // If the user has very few outfits, fetch additional Sketchfab search results
        // and merge them, prioritizing try-on capable items.
        if (!items || items.length <= 2) {
          try {
            const qterm = searchQuery || 'clothes';
            const sf = await axios.get(`http://localhost:5000/api/wardrobe/sketchfab/search?q=${encodeURIComponent(qterm)}`);
            const sfItems = sf.data?.items || [];
            // Prefer items that have tryOnSupported === true
            const tryOn = sfItems.filter(i => i.tryOnSupported).map(i => ({ id: i.id, name: i.name, description: i.description || '', modelUrl: i.modelUrl, preferredModelUrl: i.preferredModelUrl, thumbnail: i.thumbnail, tryOnSupported: i.tryOnSupported }));
            const others = sfItems.filter(i => !i.tryOnSupported).map(i => ({ id: i.id, name: i.name, description: i.description || '', modelUrl: i.modelUrl, preferredModelUrl: i.preferredModelUrl, thumbnail: i.thumbnail, tryOnSupported: i.tryOnSupported }));
            items = (items || []).concat(tryOn).concat(others);
          } catch (sfErr) {
            console.warn('Sketchfab search fetch failed:', sfErr && sfErr.message);
          }
        }

        setOutfits(items);
      } catch (e) {
        console.error('Failed to load wardrobe:', e);
        setError(e?.message || 'Failed to load wardrobe data');
      } finally {
        setLoading(false);
      }
    }

    // initial load
    loadData();
  }, [router]);

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
            window.location.reload();
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <div style={{ fontWeight: 800, color: '#1f2937' }}>VirtualDressing</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {user && (
            <button onClick={() => router.push('/profile')} style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, fontWeight: 700, color: '#111827' }} aria-label="Open profile">
              {user.username || user.email}
            </button>
          )}
          <button onClick={() => { localStorage.removeItem('userEmail'); router.push('/login'); }} style={{ padding: '8px 12px', borderRadius: 8, background: '#ef4444', color: 'white', border: 'none' }}>Logout</button>
          <button onClick={() => router.push('/tryon2d')} style={{ padding: '8px 12px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none' }}>2D Try-On</button>
        </div>
      </nav>

      <div style={{ display: 'flex', gap: 20, padding: 20, alignItems: 'flex-start' }}>
        <div style={{ width: '40%', minWidth: 360 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '6px 0 12px', fontSize: 18, fontWeight: 800 }}>Your Avatar</h2>
            <div style={{ width: '100%', height: 560 }}>
              {/* Normalize outfit url from possible fields */}
              {/* Use selectedOutfitUrl string so WardrobeViewer sees a primitive change and updates reliably */}
              <WardrobeViewer avatarUrl={avatarUrl} outfitUrl={selectedOutfitUrl} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedOutfit(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#9ca3af', color: '#fff', border: 'none' }}>Clear</button>
              <button onClick={handleSaveOutfit} disabled={!selectedOutfit} style={{ padding: '8px 12px', borderRadius: 8, background: selectedOutfit ? '#111827' : '#d1d5db', color: '#fff', border: 'none' }}>Save Outfit</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Collections</h2>
            <div>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search outfits" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {outfits.length === 0 && <div>No outfits available</div>}
            {outfits.filter(o => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (o.name && o.name.toLowerCase().includes(q)) || (o.description && o.description.toLowerCase().includes(q));
            }).map((o) => (
              <div key={o.id || o._id || `${o.name}-${Math.random().toString(36).slice(2,7)}`} style={{ background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 300, marginBottom: 8 }}>
                              {(() => {
                                // Prefer preferredModelUrl for previews and try-on
                                const modelUrl = o.preferredModelUrl || o.modelUrl || o.glbUrl || o.model?.url || o.metadata?.url || '';
                                if (!modelUrl) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No preview</div>;
                                // Resolve the preview URL so local/public paths are routed to backend
                                const previewUrl = resolveModelUrl(modelUrl) || modelUrl;
                                if (modelUrl.includes('sketchfab.com')) {
                                  return <SketchfabModelViewer modelUrl={modelUrl} alt={o.name} forceEmbed={true} />;
                                }
                                return (
                                  <div style={{ width: '100%', height: '100%' }}>
                                    <model-viewer src={previewUrl} alt={o.name} camera-controls auto-rotate style={{ width: '100%', height: '100%' }} />
                                  </div>
                                );
                              })()}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{o.description}</div>
                    { o.tryOnSupported ? <div style={{ marginTop: 6, display: 'inline-block', padding: '4px 8px', background: '#10b981', color: 'white', borderRadius: 6, fontSize: 11 }}>Try-on supported</div> : null }
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {
                      // Determine if this outfit supports direct Try On
                      (() => {
                        const originalModelUrl = o.preferredModelUrl || o.modelUrl || o.glbUrl || o.metadata?.url || '';
                        const resolvedForTry = originalModelUrl ? resolveModelUrl(originalModelUrl) : '';
                        const canTry = o.tryOnSupported ? true : (resolvedForTry && (resolvedForTry.endsWith('.glb') || resolvedForTry.includes('/api/proxy?url=')));
                        let label = 'Embed only';
                        if (o.tryOnSupported) label = 'Try On (supported)';
                        else if (canTry) label = 'Try On';
                        return (
                          <button onClick={() => handleTryOn(o)} disabled={!canTry} title={!canTry ? 'Try On requires a GLB (this item is embed-only)' : 'Try On this outfit'} style={{ padding: '8px 12px', borderRadius: 8, background: canTry ? '#111827' : '#9ca3af', color: '#fff', border: 'none' }}>{label}</button>
                        );
                      })()
                    }
                    <a href={o.modelUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', borderRadius: 8, background: '#e5e7eb', color: '#111827', textDecoration: 'none', textAlign: 'center' }}>Open</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wardrobe;
