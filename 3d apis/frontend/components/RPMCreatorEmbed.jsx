import React, { useEffect, useRef, useState } from 'react';

/**
 * RPMCreatorEmbed Component
 * Requirement D & E: Ready Player Me Avatar Creator integration
 * 
 * Embeds RPM Avatar Creator iframe and listens for avatar-exported event
 * When user completes avatar creation, calls onAvatarCreated with avatar data
 * 
 * Example RPM message format (Requirement M.1):
 * {
 *   source: "readyplayerme",
 *   type: "avatar-exported",
 *   data: {
 *     url: "https://models.readyplayer.me/xxxxx.glb",
 *     id: "abc123",
 *     bodyType: "fit",
 *     skinTone: "dark",
 *     ...
 *   }
 * }
 */

const RPMCreatorEmbed = ({ onAvatarCreated, onError }) => {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    // Listen for postMessage events from RPM iframe
    const handleMessage = (event) => {
      try {
        // Parse message (can be string or object)
        const message = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data;

        console.log('RPM message received:', message);

        // Check if this is an RPM message
        if (message.source !== 'readyplayerme') {
          return;
        }

        // Handle different RPM event types
        switch (message.type) {
          case 'v1.frame.ready':
            console.log('RPM iframe ready');
            setIsLoading(false);
            setProgress('Avatar creator loaded. Start creating your avatar!');
            break;

          case 'v1.avatar.exported':
          case 'avatar-exported':
            console.log('Avatar exported:', message.data);
            setProgress('Avatar created! Processing...');
            
            // Extract avatar data (Requirement D)
            const avatarData = {
              avatarId: message.data.id,
              rpmUrl: message.data.url,
              bodyType: message.data.bodyType,
              gender: message.data.isGenderNeutral 
                ? 'neutral' 
                : (message.data.gender || 'unknown'),
              skinTone: message.data.skinTone,
              hairColor: message.data.hairColor,
              metadata: message.data.metadata || message.data
            };

            // Call parent callback
            if (onAvatarCreated) {
              onAvatarCreated(avatarData);
            }
            break;

          case 'v1.user.set':
            console.log('User set in RPM');
            setProgress('Loading your avatar...');
            break;

          case 'v1.user.logout':
            console.log('User logged out from RPM');
            setProgress('');
            break;

          default:
            console.log('Unhandled RPM event:', message.type);
        }
      } catch (error) {
        console.error('Error parsing RPM message:', error);
        if (onError) {
          onError(error);
        }
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onAvatarCreated, onError]);

  // RPM Creator URL (use environment variable or default)
  // TODO: Developer should configure RPM subdomain and partner ID
  const rpmSubdomain = process.env.NEXT_PUBLIC_RPM_SUBDOMAIN || 'mango-xwpbk6';
  const rpmCreatorUrl = process.env.NEXT_PUBLIC_RPM_CREATOR_URL 
    || `https://${rpmSubdomain}.readyplayer.me/avatar?frameApi&bodyType=fullbody&clearCache`;

  return (
    <div className="rpm-creator-container">
      {isLoading && (
        <div className="rpm-loading">
          <div className="spinner"></div>
          <p>Loading Ready Player Me Avatar Creator...</p>
        </div>
      )}
      
      {progress && (
        <div className="rpm-progress">
          <p>{progress}</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={rpmCreatorUrl}
        className="rpm-iframe"
        allow="camera *; microphone *; clipboard-write"
        title="Ready Player Me Avatar Creator"
        style={{
          width: '100%',
          height: '600px',
          border: 'none',
          borderRadius: '8px'
        }}
      />

      <style jsx>{`
        .rpm-creator-container {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .rpm-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          z-index: 10;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 1rem;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .rpm-progress {
          background: #4CAF50;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          text-align: center;
        }

        .rpm-iframe {
          display: block;
          background: #f5f5f5;
        }
      `}</style>
    </div>
  );
};

export default RPMCreatorEmbed;
