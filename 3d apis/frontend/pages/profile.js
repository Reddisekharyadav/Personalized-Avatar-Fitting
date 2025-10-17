import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  
  // Helper function to resolve model URLs for proxying
  const resolveModelUrl = (url) => {
    if (!url) return url;
    try {
      if (url.startsWith('http://localhost:5000') || url.startsWith(window.location.origin)) return url;
      if (!url.startsWith('http')) return url;
      
      // Better detection of file type from URL
      const urlLower = url.toLowerCase().split('?')[0];
      const isGlb = urlLower.endsWith('.glb');
      const isGltf = urlLower.endsWith('.gltf') || 
                     urlLower.includes('/scene.gltf') || 
                     urlLower.includes('-scene.gltf');
      
      console.log(`Profile resolving URL: ${url}, detected as ${isGlb ? 'GLB' : isGltf ? 'GLTF' : 'other'}`);
      
      if (isGlb) {
        return `http://localhost:5000/api/proxy?url=${encodeURIComponent(url)}`;
      } else if (isGltf) {
        // Use dedicated resource proxy for GLTF files to handle dependencies
        return `http://localhost:5000/api/proxy/resource?url=${encodeURIComponent(url)}`;
      } else {
        console.log('Unknown format in profile, using resource proxy:', url);
        return `http://localhost:5000/api/proxy/resource?url=${encodeURIComponent(url)}`;
      }
    } catch (e) {
      console.error('URL resolution error in profile:', e);
      return url;
    }
  };

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (!email) {
      setError('No user email found. Please log in.');
      return;
    }
    let cancelled = false;
    axios.get(`http://localhost:5000/api/user/${encodeURIComponent(email)}`)
      .then(res => {
        if (!cancelled) {
      setUser(res.data.user);
      setUsername(res.data.user?.username || '');
      setPhotoPreview(res.data.user?.photo || '');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load user info.');
      });
    return () => { cancelled = true; };
  }, [router]);

  // ensure model-viewer is loaded for GLB preview
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.querySelector('script[data-model-viewer]')) {
      const s = document.createElement('script');
      s.setAttribute('type', 'module');
      s.setAttribute('src', 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js');
      s.setAttribute('data-model-viewer', '1');
      document.head.appendChild(s);
    }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!username) {
      setError('Username is required.');
      return;
    }
    try {
      // Update profile photo and username
      await axios.post('http://localhost:5000/api/user/avatar', {
        email: user.email,
        avatarGlbUrl: user.avatarGlbUrl,
        username,
        photo: photoPreview
      });
      // If a new photo was uploaded, trigger 3D avatar regeneration
      if (photoPreview && photoPreview !== user.photo) {
        const resp = await axios.post('http://localhost:5000/api/user/update-avatar-from-photo', {
          email: user.email,
          photo: photoPreview
        });
        if (resp.data && resp.data.avatarGlbUrl) {
          setUser(prev => ({ ...prev, avatarGlbUrl: resp.data.avatarGlbUrl, photo: photoPreview }));
        }
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError('Failed to update profile.');
    }
  };

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  }
  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="profile-bg">
      <div className="profile-card">
        <h1 className="profile-title">Profile</h1>
        {/* 3D Avatar Preview (always shown if available) */}
        {user?.avatarGlbUrl && (
          <div className="profile-avatar-frame">
            <h2 className="profile-avatar-title">Your 3D Avatar</h2>
            <div style={{ width: 350, height: 450, borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <model-viewer
                src={user.avatarGlbUrl && user.avatarGlbUrl.startsWith('http') 
                  ? resolveModelUrl(user.avatarGlbUrl)
                  : user.avatarGlbUrl
                }
                alt="User Avatar"
                camera-controls
                auto-rotate
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}
        <form onSubmit={handleSave} className="flex flex-col gap-4 w-full">
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="profile-input" required />
          <div className="flex flex-col items-center w-full">
            <label htmlFor="photo-upload" className="mb-2 font-medium">Change Profile Photo</label>
            <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="mb-2" />
            {photoPreview && <img src={photoPreview} alt="Preview" className="profile-photo-preview" />}
          </div>
          <button type="submit" className="profile-btn">Save</button>
          {error && <div className="profile-error">{error}</div>}
          {success && <div className="profile-success">Profile updated!</div>}
        </form>
      </div>
      <style>{`
        .profile-bg {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e0e7ff 0%, #e0ffe7 100%);
          animation: animated-bg 12s ease-in-out infinite alternate;
          background-size: 200% 200%;
        }
        @keyframes animated-bg {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .profile-card {
          background: rgba(255,255,255,0.92);
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
        .profile-title {
          font-size: 2.2rem;
          font-weight: 900;
          color: #2563eb;
          text-align: center;
          margin-bottom: 1.5rem;
          letter-spacing: -0.02em;
        }
        .profile-input {
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          border: 1.5px solid #c7d2fe;
          font-size: 1.1rem;
          font-weight: 600;
          outline: none;
          transition: border 0.2s;
        }
        .profile-input:focus {
          border: 1.5px solid #2563eb;
        }
        .profile-btn {
          background: linear-gradient(90deg, #4f8cff 0%, #1e3a8a 100%);
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
        .profile-btn:hover, .profile-btn:focus {
          filter: brightness(1.10) drop-shadow(0 0 16px rgba(79,140,255,0.13));
          box-shadow: 0 16px 40px 0 rgba(31,38,135,0.22);
          transform: scale(1.04) translateY(-2px);
          outline: 2px solid #a5b4fc;
        }
        .profile-btn:active {
          transform: scale(0.97) translateY(1px);
          filter: brightness(0.96);
          box-shadow: 0 4px 12px 0 rgba(31,38,135,0.10);
        }
        .profile-error {
          color: #dc2626;
          text-align: center;
          font-weight: 700;
          margin-top: 0.5rem;
        }
        .profile-success {
          color: #059669;
          text-align: center;
          font-weight: 700;
          margin-top: 0.5rem;
        }
        .profile-photo-preview {
          width: 5.5rem;
          height: 5.5rem;
          border-radius: 50%;
          object-fit: cover;
          margin-bottom: 0.5rem;
          border: 2px solid #2563eb;
          box-shadow: 0 2px 8px rgba(79,140,255,0.12);
        }
        .profile-avatar-frame {
          margin-bottom: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .profile-avatar-title {
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
