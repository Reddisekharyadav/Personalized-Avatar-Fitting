import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import ApiClient from '../utils/api';
import loadModelViewer from '../utils/loadModelViewer';
import { Sparkles, User, LogOut } from 'lucide-react';

export default function Avatar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [readyPlayerUserId, setReadyPlayerUserId] = useState('');
  const [rpmToken, setRpmToken] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const subdomain = process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || 'mango-xwpbk6';

  useEffect(() => {
    loadModelViewer().catch((err) => console.error('Failed to load model-viewer:', err));

    // Check if user logged in
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      router.push('/login');
      return;
    }
    setEmail(userEmail);

    // Fetch profile to get readyPlayerUserId
    (async () => {
      try {
        const profile = await ApiClient.getUserProfile(userEmail);
        const userId = profile.user?.readyPlayerUserId;
        if (userId) {
          setReadyPlayerUserId(userId);
          await refreshToken(userId);
        } else {
          setError('No Ready Player Me account found. Please contact support.');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile');
      }
    })();
  }, [router]);

  const refreshToken = async (userId) => {
    if (!userId) return;
    try {
      const resp = await ApiClient.getRpmToken({ userId });
      setRpmToken(resp?.token || '');
    } catch (err) {
      console.error('Failed to get RPM token:', err);
      setError('Failed to get Ready Player Me token');
    }
  };

  useEffect(() => {
    function handleMessage(event) {
      // Accept RPM messages
      if (!String(event.origin).includes('readyplayer.me')) return;
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.source !== 'readyplayerme') return;
        const { eventName, data } = msg;

        if (eventName === 'v1.avatar.exported') {
          // User completed avatar creation
          const url = data?.url;
          setAvatarUrl(url);
          handleSaveAvatar(url);
        }

        if (eventName === 'v1.user.authorized') {
          // User authorized RPM account; link it
          const newUserId = data?.userId;
          if (newUserId) {
            handleLinkAccount(newUserId);
          }
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [email]);

  const handleSaveAvatar = async (url) => {
    setBusy(true);
    try {
      await ApiClient.saveAvatar({ avatarUrl: url });
      setError('');
    } catch (err) {
      setError('Failed to save avatar');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkAccount = async (newUserId) => {
    setBusy(true);
    try {
      await ApiClient.linkRpm({ email, newUserId });
      setReadyPlayerUserId(newUserId);
      // Refresh token with new user ID
      await refreshToken(newUserId);
      setError('');
    } catch (err) {
      setError('Failed to link RPM account');
    } finally {
      setBusy(false);
    }
  };

  const tokenParam = rpmToken ? `&token=${rpmToken}` : '';
  const iframeUrl = `https://${subdomain}.readyplayer.me/avatar?frameApi${tokenParam}`;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading your avatar editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Avatar Editor
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/wardrobe')}
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 font-medium transition-colors"
              >
                Wardrobe
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2 text-gray-700 hover:text-indigo-600 font-medium transition-colors flex items-center space-x-2"
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-700 hover:text-red-600 font-medium transition-colors flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            ✨ Edit Your 3D Avatar
          </h2>
          <p className="text-gray-600 text-lg">
            Customize your Ready Player Me avatar. Changes are saved automatically.
          </p>
          <div className="mt-4 inline-flex items-center bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            <span>Subdomain: <strong>{subdomain}.readyplayer.me</strong></span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* RPM Iframe Editor */}
        {readyPlayerUserId && rpmToken && (
          <div className="max-w-6xl mx-auto mb-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <iframe
                ref={iframeRef}
                title="Ready Player Me Avatar Editor"
                src={iframeUrl}
                className="w-full border-0 rounded-2xl"
                style={{ height: '90vh', minHeight: '800px' }}
                allow="camera *; microphone *; clipboard-write"
              />
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                💡 How to use:
              </h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="font-semibold mr-2">1.</span>
                  <span>Customize your avatar using the editor above</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold mr-2">2.</span>
                  <span>Try on different hairstyles, outfits, and accessories</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold mr-2">3.</span>
                  <span>Your changes are automatically saved when you export</span>
                </li>
                <li className="flex items-start">
                  <span className="font-semibold mr-2">4.</span>
                  <span>Visit the Wardrobe to try on outfits with your avatar</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Avatar Preview */}
        {avatarUrl && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <Sparkles className="w-6 h-6 mr-2 text-indigo-600" />
                ✅ Avatar Saved Successfully!
              </h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden" style={{ height: '500px' }}>
                <model-viewer
                  src={avatarUrl}
                  alt="Your 3D Avatar"
                  camera-controls
                  auto-rotate
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <button
                onClick={() => router.push('/wardrobe')}
                className="mt-6 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                🎨 Go to Wardrobe
              </button>
            </div>
          </div>
        )}

        {/* Busy Indicator */}
        {busy && (
          <div className="max-w-4xl mx-auto mt-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-blue-700 font-medium">Saving your avatar...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
