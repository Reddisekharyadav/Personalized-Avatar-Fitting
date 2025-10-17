import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function Signup() {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== 'https://mango-xwpbk6.readyplayer.me') return;
      if (typeof event.data === 'string' && event.data.includes('v1/avatar-exported')) {
        try {
          const data = JSON.parse(event.data);
          if (data.eventName === 'v1/avatar-exported') {
            setAvatarUrl(data.data.url);
            setSaved(false);
            setError('');
          }
        } catch {}
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSave = async () => {
    if (!email || !avatarUrl) {
      setError('Please enter your email and create an avatar.');
      return;
    }
    try {
      await axios.post('http://localhost:5000/api/user/avatar', { email, avatarGlbUrl: avatarUrl });
      setSaved(true);
      setError('');
    } catch {
      setError('Failed to save avatar.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Create Your 3D Avatar</h1>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="mb-4 px-3 py-2 border rounded w-full max-w-xs"
        required
      />
      <iframe
        ref={iframeRef}
        title="Ready Player Me"
        src="https://readyplayer.me/avatar?frameApi"
        style={{ width: '100%', maxWidth: 400, height: 600, border: 'none', borderRadius: 12 }}
        allow="camera *; microphone *"
      />
      {avatarUrl && (
        <div className="mt-6 flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-2">Avatar Preview (.glb)</h2>
          <model-viewer src={avatarUrl} alt="Avatar" auto-rotate camera-controls style={{ width: 300, height: 400 }} />
          <button
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? 'Saved!' : 'Save Avatar'}
          </button>
        </div>
      )}
      {error && <div className="text-red-500 mt-2">{error}</div>}
      <p className="mt-4 text-gray-500">Powered by Ready Player Me</p>
    </div>
  );
}
