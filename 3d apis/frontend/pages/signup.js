import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import ApiClient, { setAuthToken } from '../utils/api';
import loadModelViewer from '../utils/loadModelViewer';

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Removed unused photoFile
  // Removed photoBase64, gender, bodyType state
  // Removed readyPlayerUserId and rpmToken - using generic iframe URL
  const iframeRef = useRef(null);
  // RPM subdomain for Ready Player Me (from env for consistency)
  const rpmSubdomain = process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || 'mango-xwpbk6';
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const rpmDebug = String(process.env.NEXT_PUBLIC_RPM_DEBUG) === 'true';
  // Remove iframe ref and subdomain

  useEffect(() => {
    loadModelViewer().catch((err) => console.error('Failed to load model-viewer:', err));
  }, []);

  useEffect(() => {
    function logDebug(msg, data) {
      if (!rpmDebug) return;
      const entry = { ts: new Date().toISOString(), msg, data };
      setDebugLogs((logs) => [entry, ...logs].slice(0, 200));
      try { console.debug('[RPM DEBUG]', msg, data); } catch {}
    }

    function handleMessage(event) {
      // Accept RPM messages from any readyplayer.me origin
      if (!String(event.origin).includes('readyplayer.me')) return;
      logDebug('postMessage received', { origin: event.origin, raw: event.data });
      
      // Fallback: RPM sometimes posts the avatar URL directly as a string
      if (typeof event.data === 'string' && event.data.startsWith('http')) {
        try {
          const rawUrl = String(event.data);
          if (rawUrl.includes('readyplayer.me')) {
            let url = rawUrl;
            if (url && !url.endsWith('.glb') && !url.includes('.glb?')) {
              url = `${url}.glb`;
            }
            setAvatarUrl(url);
            setBusy(false);
            // Debug log
            if (rpmDebug) {
              setDebugLogs((logs) => [{ ts: new Date().toISOString(), msg: 'Captured raw RPM URL', data: { url } }, ...logs].slice(0, 200));
            }
            return;
          }
        } catch {}
      }
      
      try {
  const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.source !== 'readyplayerme') return;
        const { eventName, data } = msg;
  logDebug('RPM event', { eventName, data });

        // Handle both v1 and v2 avatar export events
        if (eventName === 'v1.avatar.exported' || eventName === 'v2.avatar.exported') {
          // User completed avatar creation - capture URL, ID, and metadata
          let url = data?.url;
          const avatarId = data?.avatarId || data?.id; // v2 uses avatarId, v1 uses id
          const metadata = data?.metadata; // v2 provides additional metadata (gender, bodyType, etc.)
          
          // Ensure the URL ends with .glb for proper model loading
          // RPM provides base URL without extension, we need to add .glb
          if (url && !url.endsWith('.glb') && !url.includes('.glb?')) {
            url = url.endsWith('.glb') ? url : `${url}.glb`;
          }
          
          logDebug('Avatar exported', { 
            eventName, 
            url, 
            avatarId, 
            metadata,
            userId: data?.userId 
          });
          
          setAvatarUrl(url);
          
          // Store avatar ID and metadata for linking to backend user
          if (avatarId) {
            localStorage.setItem('rpmAvatarId', avatarId);
          }
          if (metadata) {
            localStorage.setItem('rpmAvatarMetadata', JSON.stringify(metadata));
          }
          
          setBusy(false); // Avatar is ready, allow user to save manually
        }

        if (eventName === 'v1.user.authorized') {
          // User authorized RPM account; link it
          const newUserId = data?.userId;
          if (newUserId) {
            logDebug('User authorized', { newUserId });
            // Optionally, link account here
          }
        }
      } catch (e) {
        // Silently ignore parse errors from non-JSON messages
        logDebug('Ignored non-JSON RPM message', { raw: event.data });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [email]);

  // Step 1: Don't register yet; just proceed to avatar creation.
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    // Keep credentials in memory and move to Step 2 (avatar creation)
    localStorage.setItem('pendingSignupEmail', email);
    localStorage.setItem('pendingSignupUsername', username);
    setStep(2);
  };

  // Removed unused handleSaveAvatar

  // Removed unused handleLinkAccount

  // Removed handlePhotoChange

  // Build iframe URL - use generic subdomain URL for all users (no id parameter)
  // Avatar will be linked to user after export via v1.avatar.exported event
  // frameApi: enables postMessage events
  // bodyType=fullbody: sets full body avatar type
  // clearCache: disables caching and ensures fresh session
  const iframeUrl = `https://${rpmSubdomain}.readyplayer.me/avatar?frameApi&bodyType=fullbody&clearCache`;
  
  console.log('RPM iframe URL:', iframeUrl);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-6xl">
        <h1 className="text-4xl font-black text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
          Create Your 3D Avatar
        </h1>
        <p className="text-center text-gray-600 mb-8">Join the virtual dressing experience</p>

        {step === 1 && (
          <form onSubmit={handleRegister} className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  placeholder="Choose a username"
                  required 
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  placeholder="your@email.com"
                  required 
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  placeholder="At least 4 characters"
                  required 
                  minLength={4}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={busy}
            >
              {busy ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating your account...
                </span>
              ) : (
                'Create Account & Continue'
              )}
            </button>

            <p className="text-center text-sm text-gray-600 mt-4">
              Already have an account?{' '}
              <button 
                type="button"
                onClick={() => router.push('/login')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Log in
              </button>
            </p>
          </form>
        )}

        {step === 2 && (
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-gray-800">Step 2: Create Your Avatar</h2>
                <div className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span>🌐 {rpmSubdomain}.readyplayer.me</span>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-4 rounded mb-3">
                <p className="text-sm font-semibold text-green-800 mb-2">
                  ✓ Photo Upload is enabled! Follow these steps:
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
                  <li><strong>Wait for the Avatar Creator to load</strong> in the large iframe below</li>
                  <li><strong>Look for "Upload Photo"</strong> or a camera icon 📸 (usually at the top or in the menu)</li>
                  <li><strong>Click it</strong> and select a clear, front-facing photo of yourself</li>
                  <li><strong>Wait 30-60 seconds</strong> for RPM to generate your avatar from the photo</li>
                  <li><strong>Customize</strong> your avatar's appearance (hair, clothes, etc.) - optional</li>
                  <li><strong>Click "Done"</strong> or "Next" button inside the RPM interface</li>
                  <li><strong>Wait</strong> for the green "Avatar exported successfully!" banner and Save button below</li>
                </ol>
              </div>
              {!avatarUrl && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>What to look for inside the iframe:</strong><br/>
                    • "Upload a photo" or "From photo" button<br/>
                    • Camera icon or "Selfie" option<br/>
                    • If you don't see these, you can also manually create an avatar and click "Done" when finished
                  </p>
                </div>
              )}

              {rpmDebug && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">RPM Debug Logs</h4>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setDebugLogs([])}
                    >Clear</button>
                  </div>
                  <div className="h-40 overflow-auto text-xs font-mono bg-white border border-gray-100 rounded p-2">
                    {debugLogs.length === 0 ? (
                      <div className="text-gray-400">No logs yet. Interact with the iframe to see events.</div>
                    ) : (
                      debugLogs.map((l, idx) => (
                        <div key={idx} className="mb-1">
                          <span className="text-gray-500">[{l.ts}]</span> <span className="font-semibold">{l.msg}</span>
                          <pre className="whitespace-pre-wrap break-all text-gray-700">{JSON.stringify(l.data)}</pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <div className="relative">
              <iframe
                ref={iframeRef}
                title="Ready Player Me Avatar Creator"
                src={iframeUrl}
                className="w-full rounded-xl border-2 border-gray-200"
                style={{ height: '90vh', minHeight: 800 }}
                allow="camera *; microphone *; clipboard-write"
              />
              {busy && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-700 font-semibold">Waiting for avatar to be generated...</p>
                  </div>
                </div>
              )}
            </div>

            {avatarUrl && (
              <div className="mt-6 animate-fade-in">
                <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4 rounded">
                  <p className="text-sm text-green-700 font-semibold">
                    ✓ Avatar exported successfully! Review your avatar below and click "Save & Continue to Login"
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Your 3D Avatar is Ready!</h3>
                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Avatar preview may not load here due to RPM rate limits. 
                      Your avatar URL has been captured and will be fully visible in your wardrobe after login!
                    </p>
                  </div>
                  <div className="mb-3 p-3 bg-gray-50 rounded text-xs break-all">
                    <strong>Captured Avatar URL:</strong> {avatarUrl}
                  </div>
                  <model-viewer 
                    src={avatarUrl} 
                    alt="Your 3D Avatar" 
                    camera-controls 
                    auto-rotate
                    style={{ width: '100%', height: 400 }}
                    className="rounded-lg bg-white"
                    loading="eager"
                  />
                  <button
                    className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        // Gather avatar metadata captured earlier
                        const avatarId = localStorage.getItem('rpmAvatarId') || undefined;
                        let metadata;
                        const metaStr = localStorage.getItem('rpmAvatarMetadata');
                        if (metaStr) {
                          try { metadata = JSON.parse(metaStr); } catch {}
                        }

                        // Create the user now with avatar attached
                        const res = await ApiClient.register({ username, email, password, avatarUrl, avatarId, metadata });
                        if (res?.token) {
                          setAuthToken(res.token);
                          localStorage.setItem('userEmail', email);
                        }
                        // Redirect to login (or wardrobe) after successful register
                        router.push('/login');
                      } catch (err) {
                        console.error('Deferred register with avatar error:', err);
                        const msg = err?.response?.data?.error || 'Failed to save account with avatar. Please try a different email.';
                        setError(msg);
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    {busy ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving account...
                      </span>
                    ) : (
                      '💾 Save Account & Continue to Login'
                    )}
                  </button>
                  <p className="text-center text-sm text-gray-600 mt-3">
                    After logging in, you can view your avatar in the wardrobe
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
