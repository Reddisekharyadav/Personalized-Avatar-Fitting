'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThreeAvatarViewer from '../../components/ThreeAvatarViewer';

/**
 * Wardrobe Page
 * Requirement E & C: Show avatar and asset gallery
 * User can view their 3D avatar and apply different clothing assets
 * 
 * Features:
 * - Display user's avatar in 3D viewer
 * - Show available assets (public + user's custom assets)
 * - Click asset to apply to avatar
 * - Link to create new assets from Amazon
 */

export default function WardrobePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('public'); // 'public' | 'my-assets'

  // Fetch user avatar on mount
  useEffect(() => {
    fetchUserAvatar();
    fetchAssets('public');
  }, []);

  const fetchUserAvatar = async () => {
    try {
      const response = await fetch('/api/avatar/me', {
        credentials: 'include' // Send cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch avatar');
      }

      const data = await response.json();
      setAvatar(data.avatar);
      setUser(data.user);
      setLoading(false);
    } catch (err) {
      console.error('Fetch avatar error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchAssets = async (owner = 'public') => {
    try {
      const response = await fetch(`/api/assets?owner=${owner}&limit=50`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      const data = await response.json();
      setAssets(data.assets || []);
    } catch (err) {
      console.error('Fetch assets error:', err);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    fetchAssets(tab === 'my-assets' ? 'me' : 'public');
  };

  const handleAssetClick = async (asset) => {
    console.log('Applying asset:', asset);
    setSelectedAsset(asset);

    try {
      // Call apply endpoint (Requirement C)
      const response = await fetch('/api/assets/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assetId: asset._id })
      });

      if (!response.ok) {
        throw new Error('Failed to apply asset');
      }

      const data = await response.json();
      console.log('Asset applied:', data);
      
      // The ThreeAvatarViewer will automatically apply the asset via the assetUrl prop
    } catch (err) {
      console.error('Apply asset error:', err);
      alert('Failed to apply asset. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Loading your wardrobe...</p>
        </div>
      </div>
    );
  }

  if (error || !avatar) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {avatar ? 'Error Loading Wardrobe' : 'No Avatar Found'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'Please create an avatar to access your wardrobe.'}
          </p>
          <button
            onClick={() => router.push('/signup')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Create Avatar
          </button>
        </div>
      </div>
    );
  }

  // Get the asset URL to display (S3 or RPM URL)
  const currentAssetUrl = selectedAsset?.rpmAssetUrl || selectedAsset?.s3Url;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">My Wardrobe</h1>
              {user && (
                <p className="text-sm text-gray-600">Welcome, {user.username || user.email}</p>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/assets/create')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center"
              >
                <span className="mr-2">+</span>
                Add from Amazon
              </button>
              <button
                onClick={() => {
                  // Clear auth and redirect to login
                  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                  router.push('/login');
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Avatar</h2>
              
              <ThreeAvatarViewer
                avatarUrl={avatar.s3Url}
                assetUrl={currentAssetUrl}
                onLoadComplete={(gltf) => console.log('Avatar loaded:', gltf)}
                onError={(err) => console.error('Viewer error:', err)}
                className="rounded-lg overflow-hidden"
              />

              {selectedAsset && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    Currently wearing: {selectedAsset.title}
                  </p>
                  {selectedAsset.description && (
                    <p className="text-sm text-blue-600 mt-1">
                      {selectedAsset.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assets Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Assets</h2>

              {/* Tabs */}
              <div className="flex space-x-2 mb-4 border-b">
                <button
                  onClick={() => handleTabChange('public')}
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'public'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Public Assets
                </button>
                <button
                  onClick={() => handleTabChange('my-assets')}
                  className={`px-4 py-2 font-medium ${
                    activeTab === 'my-assets'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  My Assets
                </button>
              </div>

              {/* Asset Grid */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {assets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="mb-4">No assets found</p>
                    {activeTab === 'my-assets' && (
                      <button
                        onClick={() => router.push('/assets/create')}
                        className="text-blue-600 hover:underline"
                      >
                        Create your first asset
                      </button>
                    )}
                  </div>
                ) : (
                  assets.map((asset) => (
                    <button
                      key={asset._id}
                      onClick={() => handleAssetClick(asset)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition ${
                        selectedAsset?._id === asset._id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {asset.thumbnails && asset.thumbnails.length > 0 && (
                        <img
                          src={asset.thumbnails[0]}
                          alt={asset.title}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}
                      <h3 className="font-medium text-gray-800">{asset.title}</h3>
                      {asset.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {asset.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 capitalize">
                          {asset.source.replace(/-/g, ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          asset.status === 'ready' 
                            ? 'bg-green-100 text-green-800' 
                            : asset.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {asset.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
