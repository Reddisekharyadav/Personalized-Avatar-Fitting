import { useState, useEffect } from 'react';
import ThreeAvatarViewer from '../components/ThreeAvatarViewer';
import axios from 'axios';

export default function SketchfabTryon() {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [clothingModels, setClothingModels] = useState([]);
  const [selectedClothing, setSelectedClothing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('shirt clothing');
  const [error, setError] = useState(null);

  // Search for clothing models on page load
  useEffect(() => {
    searchClothingModels();
  }, []);

  const searchClothingModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/sketchfab-tryon/search-clothing', {
        params: { q: searchQuery }
      });

      if (response.data.success) {
        setClothingModels(response.data.models);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search clothing models: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTryOn = async (model) => {
    if (!avatarUrl) {
      alert('Please enter your avatar URL first!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('Trying on model:', model.uid);

      // Extract and process the Sketchfab model
      const response = await axios.post('/api/sketchfab-tryon/extract-clothing', {
        uid: model.uid,
        avatarUrl: avatarUrl
      });

      if (response.data.success) {
        console.log('Clothing extracted:', response.data.glbUrl);
        setSelectedClothing({
          ...model,
          glbUrl: response.data.glbUrl
        });
      }
    } catch (err) {
      console.error('Try-on error:', err);
      setError('Failed to try on clothing: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Sketchfab Virtual Try-On</h1>

      {/* Avatar URL Input */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Your Avatar GLB URL (left model):
        </label>
        <input
          type="text"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://models.readyplayer.me/your-avatar.glb"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '2px solid #ddd',
            borderRadius: '8px'
          }}
        />
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
          Enter your ReadyPlayerMe avatar URL or any GLB model URL
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Search Clothing:
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="shirt, pants, dress, jacket..."
            style={{
              flex: 1,
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #ddd',
              borderRadius: '8px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                searchClothingModels();
              }
            }}
          />
          <button
            onClick={searchClothingModels}
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '2rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Left Panel: Clothing List */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Available Clothing</h2>
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            {loading && clothingModels.length === 0 ? (
              <p>Loading clothing models...</p>
            ) : clothingModels.length === 0 ? (
              <p>No clothing models found. Try a different search term.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {clothingModels.map((model) => (
                  <div
                    key={model.uid}
                    style={{
                      border: selectedClothing?.uid === model.uid ? '3px solid #007bff' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: selectedClothing?.uid === model.uid ? '#f0f8ff' : 'white'
                    }}
                    onClick={() => handleTryOn(model)}
                  >
                    {model.thumbnail && (
                      <img
                        src={model.thumbnail}
                        alt={model.name}
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '0.5rem'
                        }}
                      />
                    )}
                    <h3 style={{ margin: '0.5rem 0', fontSize: '1rem' }}>{model.name}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>
                      by {model.author}
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#999' }}>
                      ❤️ {model.likeCount} likes
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: 3D Viewer */}
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Preview</h2>
          <div style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            minHeight: '600px'
          }}>
            {!avatarUrl ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '600px',
                color: '#999',
                fontSize: '1.2rem'
              }}>
                Enter your avatar URL to start trying on clothes
              </div>
            ) : (
              <ThreeAvatarViewer
                avatarUrl={avatarUrl}
                assetUrl={selectedClothing?.glbUrl}
              />
            )}
          </div>

          {selectedClothing && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f0f8ff',
              border: '1px solid #007bff',
              borderRadius: '8px'
            }}>
              <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Currently Trying On:</h3>
              <p style={{ margin: 0 }}>{selectedClothing.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginTop: 0 }}>How to use:</h3>
        <ol style={{ lineHeight: 1.8 }}>
          <li>Enter your avatar GLB URL (e.g., ReadyPlayerMe avatar)</li>
          <li>Search for clothing items using keywords</li>
          <li>Click on any clothing item to try it on your avatar</li>
          <li>The clothing will overlay on your left avatar model in the 3D viewer</li>
        </ol>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          <strong>Note:</strong> This uses Sketchfab's downloadable models. The system will automatically
          extract GLB files from ZIP archives and overlay them on your avatar.
        </p>
      </div>
    </div>
  );
}
