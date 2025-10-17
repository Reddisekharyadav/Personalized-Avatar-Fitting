import { useState } from 'react';
import ApiClient from '../utils/api';

const TryOn2D = () => {
  const [userPhoto, setUserPhoto] = useState(null);
  const [productLink, setProductLink] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProductImage(reader.result);
      reader.readAsDataURL(file);
      setProductLink('');
    }
  };

  const handleUserPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setUserPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!userPhoto) {
      setError('Please upload your photo first');
      return;
    }
    if (!productImage && !productLink) {
      setError('Please provide a product image or link');
      return;
    }

    const productInput = productImage || productLink; // Use productImage if available, otherwise use productLink

    setGenerating(true);
    setError('');
    try {
      const res = await ApiClient.tryOn2D('test-user-id', productInput, userPhoto); // Temporarily set userId to a test value
      if (res.success && res.imageUrl) {
        setImages(prev => [...prev, { imageUrl: res.imageUrl }]);
      }
    } catch (err) {
      // Normalize error message
      const data = err.response?.data;
      let msg = '';
      if (data) {
        if (data.details) msg = data.details;
        else if (typeof data.error === 'string') msg = data.error;
        else if (data.error?.message) msg = data.error.message;
      }
      if (!msg) msg = err.message || 'Generation failed';
      console.error('2D try-on failed:', data || err);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white shadow rounded p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Your Photo</h2>
        <input type="file" accept="image/*" onChange={handleUserPhotoChange} />
        {userPhoto && <img src={userPhoto} alt="User" className="w-32 h-32 object-cover rounded mt-2" />}
      </div>
      <button onClick={() => router.push('/wardrobe')} className="text-blue-600 mb-4">&larr; Back to Wardrobe</button>
      <h1 className="text-2xl font-bold mb-4">2D Virtual Try-On</h1>
      <div className="bg-white shadow rounded p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Product link"
            value={productLink}
            onChange={e => { setProductLink(e.target.value); setProductImage(null); }}
            className="flex-1 border rounded px-3 py-2"
          />
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          {generating ? 'Generating...' : 'Try On'}
        </button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>
      {images.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Results</h2>
          <div className="grid grid-cols-2 gap-4">
            {images.map((img) => (
              <div key={img.imageUrl} className="border rounded overflow-hidden">
                <img src={img.imageUrl} alt="Try-On" className="w-full" />
                {img.productLink && <div className="p-2 text-sm">Link: <a href={img.productLink} target="_blank" rel="noreferrer" className="text-blue-600">View Product</a></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TryOn2D;