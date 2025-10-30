import { useState, useEffect } from 'react';
import axios from 'axios';

export default function SketchfabDualViewer() {
  const [avatarUid, setAvatarUid] = useState('');
  const [clothingModels, setClothingModels] = useState([]);
  const [selectedClothing, setSelectedClothing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('shirt clothing');
  const [error, setError] = useState(null);

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
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Sketchfab Split-Screen Try-On</h1>
      
      <div style={{
        padding: '1rem',
        marginBottom: '2rem',
        backgroundColor: '#e8f4f8',
        border: '2px solid #4a90e2',
        borderRadius: '8px'
      }}>
        <strong>⚡ Split-Screen Mode:</strong> View your avatar (left) and clothing (right) side-by-side. 
        No downloads, instant previews using Sketchfab embeds!
      </div>

      {/* Controls Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Avatar Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            👤 Avatar (Sketchfab UID):
          </label>
          <input
            type="text"
            value={avatarUid}
            onChange={(e) => setAvatarUid(e.target.value)}
            placeholder="e.g., 1e3d8681e50d4c5fb6369db25edd2ad6"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #ddd',
              borderRadius: '8px'
            }}
          />
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
            Enter a Sketchfab model UID for your base avatar
          </p>
        </div>

        {/* Search Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            👕 Search Clothing:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="shirt, pants, dress..."
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '8px'
              }}
              onKeyDown={(e) => e.key === 'Enter' && searchClothingModels()}
            />
            <button
              onClick={searchClothingModels}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

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

      {/* Main Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Left: Avatar Viewer */}
        <div style={{ 
          border: '3px solid #4a90e2',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{ 
            padding: '0.75rem', 
            backgroundColor: '#4a90e2', 
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            👤 YOUR AVATAR (LEFT)
          </div>
          {avatarUid ? (
            <iframe
              src={`https://sketchfab.com/models/${avatarUid}/embed?autostart=1&ui_theme=dark&ui_infos=0`}
              style={{
                width: '100%',
                height: '600px',
                border: 'none'
              }}
              title="Avatar Viewer"
            />
          ) : (
            <div style={{
              height: '600px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#999',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Enter Avatar UID Above</p>
              <p style={{ fontSize: '0.9rem' }}>Find Sketchfab models at sketchfab.com</p>
              <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                Example: <code>1e3d8681e50d4c5fb6369db25edd2ad6</code>
              </p>
            </div>
          )}
        </div>

        {/* Right: Clothing Viewer */}
        <div style={{ 
          border: '3px solid #28a745',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{ 
            padding: '0.75rem', 
            backgroundColor: '#28a745', 
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            👕 CLOTHING (RIGHT)
          </div>
          {selectedClothing ? (
            <iframe
              src={selectedClothing.viewerUrl}
              style={{
                width: '100%',
                height: '600px',
                border: 'none'
              }}
              title="Clothing Viewer"
            />
          ) : (
            <div style={{
              height: '600px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#999',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Select Clothing Below</p>
              <p style={{ fontSize: '0.9rem' }}>Search and click a clothing item to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Clothing Grid */}
      <div>
        <h2 style={{ marginBottom: '1rem' }}>
          Available Clothing Models ({clothingModels.length})
        </h2>
        {loading && clothingModels.length === 0 ? (
          <p>Loading clothing models...</p>
        ) : clothingModels.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
            <p>No clothing models found. Try searching!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '8px'
          }}>
            {clothingModels.map((model) => (
              <button
                key={model.uid}
                onClick={() => handleSelectClothing(model)}
                style={{
                  border: selectedClothing?.uid === model.uid ? '3px solid #28a745' : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  cursor: 'pointer',
                  backgroundColor: selectedClothing?.uid === model.uid ? '#e8f5e9' : 'white',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
              >
                {model.thumbnail && (
                  <img
                    src={model.thumbnail}
                    alt={model.name}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}
                  />
                )}
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '0.9rem', 
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {model.name}
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  fontSize: '0.75rem', 
                  color: '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  by {model.author}
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#999' }}>
                  ❤️ {model.likeCount}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ddd',
        borderRadius: '8px'
      }}>
        <h3 style={{ marginTop: 0 }}>📋 Instructions:</h3>
        <ol style={{ lineHeight: 1.8, marginBottom: '1rem' }}>
          <li><strong>Get Avatar UID:</strong> Go to sketchfab.com, find a character/avatar model, copy its UID from URL</li>
          <li><strong>Enter UID:</strong> Paste the UID in the left input box - avatar appears instantly</li>
          <li><strong>Search Clothing:</strong> Type keywords (shirt, jacket, pants) and click Search</li>
          <li><strong>Select Clothing:</strong> Click any clothing item thumbnail - it appears on the right</li>
          <li><strong>Compare:</strong> View both models side-by-side to visualize the combination</li>
        </ol>

        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e8f4f8', 
          borderRadius: '4px',
          marginTop: '1rem'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>✨ Advantages:</p>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>⚡ <strong>Zero Downloads:</strong> Everything streams instantly</li>
            <li>💯 <strong>100% Reliable:</strong> No ECONNRESET, no timeouts</li>
            <li>🎯 <strong>Side-by-Side:</strong> Compare avatar and clothing simultaneously</li>
            <li>🔄 <strong>Interactive:</strong> Rotate, zoom, inspect both models</li>
            <li>🚀 <strong>Fast:</strong> Switch between clothing items instantly</li>
          </ul>
        </div>

        <div style={{ 
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px'
        }}>
          <p style={{ margin: 0 }}>
            <strong>💡 Tip:</strong> Use Sketchfab's search to find:
            <br/>• Character models for avatars (search "character rigged")
            <br/>• Clothing items (search "shirt", "pants", "dress")
            <br/>• Copy the UID from the model URL (e.g., sketchfab.com/models/<strong>UID</strong>/...)
          </p>
        </div>
      </div>
    </div>
  );
}
