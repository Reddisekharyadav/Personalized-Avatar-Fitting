import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
  const [showIframe, setShowIframe] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const iframeRef = useRef(null);
  const [iframeResetAttempted, setIframeResetAttempted] = useState(false);
  const [iframeRetryCount, setIframeRetryCount] = useState(0); // 0 = not retried, 1 = retried with photo, 2 = retried with default
  const [useDefaultEditor, setUseDefaultEditor] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleMessage(event) {
      // Accept messages from Ready Player Me iframe origin(s)
      // Ready Player Me may post messages with eventName 'v1.avatar.exported' or similar
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.eventName && data.eventName.includes('avatar-exported')) {
          // data.data.url or data.data?.url contains the exported avatar URL
          const url = data.data?.url || data.data?.avatarUrl || data.url;
          if (url) {
            // Only capture into state; we will persist when the user submits the Register form
            setAvatarUrl(url);
            setError('Avatar captured from editor — click Register to save it.');
            // hide the iframe after capture to return to the form
              setShowIframe(false);
              // reset the one-time fallback flag (successful export)
              setIframeResetAttempted(false);
          }
        }
      } catch (e) {
        console.debug('message parse error', e?.message || e);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview('');
    }
  };

  // Upload photo to backend when a new photoPreview is available
  useEffect(() => {
    const upload = async () => {
      if (!photoPreview) return;
      try {
        const emailVal = email || localStorage.getItem('userEmail') || '';
        const resp = await axios.post('http://localhost:5000/api/upload-photo', { email: emailVal, photo: photoPreview });
        if (resp.data && resp.data.url) {
          setUploadedPhotoUrl(resp.data.url);
        }
      } catch (err) {
        console.debug('upload failed', err?.message || err);
      }
    };
    upload();
  }, [photoPreview]);

  // Auto-reopen the iframe with the uploaded photo if the editor was closed without exporting an avatar.
  // If that fails once, on next retry switch to the default editor (no image param).
  useEffect(() => {
    if (!showIframe && !avatarUrl && (uploadedPhotoUrl || useDefaultEditor) && !iframeResetAttempted) {
      // Decide whether to reopen with photo or default based on retry count / user choice
      if (useDefaultEditor || iframeRetryCount >= 1) {
        // reopen with default Ready Player Me link
        setError('No avatar detected — opening default editor.');
        setIframeRetryCount(2);
        setIframeResetAttempted(true);
        setTimeout(() => { setShowIframe(true); setTimeout(() => setError(''), 3500); }, 400);
        return;
      }

      // First retry: try uploaded photo
      setError('No avatar detected from editor — reopening editor with your photo.');
      setIframeRetryCount(1);
      setIframeResetAttempted(true);
      setTimeout(() => { setShowIframe(true); setTimeout(() => setError(''), 3500); }, 400);
    }
  }, [showIframe, useDefaultEditor, iframeRetryCount, uploadedPhotoUrl]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !email || !password) return setError('Please fill username, email and password.');

    // If avatarUrl available (from RPM iframe), send it in registration body
    const body = { username, email, password };
    if (avatarUrl) {
  body.avatarGlbUrl = avatarUrl;
    } else if (photoPreview) {
      body.photo = photoPreview; // backend will run placeholder generator
    }

    try {
  await axios.post('http://localhost:5000/api/auth/register', body);
      setSuccess(true);
      // store email so other pages can fetch profile/wardrobe
      localStorage.setItem('userEmail', email);

      // If avatar not yet present on server, poll profile until avatar exists (RPM webhook may take a moment)
      const pollProfile = async () => {
        const pRes = await axios.get(`http://localhost:5000/api/profile/${encodeURIComponent(email)}`);
        const avatar = pRes.data.avatar || pRes.data.user?.avatarGlbUrl;
        if (avatar && (avatar.avatarUrl || avatar)) {
          router.push('/wardrobe');
          return true;
        }
        return false;
      };

      // Quick polling: try immediately and then every 2s for 20s
      let found = await pollProfile();
      if (!found) {
        const start = Date.now();
        const interval = setInterval(async () => {
          if (Date.now() - start > 20000) {
            clearInterval(interval);
            router.push('/wardrobe'); // fallback
            return;
          }
          try {
            const ok = await pollProfile();
            if (ok) clearInterval(interval);
          } catch { /* ignore */ }
        }, 2000);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed. Email may already be in use.');
    }
  };

  return (
    <div className="register-bg">
      <div className="register-card">
        <h1 className="register-title">Register</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4 w-full">
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="register-input" required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="register-input" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="register-input" required />
          <div className="flex flex-col items-center w-full">
            <label htmlFor="photoUpload" className="mb-2 font-medium">Upload Photo</label>
            <input id="photoUpload" type="file" accept="image/*" onChange={handlePhotoChange} className="mb-2" />
            {photoPreview && <img src={photoPreview} alt="Preview" className="register-photo-preview" />}
            <div style={{ marginTop: 8, width: '100%' }}>
              <label htmlFor="pasteUrl" style={{ fontWeight: 700, marginBottom: 6, display: 'block' }}>Paste downloadable .glb URL here</label>
              <input id="pasteUrl" type="text" placeholder="https://.../avatar.glb" value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #ddd' }} />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button type="button" onClick={async () => {
                  setSaveStatus('');
                  const emailVal = email || localStorage.getItem('userEmail');
                  if (!emailVal) return setSaveStatus('Enter email above first');
                  if (!pasteUrl) return setSaveStatus('Paste a .glb URL');
                  try {
                    await axios.post('http://localhost:5000/api/user/avatar', { email: emailVal, avatarGlbUrl: pasteUrl });
                    setSaveStatus('Saved');
                    localStorage.setItem('userEmail', emailVal);
                    setAvatarUrl(pasteUrl);
                  } catch (err) {
                    console.error('Save failed', err?.response?.data || err.message || err);
                    setSaveStatus('Save failed');
                  }
                }} className="register-btn">Save model URL</button>
                <button type="button" onClick={() => { setPasteUrl(''); setSaveStatus(''); }} className="register-btn" style={{ background: '#e5e7eb', color: '#111' }}>Clear</button>
              </div>
              {saveStatus && <div style={{ marginTop: 6 }}>{saveStatus}</div>}
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setShowIframe(!showIframe)} className="register-btn">{showIframe ? 'Close Avatar Editor' : 'Open Avatar Editor'}</button>
              {showIframe && (
                <div style={{ marginTop: 12, width: '100%', height: 520 }}>
                  <iframe
                    title="Ready Player Me Editor"
                    src={`${process.env.NEXT_PUBLIC_RPM_CREATION_URL || 'https://readyplayer.me/avatar'}?frameApi&partner=your-app${uploadedPhotoUrl ? `&image=${encodeURIComponent(uploadedPhotoUrl)}` : ''}`}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
                    allow="camera; microphone; clipboard-write"
                  />
                  <div style={{ marginTop: 8, color: '#555', fontSize: 14 }}>
                    When you export from the editor it will send a message to this page and the exported .glb URL will be captured.
                  </div>
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="register-btn">Register</button>
          {error && <div className="register-error">{error}</div>}
          {success && <div className="register-success">Registration successful! Redirecting...</div>}
        </form>
      </div>
      <style>{`
        .register-bg {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e0ffe7 0%, #e0e7ff 100%);
          animation: animated-bg 12s ease-in-out infinite alternate;
          background-size: 200% 200%;
        }
        @keyframes animated-bg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .register-card {
          background: rgba(255,255,255,0.88);
          box-shadow: 0 8px 32px 0 rgba(31,38,135,0.12);
          border-radius: 2rem;
          border: 1.5px solid rgba(255,255,255,0.25);
          padding: 2.5rem 2rem;
          max-width: 400px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }
        .register-title {
          font-size: 2.2rem;
          font-weight: 900;
          color: #059669;
          text-align: center;
          margin-bottom: 1.5rem;
          letter-spacing: -0.02em;
        }
        .register-input {
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          border: 1.5px solid #bbf7d0;
          font-size: 1.1rem;
          font-weight: 600;
          outline: none;
          transition: border 0.2s;
        }
        .register-input:focus {
          border: 1.5px solid #059669;
        }
        .register-btn {
          background: linear-gradient(90deg, #34d399 0%, #065f46 100%);
          color: #fff;
          font-weight: 800;
          font-size: 1.2rem;
          border: none;
          border-radius: 2rem;
          padding: 0.9rem 0;
          box-shadow: 0 8px 32px 0 rgba(31,38,135,0.18);
          cursor: pointer;
          transition: all 0.18s cubic-bezier(.4,0,.2,1);
        }
        .register-btn:hover, .register-btn:focus {
          filter: brightness(1.10) drop-shadow(0 0 16px rgba(52,211,153,0.13));
          box-shadow: 0 16px 40px 0 rgba(31,38,135,0.22);
          transform: scale(1.04) translateY(-2px);
          outline: 2px solid #6ee7b7;
        }
        .register-btn:active {
          transform: scale(0.97) translateY(1px);
          filter: brightness(0.96);
          box-shadow: 0 4px 12px 0 rgba(31,38,135,0.10);
        }
        .register-error {
          color: #dc2626;
          text-align: center;
          font-weight: 700;
          margin-top: 0.5rem;
        }
        .register-success {
          color: #059669;
          text-align: center;
          font-weight: 700;
          margin-top: 0.5rem;
        }
        .register-photo-preview {
          width: 5.5rem;
          height: 5.5rem;
          border-radius: 50%;
          object-fit: cover;
          margin-bottom: 0.5rem;
          border: 2px solid #059669;
          box-shadow: 0 2px 8px rgba(52,211,153,0.12);
        }
      `}</style>
    </div>
  );
}
