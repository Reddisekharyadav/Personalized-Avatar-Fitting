import { useState } from 'react';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    // Call API to get presigned URL, then upload
    // ...existing code...
    alert('Upload simulated.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Upload Your Photo</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="Preview" className="mt-4 w-64 h-auto rounded" />}
      <button onClick={handleUpload} className="mt-4 px-6 py-2 bg-green-600 text-white rounded shadow">Upload</button>
    </div>
  );
}
