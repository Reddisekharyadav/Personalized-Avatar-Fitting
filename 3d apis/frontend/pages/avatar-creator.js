import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ApiClient from '../utils/api';
import { Loader2, Sparkles, Upload, Save } from 'lucide-react';

export default function AvatarCreator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const rpmSubdomain = process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || 'mango-xwpbk6';
  const iframeUrl = `https://${rpmSubdomain}.readyplayer.me/avatar?frameApi&bodyType=fullbody&clearCache`;

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const email = localStorage.getItem('userEmail');
      if (!email) {
        router.push('/login');
        return;
      }
      
      setUser({ email });
      setAuthLoading(false);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  // Handle RPM messages
  useEffect(() => {
    const handleAvatarExport = (event) => {
      // Accept RPM messages from any readyplayer.me origin
      if (!String(event.origin).includes('readyplayer.me')) return;
      
      // Skip non-JSON messages
      if (typeof event.data === 'string' && event.data.startsWith('http')) {
        return;
      }

      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.source !== 'readyplayerme') return;
        
        const { eventName, data } = msg;

        // Handle both v1 and v2 avatar export events
        if (eventName === 'v1.avatar.exported' || eventName === 'v2.avatar.exported') {
          let url = data?.url;
          const avatarId = data?.avatarId || data?.id;
          const metadata = data?.metadata;
          
          // Ensure .glb extension
          if (url && !url.endsWith('.glb') && !url.includes('.glb?')) {
            url = `${url}.glb`;
          }
          
          console.log('Avatar exported:', { 
            eventName, 
            url, 
            avatarId, 
            metadata 
          });
          
          setAvatarUrl(url);
          
          // Store avatar ID and metadata
          if (avatarId) {
            localStorage.setItem('rpmAvatarId', avatarId);
          }
          if (metadata) {
            localStorage.setItem('rpmAvatarMetadata', JSON.stringify(metadata));
          }
        }
      } catch (e) {
        console.debug('Ignored non-JSON RPM message:', event.data);
      }
    };

    window.addEventListener('message', handleAvatarExport);
    return () => window.removeEventListener('message', handleAvatarExport);
  }, [user]);

  const handleSaveAvatar = async () => {
    if (!avatarUrl) {
      setError('No avatar to save');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await ApiClient.saveAvatar({ avatarUrl });
      
      // Show success and redirect
      setTimeout(() => {
        router.push('/wardrobe');
      }, 1500);
    } catch (err) {
      console.error('Error saving avatar:', err);
      setError('Failed to save avatar. Please try again.');
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading avatar creator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Virtual Dressing
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/wardrobe')}
                className="text-gray-700 hover:text-blue-600 font-medium transition"
              >
                My Wardrobe
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="text-gray-700 hover:text-blue-600 font-medium transition"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  router.push('/login');
                }}
                className="text-gray-700 hover:text-red-600 font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-8 h-8 text-blue-600" />
                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                  Create Your Avatar
                </h1>
              </div>
              <p className="text-gray-600 text-lg">
                Upload your photo or customize your 3D avatar with Ready Player Me
              </p>
              <div className="mt-4 inline-flex items-center bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
                <Sparkles className="w-4 h-4 mr-2" />
                <span>Subdomain: <strong>{rpmSubdomain}.readyplayer.me</strong></span>
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <h3 className="font-bold text-blue-900 mb-2">📸 How to Create Your Avatar:</h3>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
                <li>Look for <strong>"Upload Photo"</strong> or camera icon in the creator below</li>
                <li>Upload a clear, front-facing photo of yourself</li>
                <li>Wait 30-60 seconds for avatar generation</li>
                <li>Customize appearance (hair, clothes, accessories) - optional</li>
                <li>Click <strong>"Done"</strong> or <strong>"Next"</strong> in the RPM interface</li>
                <li>Click the <strong>"Save Avatar"</strong> button that appears below</li>
              </ol>
            </div>
          </div>

          {/* Avatar Creator Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* RPM Iframe */}
            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
              <iframe
                src={iframeUrl}
                className="w-full"
                style={{ height: '90vh', minHeight: '800px' }}
                allow="camera *; microphone *; clipboard-write"
                title="Ready Player Me Avatar Creator"
              />
            </div>

            {/* Avatar Saved Success */}
            {avatarUrl && (
              <div className="mt-6 space-y-4 animate-fade-in">
                {/* Success Banner */}
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                  <p className="text-sm text-green-700 font-semibold">
                    ✓ Avatar exported successfully! Review and save your avatar below.
                  </p>
                </div>

                {/* Avatar Info */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                    Your 3D Avatar is Ready!
                  </h3>
                  
                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Avatar preview may not load here due to RPM rate limits. 
                      Your avatar will be fully visible in your wardrobe after saving!
                    </p>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 rounded text-xs break-all">
                    <strong>Captured Avatar URL:</strong> {avatarUrl}
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveAvatar}
                    disabled={saving}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Saving to Wardrobe...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save Avatar & Go to Wardrobe</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-gray-600 mt-3">
                    After saving, you can view and use your avatar in the wardrobe
                  </p>
                </div>
              </div>
            )}

            {/* Skip Option */}
            {!avatarUrl && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => router.push('/wardrobe')}
                  className="text-gray-600 hover:text-gray-800 font-medium underline"
                >
                  Skip for now and go to wardrobe
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
