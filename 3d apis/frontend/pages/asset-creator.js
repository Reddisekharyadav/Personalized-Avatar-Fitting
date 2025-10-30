import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

/**
 * Asset Creator Page
 * Create custom 3D assets from e-commerce product links (Amazon, Flipkart, Meesho)
 * Uses RPM API to create and manage custom assets
 */
const AssetCreator = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Input, 2: Processing, 3: Preview, 4: Upload
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workflowType, setWorkflowType] = useState('basic'); // 'basic' or 'virtual-tryon'

  // Form data
  const [productUrl, setProductUrl] = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState(''); // For virtual try-on
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('outfit');
  const [assetGender, setAssetGender] = useState('neutral');
  
  // Extracted data
  const [extractedImage, setExtractedImage] = useState('');
  const [extractedUserPhoto, setExtractedUserPhoto] = useState('');
  const [productTitle, setProductTitle] = useState('');
  
  // Generated asset data
  const [generatedModel, setGeneratedModel] = useState(null);
  const [generatedIcon, setGeneratedIcon] = useState(null);
  const [generationMethod, setGenerationMethod] = useState('');
  
  // RPM asset data
  const [rpmAsset, setRpmAsset] = useState(null);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Step 1: Extract product info from URL
  const handleExtractProduct = async () => {
    console.log('🎯 handleExtractProduct called!');
    console.log('📦 Product URL:', productUrl);
    console.log('🎨 Workflow Type:', workflowType);
    console.log('👤 User Photo URL:', userPhotoUrl);
    
    if (!productUrl) {
      setError('Please enter a product URL');
      alert('⚠️ Please enter a product URL');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔍 Extracting product info from:', productUrl);
      console.log('🌐 Making request to: http://localhost:5000/api/assets/extract-from-url');
      console.log('🔑 Token:', localStorage.getItem('token') ? 'Present' : 'Missing');
      
      const response = await axios.post('http://localhost:5000/api/assets/extract-from-url', {
        url: productUrl
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('✅ Server response:', response.data);
      const { title, imageUrl, success: extractSuccess } = response.data;

      if (extractSuccess && imageUrl) {
        setExtractedImage(imageUrl);
        setProductTitle(title || '');
        setAssetName(title || 'Custom Asset');
        setStep(2);
        setSuccess('✅ Product extracted successfully!');
        console.log('✅ Moving to step 2');
      } else {
        const errorMsg = 'Could not extract product information. Please check the URL.';
        setError(errorMsg);
        alert('❌ ' + errorMsg);
      }
    } catch (err) {
      console.error('❌ Error extracting product:', err);
      console.error('❌ Error details:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      const errorMsg = err?.response?.data?.error || 'Failed to extract product. Please try again.';
      setError(errorMsg);
      alert('❌ Error: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Generate 3D model and icon from image
  const handleGenerateAsset = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = workflowType === 'virtual-tryon' 
        ? '/api/assets/generate-virtual-tryon'
        : '/api/assets/generate-from-image';

      console.log(`🎨 Generating 3D asset (${workflowType})...`);
      
      const requestBody = workflowType === 'virtual-tryon'
        ? {
            userPhotoUrl: extractedUserPhoto,
            clothingUrl: extractedImage,
            name: assetName,
            type: assetType,
            gender: assetGender
          }
        : {
            imageUrl: extractedImage,
            name: assetName,
            type: assetType,
            gender: assetGender
          };

      const response = await axios.post(`http://localhost:5000${endpoint}`, requestBody, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const { iconUrl, modelUrl, avatarModelUrl, clothingModelUrl, generationMethod: method, message } = response.data;

      // Convert relative URLs to absolute URLs
      const toAbsoluteUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url; // Already absolute
        return `http://localhost:5000${url}`; // Make relative URL absolute
      };

      const absoluteIconUrl = toAbsoluteUrl(iconUrl);
      const absoluteModelUrl = workflowType === 'virtual-tryon' 
        ? toAbsoluteUrl(clothingModelUrl || avatarModelUrl)
        : toAbsoluteUrl(modelUrl);

      console.log('📦 Generated URLs:');
      console.log('  Icon (raw):', iconUrl);
      console.log('  Icon (absolute):', absoluteIconUrl);
      console.log('  Model (raw):', modelUrl || clothingModelUrl || avatarModelUrl);
      console.log('  Model (absolute):', absoluteModelUrl);

      setGeneratedIcon(absoluteIconUrl);
      setGeneratedModel(absoluteModelUrl);
      
      if (workflowType === 'virtual-tryon') {
        setSuccess(message || '✅ Virtual try-on models generated!');
      } else {
        setGenerationMethod(method || 'none');
        setSuccess(message || (modelUrl ? '✅ 3D asset generated successfully!' : '⚠️ Icon created. 3D model needs API keys.'));
      }
      
      setStep(3);
    } catch (err) {
      console.error('❌ Error generating asset:', err);
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to generate 3D asset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Upload to RPM and save to database
  const handleUploadToRPM = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('☁️ Uploading asset to Ready Player Me...');
      
      const response = await axios.post('http://localhost:5000/api/assets/upload-to-rpm', {
        name: assetName,
        type: assetType,
        gender: assetGender,
        modelUrl: generatedModel,
        iconUrl: generatedIcon
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const { rpmAssetId, rpmAssetUrl, localAssetId } = response.data;

      setRpmAsset({
        id: rpmAssetId,
        url: rpmAssetUrl,
        localId: localAssetId
      });
      
      setStep(4);
      setSuccess('✅ Asset uploaded to RPM and saved successfully!');
    } catch (err) {
      console.error('❌ Error uploading to RPM:', err);
      setError(err?.response?.data?.error || 'Failed to upload asset to RPM. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setProductUrl('');
    setAssetName('');
    setAssetType('outfit');
    setAssetGender('neutral');
    setExtractedImage('');
    setProductTitle('');
    setGeneratedModel(null);
    setGeneratedIcon(null);
    setRpmAsset(null);
    setError('');
    setSuccess('');
  };

  const handleGoToWardrobe = () => {
    router.push('/wardrobe');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 12 }}>
            🎨 Create Custom Asset
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)' }}>
            Convert e-commerce product links into 3D assets for your avatar
          </p>
        </div>

        {/* Progress Steps */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
          {[
            { num: 1, label: 'Extract' },
            { num: 2, label: 'Generate' },
            { num: 3, label: 'Preview' },
            { num: 4, label: 'Complete' }
          ].map(({ num, label }) => (
            <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: step >= num ? '#10b981' : 'rgba(255,255,255,0.3)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18
              }}>
                {step > num ? '✓' : num}
              </div>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Main Content Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          
          {/* Error Message */}
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div style={{ background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <p style={{ color: '#059669', fontSize: 14, margin: 0 }}>{success}</p>
            </div>
          )}

          {/* Step 1: Input URL */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Step 1: Choose Workflow</h2>
              <p style={{ color: '#6b7280', marginBottom: 24 }}>
                Select how you want to create your 3D asset
              </p>

              {/* Workflow Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div
                  onClick={() => setWorkflowType('basic')}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: `3px solid ${workflowType === 'basic' ? '#667eea' : '#e5e7eb'}`,
                    cursor: 'pointer',
                    background: workflowType === 'basic' ? '#f0f4ff' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👕</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Basic</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                    Single product image → 3D model
                  </p>
                </div>

                <div
                  onClick={() => setWorkflowType('virtual-tryon')}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: `3px solid ${workflowType === 'virtual-tryon' ? '#667eea' : '#e5e7eb'}`,
                    cursor: 'pointer',
                    background: workflowType === 'virtual-tryon' ? '#f0f4ff' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎭</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Virtual Try-On</h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                    Your photo + clothing → Combined 3D
                  </p>
                </div>
              </div>

              {workflowType === 'virtual-tryon' && (
                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="userPhoto" style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                    Your Photo URL *
                  </label>
                  <input
                    id="userPhoto"
                    type="url"
                    value={userPhotoUrl}
                    onChange={(e) => setUserPhotoUrl(e.target.value)}
                    placeholder="https://your-photo.jpg"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 8 }}
                  />
                  <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                    💡 Upload a full-body photo for best results
                  </p>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <label htmlFor="productUrl" style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                  {workflowType === 'virtual-tryon' ? 'Clothing' : 'Product'} URL *
                </label>
                <input
                  id="productUrl"
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://www.amazon.in/product/... or direct image URL"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                />
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, background: '#f9fafb', padding: 12, borderRadius: 6 }}>
                  <p style={{ margin: 0, marginBottom: 4, fontWeight: 600 }}>💡 Supported formats:</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Product page URLs (Amazon, Flipkart, Meesho, etc.)</li>
                    <li>Direct image URLs (.jpg, .png, .webp)</li>
                  </ul>
                  <p style={{ margin: 0, marginTop: 8, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                    💡 Tip: If product URL doesn't work, right-click the product image and select "Copy image address"
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  console.log('🖱️ Button clicked!');
                  console.log('📋 Product URL:', productUrl);
                  console.log('🔄 Loading:', loading);
                  console.log('🎨 Workflow:', workflowType);
                  handleExtractProduct();
                }}
                disabled={loading || !productUrl || (workflowType === 'virtual-tryon' && !userPhotoUrl)}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: 8,
                  background: loading || !productUrl || (workflowType === 'virtual-tryon' && !userPhotoUrl) ? '#d1d5db' : '#667eea',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: loading || !productUrl || (workflowType === 'virtual-tryon' && !userPhotoUrl) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '🔄 Extracting...' : '🚀 Extract Product'}
              </button>
            </div>
          )}

          {/* Step 2: Configure Asset */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Step 2: Configure Asset</h2>
              <p style={{ color: '#6b7280', marginBottom: 24 }}>
                Review extracted data and configure your 3D asset
              </p>

              {/* Extracted Image Preview */}
              {extractedImage && (
                <div style={{ marginBottom: 24, textAlign: 'center' }}>
                  <img 
                    src={extractedImage} 
                    alt="Product" 
                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Extracted product image</p>
                </div>
              )}

              {/* Asset Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                  Asset Name *
                </label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="e.g., Blue Jacket"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                />
              </div>

              {/* Asset Type */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                  Asset Type *
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                >
                  <option value="outfit">Outfit (Full body)</option>
                  <option value="top">Top (Shirt/Jacket)</option>
                  <option value="bottom">Bottom (Pants/Skirt)</option>
                  <option value="footwear">Footwear (Shoes)</option>
                  <option value="glasses">Glasses</option>
                  <option value="facewear">Facewear (Mask/etc)</option>
                  <option value="hair">Hair</option>
                  <option value="headwear">Headwear (Hat/Cap)</option>
                </select>
              </div>

              {/* Asset Gender */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                  Gender *
                </label>
                <select
                  value={assetGender}
                  onChange={(e) => setAssetGender(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                >
                  <option value="neutral">Neutral (All)</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: 8,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleGenerateAsset}
                  disabled={loading || !assetName}
                  style={{
                    flex: 2,
                    padding: '14px 24px',
                    borderRadius: 8,
                    background: loading || !assetName ? '#d1d5db' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: loading || !assetName ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '🔄 Generating 3D Asset...' : '✨ Generate 3D Asset'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Upload */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Step 3: Preview & Upload</h2>
              <p style={{ color: '#6b7280', marginBottom: 24 }}>
                Review your generated asset and upload to Ready Player Me
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Icon Preview */}
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Asset Icon</h3>
                  {generatedIcon ? (
                    <img 
                      src={generatedIcon} 
                      alt="Asset Icon" 
                      style={{ width: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 200, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#9ca3af' }}>Icon Preview</span>
                    </div>
                  )}
                </div>

                {/* Model Preview */}
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>3D Model</h3>
                  {generatedModel ? (
                    <div>
                      <model-viewer
                        src={generatedModel}
                        camera-controls
                        auto-rotate
                        style={{ width: '100%', height: 300, background: '#f3f4f6', borderRadius: 8 }}
                      />
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, wordBreak: 'break-all' }}>
                        📁 {generatedModel}
                      </p>
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 300, background: '#f3f4f6', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                      <span style={{ color: '#9ca3af', marginBottom: 8 }}>⚠️ 3D Model Generation Not Configured</span>
                      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: 0 }}>
                        Add MESHY_API_KEY or TRIPO_API_KEY to backend/.env
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Asset Details */}
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Asset Details</h4>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  <p style={{ margin: '4px 0' }}><strong>Name:</strong> {assetName}</p>
                  <p style={{ margin: '4px 0' }}><strong>Type:</strong> {assetType}</p>
                  <p style={{ margin: '4px 0' }}><strong>Gender:</strong> {assetGender}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    borderRadius: 8,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  ← Edit
                </button>
                <button
                  onClick={handleUploadToRPM}
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '14px 24px',
                    borderRadius: 8,
                    background: loading ? '#d1d5db' : '#667eea',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '☁️ Uploading to RPM...' : '☁️ Upload to RPM'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#10b981' }}>
                Asset Created Successfully!
              </h2>
              <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 16 }}>
                Your custom asset has been uploaded to Ready Player Me and saved to your wardrobe
              </p>

              {rpmAsset && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20, marginBottom: 32, textAlign: 'left' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Asset Information</h4>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    <p style={{ margin: '8px 0' }}><strong>RPM Asset ID:</strong> <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}>{rpmAsset.id}</code></p>
                    <p style={{ margin: '8px 0' }}><strong>Local Asset ID:</strong> <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}>{rpmAsset.localId}</code></p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '14px 32px',
                    borderRadius: 8,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  Create Another
                </button>
                <button
                  onClick={handleGoToWardrobe}
                  style={{
                    padding: '14px 32px',
                    borderRadius: 8,
                    background: '#667eea',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  Go to Wardrobe →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginTop: 32, color: '#fff' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>ℹ️ How it works</h3>
          <ol style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Paste a product URL from any e-commerce site</li>
            <li>Our system extracts the product image automatically</li>
            <li>AI generates a 3D model and icon from the image</li>
            <li>Asset is uploaded to Ready Player Me and saved to your wardrobe</li>
            <li>Use it in your avatar customization!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AssetCreator;
