import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ModelViewer from './ModelViewer';
import { checkGlbAlternative, resolveModelUrl } from '../utils/modelUtils';

// Enhanced component showing how to use GLB models with automatic fallback
const OutfitGridGLB = ({ userId }) => {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOutfits = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/wardrobe/${userId}/outfits`);
        
        // Process outfits and check for GLB alternatives
        const processOutfits = async () => {
          const mappedOutfits = [];
          
          for (const outfit of response.data) {
            const originalModelUrl = outfit.modelUrl;
            const isGltf = originalModelUrl.toLowerCase().endsWith('.gltf');
            
            let glbUrl = null;
            
            // If it's a GLTF model, check if a GLB version exists
            if (isGltf) {
              try {
                // Generate the potential GLB URL
                const potentialGlbUrl = originalModelUrl.replace('.gltf', '.glb');
                
                // Check if the GLB file actually exists
                const glbExists = await checkGlbAlternative(originalModelUrl);
                
                if (glbExists) {
                  console.log(`Found GLB alternative for ${outfit.name}: ${glbExists}`);
                  glbUrl = glbExists;
                } else {
                  console.log(`No GLB alternative found for ${outfit.name}, will try GLTF`);
                }
              } catch (checkErr) {
                console.error(`Error checking GLB alternative for ${outfit.name}:`, checkErr);
              }
            }
            
            mappedOutfits.push({
              ...outfit,
              originalModelUrl,
              glbUrl,
              // Prefer GLB if available, otherwise use original
              preferredModelUrl: glbUrl || originalModelUrl
            });
          }
          
          setOutfits(mappedOutfits);
          setLoading(false);
        };
        
        processOutfits();
      } catch (err) {
        setError('Failed to load outfits');
        setLoading(false);
        console.error('Error fetching outfits:', err);
      }
    };

    fetchOutfits();
  }, [userId]);

  if (loading) return <div>Loading outfits...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (outfits.length === 0) return <div>No outfits found</div>;

  return (
    <div className="outfit-grid">
      {outfits.map((outfit) => (
        <div key={outfit.id} className="outfit-card">
          <h3>{outfit.name}</h3>
          
          <div className="model-container">
            <ModelViewer
              modelUrl={resolveModelUrl(outfit.preferredModelUrl)}
              alt={outfit.name}
              fallbackUrl={outfit.originalModelUrl !== outfit.preferredModelUrl ? 
                resolveModelUrl(outfit.originalModelUrl) : null}
              onLoad={() => console.log(`${outfit.name} model loaded successfully`)}
              onError={(err) => console.error(`Error loading ${outfit.name} model:`, err)}
              autoRotate={true}
              environmentImage="neutral"
            />
          </div>
          
          <div className="outfit-details">
            <p>{outfit.description}</p>
            <p className="model-info">
              Model format: {outfit.preferredModelUrl.split('.').pop().toUpperCase()}
              {outfit.glbUrl && outfit.originalModelUrl.toLowerCase().endsWith('.gltf') && (
                <span className="glb-available"> (GLB available)</span>
              )}
            </p>
            
            {/* Add Try On button */}
            <button 
              className="try-on-button"
              onClick={() => {
                // Call your try-on function here
                console.log(`Trying on ${outfit.name}`);
                // Example: tryOnOutfit(outfit.preferredModelUrl);
              }}
            >
              Try On
            </button>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        .outfit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 20px;
        }
        
        .outfit-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .outfit-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        
        .outfit-card h3 {
          padding: 12px 16px;
          margin: 0;
          font-size: 18px;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .model-container {
          height: 300px;
          background-color: #f3f4f6;
        }
        
        .outfit-details {
          padding: 16px;
        }
        
        .model-info {
          font-size: 14px;
          color: #6b7280;
          margin-top: 8px;
        }
        
        .glb-available {
          color: #10b981;
          font-weight: 500;
        }
        
        .try-on-button {
          margin-top: 12px;
          padding: 8px 16px;
          background-color: #4f46e5;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .try-on-button:hover {
          background-color: #4338ca;
        }
        
        .error-message {
          padding: 16px;
          background-color: #fee2e2;
          color: #b91c1c;
          border-radius: 4px;
          margin: 20px;
        }
      `}</style>
    </div>
  );
};

export default OutfitGridGLB;