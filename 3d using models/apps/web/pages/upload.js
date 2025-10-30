import { useState } from 'react';
import dynamic from 'next/dynamic';
const ObjViewer = dynamic(() => import('../components/ObjViewer.jsx'), { ssr: false });

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

  const handleUpload = async () => {
    setError(null);
    setStatus({ state: 'PROCESSING' });
    if (!file) return alert('Choose a file first');
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await fetch(`${API_BASE}/tryon`, { method: 'POST', body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.detail || r.statusText);
      // Direct response - no polling needed
      setStatus({ 
        state: json.status || 'SUCCESS', 
        result: json, 
        file_url: json.file_url, 
        basename: json.basename 
      });
    } catch (e) {
      setError(String(e));
      setStatus(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Upload Your Photo</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="Preview" className="mt-4 w-64 h-auto rounded" />}
      <button onClick={handleUpload} className="mt-4 px-6 py-2 bg-green-600 text-white rounded shadow">Upload & Generate</button>

      {error && <p className="mt-4 text-red-600">{error}</p>}
      {status && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg w-full max-w-4xl">
          <div className="font-mono text-sm text-white mb-2">
            Status: <span className="text-green-400">{status.state}</span>
            {status.result?.mode && <span className="ml-4">Mode: <span className="text-blue-400">{status.result.mode.toUpperCase()}</span></span>}
            {status.result?.gender && <span className="ml-4">Gender: <span className="text-purple-400">{status.result.gender}</span></span>}
          </div>
          {status.file_url && status.basename && !status.file_url.endsWith('/files/') && (
            <div className="mt-2">
              <a className="text-blue-400 underline hover:text-blue-300" href={`${API_BASE}${status.file_url}`} target="_blank" rel="noreferrer">
                📥 Download {status.basename}
              </a>
            </div>
          )}
          {status.result?.measurements && (
            <div className="mt-3 text-sm bg-gray-900 p-3 rounded">
              <div className="font-semibold text-white mb-1">Body measurements:</div>
              <pre className="font-mono text-green-300 text-xs">{JSON.stringify(status.result.measurements, null, 2)}</pre>
            </div>
          )}
          {/* 3D OBJ inline preview */}
          {status?.basename?.toLowerCase?.().endsWith('.obj') && status.file_url && (
            <div className="mt-4">
              <h3 className="text-white font-semibold mb-2">🎨 3D Avatar Preview</h3>
              <ObjViewer src={`${API_BASE}${status.file_url}`} width={700} height={500} />
            </div>
          )}
          {/* 2D PNG fallback inline preview */}
          {status?.basename?.toLowerCase?.().endsWith('.png') && (
            <div className="mt-4">
              <h3 className="text-white font-semibold mb-2">🖼️ 2D Avatar Preview</h3>
              <img src={`${API_BASE}${status.file_url}`} alt="Avatar" className="border rounded" style={{maxWidth:'700px'}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
