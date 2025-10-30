import { useState, useEffect } from 'react';
import axios from 'axios';

export default function SketchfabViewerTryon() {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [clothingModels, setClothingModels] = useState([]);
  const [selectedClothing, setSelectedClothing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('shirt clothing');
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('avatar'); // 'avatar' or 'clothing'

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

  const handleSelectClothing = (model) => {
    setSelectedClothing(model);
    setViewMode('clothing'); // Switch to clothing view
  };

  const handleViewAvatar = () => {
    setViewMode('avatar');
  };

  const handleViewClothing = () => {
    if (selectedClothing) {
      setViewMode('clothing');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Sketchfab Virtual Try-On (No Download)</h1>
      
      <div style={{
        padding: '1rem',
        marginBottom: '2rem',
        backgroundColor: '#e8f4f8',
        border: '2px solid #4a90e2',
        borderRadius: '8px'
      }}>
        <strong>💡 No Download Mode:</strong> View your avatar and clothing side-by-side using Sketchfab's 
        embedded viewers. No downloading required - instant preview!
      </div>

      {/* Avatar URL Input */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Your Avatar GLB URL:
        </label>
        <input
          type="text"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://models.readyplayer.me/your-avatar.glb or Sketchfab model UID"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '2px solid #ddd',
            borderRadius: '8px'
          }}
        />
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
                  <button
                    key={model.uid}
                    style={{
                      border: selectedClothing?.uid === model.uid ? '3px solid #007bff' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: selectedClothing?.uid === model.uid ? '#f0f8ff' : 'white',
                      textAlign: 'left'
                    }}
                    onClick={() => handleSelectClothing(model)}
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Dual Viewers */}
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button
              onClick={handleViewAvatar}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: viewMode === 'avatar' ? '#007bff' : '#ddd',
                color: viewMode === 'avatar' ? 'white' : '#333',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              👤 View Avatar
            </button>
            <button
              onClick={handleViewClothing}
              disabled={!selectedClothing}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: viewMode === 'clothing' ? '#007bff' : '#ddd',
                color: viewMode === 'clothing' ? 'white' : '#333',
                border: 'none',
                borderRadius: '8px',
                cursor: selectedClothing ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                opacity: selectedClothing ? 1 : 0.5
              }}
            >
              👕 View Clothing
            </button>
          </div>

          <div style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            minHeight: '600px'
          }}>
            {viewMode === 'avatar' ? (
              avatarUrl ? (
                <div style={{ position: 'relative', height: '600px' }}>
                  <h3 style={{ padding: '1rem', margin: 0, backgroundColor: '#f0f0f0' }}>
                    Your Avatar
                  </h3>
                  {/* Check if it's a Sketchfab UID or URL */}
                  {avatarUrl.includes('http') ? (
                    <iframe
                      src={avatarUrl}
                      style={{
                        width: '100%',
                        height: 'calc(100% - 60px)',
                        border: 'none'
                      }}
                      title="Avatar Viewer"
                    />
                  ) : (
                    <iframe
                      src={`https://sketchfab.com/models/${avatarUrl}/embed?autostart=1&ui_theme=dark`}
                      style={{
                        width: '100%',
                        height: 'calc(100% - 60px)',
                        border: 'none'
                      }}
                      title="Avatar Viewer"
                    />
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '600px',
                  color: '#999',
                  fontSize: '1.2rem'
                }}>
                  Enter your avatar URL or Sketchfab UID
                </div>
              )
            ) : selectedClothing ? (
              <div style={{ position: 'relative', height: '600px' }}>
                <h3 style={{ padding: '1rem', margin: 0, backgroundColor: '#f0f0f0' }}>
                  {selectedClothing.name}
                </h3>
                <iframe
                  src={selectedClothing.viewerUrl}
                  style={{
                    width: '100%',
                    height: 'calc(100% - 60px)',
                    border: 'none'
                  }}
                  title="Clothing Viewer"
                />
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '600px',
                color: '#999',
                fontSize: '1.2rem'
              }}>
                Select a clothing item to preview
              </div>
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
              <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Selected: {selectedClothing.name}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                Use the tabs above to switch between your avatar and the clothing model.
                View them side-by-side to visualize the combination!
              </p>
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
        <h3 style={{ marginTop: 0 }}>How to use (No Download Mode):</h3>
        <ol style={{ lineHeight: 1.8 }}>
          <li><strong>Enter Avatar:</strong> Paste your avatar GLB URL or Sketchfab model UID</li>
          <li><strong>Search Clothing:</strong> Find clothing items using keywords</li>
          <li><strong>Select Clothing:</strong> Click any item to select it</li>
          <li><strong>Switch Views:</strong> Use tabs to view avatar or clothing</li>
          <li><strong>Compare:</strong> Visualize how they look together</li>
        </ol>
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
          <p style={{ margin: 0 }}>
            <strong>✨ Benefits:</strong>
          </p>
          <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            <li>⚡ <strong>Instant:</strong> No download or extraction needed</li>
            <li>💾 <strong>No Storage:</strong> Models stream directly from Sketchfab</li>
            <li>🔄 <strong>Always Works:</strong> No ECONNRESET or timeout errors</li>
            <li>🎯 <strong>Official:</strong> Uses Sketchfab's official embed viewer</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
