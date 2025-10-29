import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function RpmEditor() {
  const iframeRef = useRef(null);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState(null);
  const [collection, setCollection] = useState('readyplayer');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);

  const addLog = (m) => { setLogs(l => [m, ...l].slice(0, 20)); console.log('[rpm-editor]', m); };

  useEffect(() => {
    const stored = localStorage.getItem('userEmail');
    if (stored) setEmail(stored);
  }, []);

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/user/${encodeURIComponent(email)}`);
        setUser(res.data.user || null);
      } catch (e) {
        setUser(null);
  addLog(`Failed to fetch user ${email}: ${e?.message || e}`);
      }
    })();
  }, [email]);

  useEffect(() => {
    const onMessage = async (evt) => {
      // Ready Player Me posts messages including an event type 'v1.user.avatar.ready' with url
      try {
        const data = evt?.data || {};
        if (data?.source === 'readyplayerme' || data?.type === 'v1.user.avatar.ready') {
          const avatarUrl = data?.url || data?.avatarUrl || data?.avatar_url;
          if (avatarUrl) {
            setStatus('saving');
            // Save to server
            const payload = { email, avatarGlbUrl: avatarUrl };
            await axios.post('http://localhost:5000/api/user/avatar', payload);
            setStatus('saved');
            localStorage.setItem('userEmail', email);
            // optionally update user state
            setUser((u) => ({ ...(u||{}), avatarGlbUrl: avatarUrl }));
          }
        }
      } catch (e) {
        console.error('rpm message handling failed', e);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [email]);

  const buildIframeSrc = () => {
    // Build RPM URL; collection selection could be added as param if provider supports it
    // This uses the Ready Player Me generic embed pattern
    const base = 'https://create.readyplayer.me/';
    const params = new URLSearchParams();
    params.set('frameApi', 'true');
    // request that export be in GLB format if supported
    params.set('export', 'glb');
    // collection param placeholder - most RPM flows don't accept 'collection' param but
    // keeping UI for future extension
    // params.set('collection', collection);
    if (email) params.set('user', email);
    // If we have a saved avatar URL for this user, try to pass it to the editor so RPM
    // can load the user's current body model. Many RPM integrations accept a model url
    // param (name may vary). We set `modelUrl` as a reasonable guess and also send a
    // postMessage after the iframe loads. This is defensive; if RPM doesn't support the
    // param it will ignore it and we still postMessage below.
    if (user?.avatarGlbUrl) {
      try { params.set('modelUrl', user.avatarGlbUrl); } catch (e) { /* ignore */ }
    }
    return `${base}?${params.toString()}`;
  };

  // When we have a loaded user avatar, try to instruct the RPM iframe to load that model
  // via postMessage. Exact message shapes vary by RPM integration; we use a permissive
  // format: { type: 'v1.frame.load.model', url } and also a simpler { type: 'load', url }.
  useEffect(() => {
    if (!iframeRef.current) return;
    if (!user || !user.avatarGlbUrl) return;
    // Verify the saved avatar URL is reachable before telling RPM to load it
    (async () => {
      try {
        addLog(`Checking availability of saved avatar: ${user.avatarGlbUrl}`);
        await axios.head(user.avatarGlbUrl, { timeout: 5000 });
        addLog('Saved avatar is reachable');
      } catch (e) {
        addLog(`Saved avatar NOT reachable: ${e?.message || e}`);
      }
    })();
    const trySend = () => {
      try {
        const msg1 = { type: 'v1.frame.load.model', url: user.avatarGlbUrl };
        const msg2 = { type: 'load', url: user.avatarGlbUrl };
        iframeRef.current.contentWindow.postMessage(msg1, '*');
        // small delay then send alternate message
        setTimeout(() => {
          try { iframeRef.current.contentWindow.postMessage(msg2, '*'); } catch (e) { /* ignore */ }
        }, 250);
      } catch (e) {
        console.warn('Failed to post load message to RPM iframe', e);
      }
    };
    // Attempt immediately and also after iframe load event
    trySend();
    const onLoad = () => trySend();
    iframeRef.current.addEventListener && iframeRef.current.addEventListener('load', onLoad);
    return () => {
      try { iframeRef.current && iframeRef.current.removeEventListener && iframeRef.current.removeEventListener('load', onLoad); } catch (e) { /* ignore */ }
    };
  }, [user, iframeRef.current]);


  const onSaveClick = async () => {
    if (!iframeRef.current) return;
    // Ask iframe to export (postMessage API depends on RPM integration); send a message
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'v1.frame.ready' }, '*');
      setStatus('requesting');
    } catch (e) {
      console.warn('Failed to postMessage to RPM iframe', e);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Ready Player Me Editor (RPM)</h2>
      <div style={{ marginBottom: 12 }}>
        {email ? (
          <div>
            <strong>Editing as:</strong> <span style={{ marginLeft: 8 }}>{email}</span>
            <button style={{ marginLeft: 12 }} onClick={() => { if (typeof window !== 'undefined') { localStorage.removeItem('userEmail'); } window.location.reload(); }}>Change</button>
          </div>
        ) : (
          <div>
            <label style={{ marginRight: 8 }} htmlFor="rpm-email-input">Email (user):</label>
            <input id="rpm-email-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={() => { if (typeof window !== 'undefined') { localStorage.setItem('userEmail', email); } window.location.reload(); }}>Load</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Collection:</label>
        <select value={collection} onChange={(e) => setCollection(e.target.value)}>
          <option value="readyplayer">ReadyPlayer</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={onSaveClick}>Request Export / Save</button>
        <span style={{ marginLeft: 12 }}>{status}</span>
      </div>

      <div style={{ height: 640 }}>
        <iframe
          ref={iframeRef}
          title="Ready Player Me Editor"
          src={buildIframeSrc()}
          style={{ width: '100%', height: '100%', border: '1px solid #ccc' }}
          allow="camera; microphone; fullscreen"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Current saved avatar</h3>
        {user?.avatarGlbUrl ? (
          <div>
            <a href={user.avatarGlbUrl} target="_blank" rel="noreferrer">{user.avatarGlbUrl}</a>
            <div style={{ marginTop: 8 }}>
              <img src={user.avatarGlbUrl + '.png'} alt="avatar preview" style={{ maxWidth: 240 }} onError={(e) => e.target.style.display = 'none'} />
            </div>
          </div>
        ) : (
          <p>No avatar saved yet for this user.</p>
        )}
      </div>
    </div>
  );
}
