// src/components/satellite/ClubPitchMap.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { auth, db } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ClubPitchMap = ({ 
  onPitchClick 
}) => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // States for data loading
  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle navigation back to menu
  const handleBackToMenu = () => {
    navigate('/menu');
  };

  // Load user and club data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.clubId) {
              setClubId(userData.clubId);
            } else {
              setError('No club associated with this user');
              setLoading(false);
            }
          } else {
            setError('User data not found');
            setLoading(false);
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user data');
          setLoading(false);
        }
      } else {
        setError('User not authenticated');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load satellite configuration when clubId is available
  useEffect(() => {
    const loadSatelliteConfig = async () => {
      if (!clubId) return;

      try {
        setLoading(true);
        const clubRef = doc(db, 'clubs', clubId);
        const clubDoc = await getDoc(clubRef);
        
        if (clubDoc.exists()) {
          const clubData = clubDoc.data();
          setClubName(clubData.name || 'Club');
          
          if (clubData.satelliteConfig) {
            setSatelliteConfig(clubData.satelliteConfig);
          } else {
            setSatelliteConfig(null);
          }
        } else {
          setError('Club not found');
        }
      } catch (err) {
        console.error('Error loading satellite config:', err);
        setError('Failed to load satellite configuration');
      } finally {
        setLoading(false);
      }
    };

    loadSatelliteConfig();
  }, [clubId]);

  // Calculate canvas size maintaining aspect ratio
  const calculateCanvasSize = (imgWidth, imgHeight) => {
    const maxWidth = 800; // Reduced to make room for legend
    const maxHeight = 600;
    const aspectRatio = imgWidth / imgHeight;
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  };

  // Handle image load
  const handleImageLoad = () => {
    if (imageRef.current && satelliteConfig) {
      const size = calculateCanvasSize(
        satelliteConfig.imageWidth, 
        satelliteConfig.imageHeight
      );
      setCanvasSize(size);
      setImageLoaded(true);
    }
  };

  // Draw the canvas with image and pitch boundaries
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw satellite image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Scale factor for coordinates
    const scaleX = canvas.width / satelliteConfig.imageWidth;
    const scaleY = canvas.height / satelliteConfig.imageHeight;

    // Draw existing pitch boundaries
    if (satelliteConfig.pitchBoundaries) {
      satelliteConfig.pitchBoundaries.forEach((pitch, index) => {
        drawPitchBoundary(ctx, pitch, scaleX, scaleY, index);
      });
    }
  }, [imageLoaded, satelliteConfig]);

  // Draw individual pitch boundary with pitch number
  const drawPitchBoundary = (ctx, pitch, scaleX, scaleY, index) => {
    const x = pitch.boundaries.x1 * scaleX;
    const y = pitch.boundaries.y1 * scaleY;
    const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
    const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

    // Draw rectangle
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw pitch number (not the name, just the number)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add background for better visibility
    const pitchLabel = pitch.pitchNumber || `Pitch ${index + 1}`;
    const textMetrics = ctx.measureText(pitchLabel);
    const padding = 10;
    
    ctx.fillStyle = 'rgba(31, 41, 55, 0.8)';
    ctx.fillRect(
      x + width / 2 - textMetrics.width / 2 - padding,
      y + height / 2 - 15,
      textMetrics.width + padding * 2,
      30
    );
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      pitchLabel,
      x + width / 2,
      y + height / 2
    );
  };

  useEffect(() => {
    if (imageLoaded && canvasRef.current) {
      drawCanvas();
    }
  }, [imageLoaded, satelliteConfig, drawCanvas]);

  // Handle pitch clicks
  const handleCanvasClick = (e) => {
    if (!satelliteConfig?.pitchBoundaries) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    const clickedPitch = satelliteConfig.pitchBoundaries.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch) {
      if (onPitchClick) {
        onPitchClick(clickedPitch);
      } else {
        const pitchId = clickedPitch.pitchNumber || 'pitch1';
        navigate(`/allocator/${pitchId}`);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        margin: '0 auto',
        maxWidth: '600px'
      }}>
        <div style={{
          animation: 'spin 1s linear infinite',
          width: '50px',
          height: '50px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          margin: '0 auto 16px auto'
        }}></div>
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          Loading Satellite Map
        </h3>
        <p style={{ color: '#6b7280' }}>
          Please wait while we load your facility map...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#fef2f2',
        borderRadius: '12px',
        margin: '0 auto',
        maxWidth: '600px'
      }}>
        <Settings size={64} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>
          Error Loading Map
        </h3>
        <p style={{ color: '#7f1d1d', marginBottom: '16px' }}>
          {error}
        </p>
      </div>
    );
  }

  // No satellite config
  if (!satelliteConfig) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#fff3cd',
        borderRadius: '12px',
        margin: '0 auto',
        maxWidth: '800px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#856404', marginBottom: '16px' }}>
          No Satellite Configuration
        </h3>
        <p style={{ color: '#856404' }}>
          The satellite config is not loading. Please check Firebase configuration.
        </p>
        <button
          onClick={handleBackToMenu}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back to Menu
        </button>
      </div>
    );
  }

  // No satellite image configured
  if (!satelliteConfig?.imageUrl) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        margin: '0 auto',
        maxWidth: '600px'
      }}>
        <Settings size={64} color="#9ca3af" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          No Satellite Image
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          No satellite image has been configured for this facility yet. Please set up the satellite view in Settings.
        </p>
        <button
          onClick={handleBackToMenu}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Main render with map and legend
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <button
          onClick={handleBackToMenu}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← Back to Menu
        </button>
        
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          margin: 0 
        }}>
          {clubName} Facility Overview
        </h2>
        
        <div style={{ width: '120px' }}></div>
      </div>

      {/* Main content container with map and legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start'
      }}>
        {/* Canvas Container */}
        <div style={{
          flex: '1 1 auto',
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              cursor: satelliteConfig.pitchBoundaries?.length > 0 ? 'pointer' : 'default'
            }}
            onClick={handleCanvasClick}
          />
          
          {/* Hidden image element for loading */}
          <img
            ref={imageRef}
            src={satelliteConfig.imageUrl}
            onLoad={handleImageLoad}
            style={{ display: 'none' }}
            alt="Satellite view"
          />
        </div>

        {/* Legend Table */}
        {satelliteConfig?.pitchBoundaries?.length > 0 && (
          <div style={{
            minWidth: '300px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px',
              borderBottom: '2px solid #e5e7eb',
              paddingBottom: '8px'
            }}>
              Pitch Legend
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {satelliteConfig.pitchBoundaries.map((pitch, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    ':hover': {
                      backgroundColor: '#f3f4f6',
                      transform: 'translateX(4px)'
                    }
                  }}
                  onClick={() => {
                    const pitchId = pitch.pitchNumber || `pitch${index + 1}`;
                    navigate(`/allocator/${pitchId}`);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginRight: '12px'
                  }}>
                    {pitch.pitchNumber || `P${index + 1}`}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '2px'
                    }}>
                      {pitch.customName || pitch.name || `Pitch ${index + 1}`}
                    </div>
                    {pitch.description && (
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {pitch.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '20px'
                  }}>
                    →
                  </div>
                </div>
              ))}
            </div>
            
            {/* Instructions */}
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#0c4a6e'
            }}>
              Click on any pitch in the legend or on the map to view its allocation details.
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation instruction if no legend */}
      {(!satelliteConfig?.pitchBoundaries || satelliteConfig.pitchBoundaries.length === 0) && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#92400e', margin: 0 }}>
            No pitches have been configured. Please set up pitch boundaries in Settings.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClubPitchMap;
