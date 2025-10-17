import React from 'react';
import PropTypes from 'prop-types';

/**
 * OutfitGrid component displays a grid of outfits with thumbnails and names
 * Handles outfit selection and trying on outfits
 */
const OutfitGrid = ({ 
  outfits,
  loading,
  error,
  selectedOutfits,
  onSelect,
  onTryOn,
  onLoadSamples
}) => {
  if (loading) {
    return <p className="py-4 text-center">Loading outfits...</p>;
  }

  if (error) {
    return (
      <p className="py-4 text-center text-red-500">{error}</p>
    );
  }

  if (!loading && outfits.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="mb-4">No downloadable outfits found. You can try a search or load demo outfits to test.</p>
        <button 
          onClick={onLoadSamples}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Load demo outfits
        </button>
      </div>
    );
  }

  return (
    <div className="wardrobe-outfits">
      {outfits.map((outfit, i) => {
        const key = outfit.id || outfit.uid || `${outfit.name || 'outfit'}-${i}`;
        const selected = selectedOutfits.includes(outfit.id);
        
        return (
          <div
            key={key}
            className={`wardrobe-outfit ${selected ? 'selected' : ''}`}
          >
            <button
              type="button"
              className="wardrobe-outfit-button"
              aria-pressed={selected}
              aria-label={`Toggle selection for ${outfit.name}`}
              onClick={() => onSelect(outfit)}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {outfit.thumbnail ? (
                <img src={outfit.thumbnail} alt={outfit.name} />
              ) : (
                <div className="outfit-placeholder">
                  <span>{outfit.name.charAt(0)}</span>
                </div>
              )}
              <p className="wardrobe-outfit-name">{outfit.name}</p>
            </button>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                className="wardrobe-try-btn"
                type="button"
                aria-label={`Try on ${outfit.name}`}
                onClick={() => onTryOn(outfit)}
              >
                Try On
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

OutfitGrid.propTypes = {
  outfits: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      uid: PropTypes.string,
      name: PropTypes.string.isRequired,
      thumbnail: PropTypes.string,
      glbUrl: PropTypes.string,
      downloadCandidate: PropTypes.string
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  selectedOutfits: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelect: PropTypes.func.isRequired,
  onTryOn: PropTypes.func.isRequired,
  onLoadSamples: PropTypes.func.isRequired
};

export default OutfitGrid;