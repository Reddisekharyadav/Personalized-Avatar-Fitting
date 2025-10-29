import { useEffect, useState } from 'react';
import axios from 'axios';
import OutfitViewer from '../components/OutfitViewer';

export default function Viewer() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [outfitUrl, setOutfitUrl] = useState('');
  const [showViewer, setShowViewer] = useState(false);

  const handleView = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/user/${email}`);
      const { avatarGlbUrl, outfitGlbUrl } = res.data.user;
      
      // Resolve URLs for external models
      const resolvedAvatarUrl = resolveUrl(avatarGlbUrl);
      const resolvedOutfitUrl = resolveUrl(outfitGlbUrl);
      
      setAvatarUrl(resolvedAvatarUrl);
      setOutfitUrl(resolvedOutfitUrl);
      setShowViewer(true);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load avatar or outfit for this email.');
      setShowViewer(false);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to resolve URLs for proxying
  const resolveUrl = (u) => {
    if (!u) return u;
    try {
      if (u.startsWith('http://localhost:5000') || u.startsWith(window.location.origin)) return u;
      if (!u.startsWith('http')) return u;
      
      // Better detection of file type from URL
      const urlLower = u.toLowerCase().split('?')[0];
      // GLB files are binary and self-contained
      const isGlb = urlLower.endsWith('.glb');
      // GLTF files have external dependencies like scene.bin
      const isGltf = urlLower.endsWith('.gltf') || 
                     urlLower.includes('/scene.gltf') || 
                     urlLower.includes('-scene.gltf');
      
      // Determine file type
      let fileType = 'other';
      if (isGlb) {
        fileType = 'GLB';
      } else if (isGltf) {
        fileType = 'GLTF';
      }
      
      // Debug logging to help troubleshoot
      console.log(`Viewer resolving URL: ${u}, detected as ${fileType}`);
      
      if (isGlb) {
        // For GLB files (self-contained) we can proxy directly
        return `http://localhost:5000/api/proxy?url=${encodeURIComponent(u)}`;
      } else if (isGltf) {
        // Use resource proxy for GLTF files which handles resource resolution
        return `http://localhost:5000/api/proxy/resource?url=${encodeURIComponent(u)}`;
      } else {
        // For unknown formats, try the resource proxy to be safe
        console.log('Unknown format in viewer, using resource proxy:', u);
        return `http://localhost:5000/api/proxy/resource?url=${encodeURIComponent(u)}`;
      }
    } catch (e) {
      console.error('resolveUrl error', e);
      return u;
    }
  };

  useEffect(() => {
    document.body.style.background = 'radial-gradient(circle at 40% 60%, #f0fdfa 0%, #e0e7ff 100%)';
    return () => { document.body.style.background = ''; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-400 animate-pulse drop-shadow-lg">3D Try-On Viewer</h1>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="mb-4 px-3 py-2 border rounded w-full max-w-xs animate-fade-in"
        required
      />
      <button
        className="mb-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg hover:scale-105 hover:bg-blue-700 transition-all animate-fade-in"
        onClick={handleView}
        disabled={loading || !email}
      >
        {loading ? 'Loading...' : 'View My Try-On'}
      </button>
      
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden animate-float-in">
        {showViewer ? (
          <OutfitViewer 
            avatarUrl={avatarUrl}
            outfitUrl={outfitUrl}
            height={500}
            autoRotate={true}
            backgroundColor="#f8f9fa"
            scale={1}
            offsetY={0}
          />
        ) : (
          <div className="h-[500px] flex items-center justify-center bg-gray-100 text-gray-400">
            {loading ? 'Loading avatar...' : 'Enter your email and click "View My Try-On" to see your 3D avatar'}
          </div>
        )}
      </div>
      
      {error && <div className="text-red-500 mt-2 animate-fade-in">{error}</div>}
      <p className="mt-4 text-gray-500 animate-fade-in">Powered by model-viewer Web Component</p>
    </div>
  );
}
