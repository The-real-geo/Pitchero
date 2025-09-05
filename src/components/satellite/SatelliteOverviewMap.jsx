// src/components/satellite/SatelliteOverviewMap.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Edit3, Eye, Settings } from 'lucide-react';
import { auth, db } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const SatelliteOverviewMap = ({ 
  clubId, 
  satelliteConfig, 
  onPitchClick, 
  isSetupMode = false,
  onEnterSetupMode,
  onSaveConfiguration
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [clubName, setClubName] = useState('Loading...'); // Add club name state

  // Drawing states for setup mode
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [tempBoundaries, setTempBoundaries] = useState([]);

  // Fetch club name from Firebase
  useEffect(() => {
    let isMounted = true;
    
    const loadClubName = async () => {
      try {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (!currentUser) {
            if (isMounted) {
              setClubName('Club');
            }
            return;
          }

          try {
            // Get user data to find club ID
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (!userDoc.exists()) {
              if (isMounted) {
                setClubName('Club');
              }
              return;
            }

            const userData = userDoc.data();
            const userClubId = userData.clubId;
            
            if (!userClubId) {
              if (isMounted) {
                setClubName('Club');
              }
              return;
            }

            // Get club data
            const clubDoc = await getDoc(doc(db, 'clubs', userClubId));
            if (!clubDoc.exists()) {
              if (isMounted) {
                setClubName(`Club ${userClubId}`);
              }
              return;
            }

            const clubData = clubDoc.data();
            
            if (isMounted) {
              // Set club name - directly use the name field
              const foundName = clubData.name || `Club ${userClubId}`;
              console.log('SatelliteOverviewMap - Setting club name to:', foundName);
              setClubName(foundName);
            }
          } catch (err) {
            console.error('Error loading club name:', err);
            if (isMounted) {
              setClubName('Club');
            }
          }
        });

        return () => {
          isMounted = false;
          unsubscribe();
        };
      } catch (err) {
        console.error('Auth error:', err);
        if (isMounted) {
          setClubName('Club');
        }
      }
    };

    loadClubName();
  }, []);

  // Calculate canvas size maintaining aspect ratio
  const calculateCanvasSize = (imgWidth, imgHeight) => {
    const maxWidth = 1000;
    const maxHeight = 700;
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

    // Draw temporary boundaries (during setup)
    tempBoundaries.forEach((pitch, index) => {
      drawPitchBoundary(ctx, pitch, scaleX, scaleY, index, true);
    });

    // Draw current drawing rectangle
    if (currentDrawing && isSetupMode) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        currentDrawing.x1 * scaleX,
        currentDrawing.y1 * scaleY,
        (currentDrawing.x2 - currentDrawing.x1) * scaleX,
        (currentDrawing.y2 - currentDrawing.y1) * scaleY
      );
      ctx.setLineDash([]);
    }
  }, [imageLoaded, satelliteConfig, tempBoundaries, currentDrawing, isSetupMode]);

  // Draw individual pitch boundary
  const drawPitchBoundary = (ctx, pitch, scaleX, scaleY, index, isTemporary = false) => {
    const x = pitch.boundaries.x1 * scaleX;
    const y = pitch.boundaries.y1 * scaleY;
    const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
    const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

    // Draw rectangle
    ctx.fillStyle = isTemporary ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = isTemporary ? '#3b82f6' : '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw pitch label
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      pitch.pitchNumber || `Pitch ${index + 1}`,
      x + width / 2,
      y + height / 2
    );
  };

  useEffect(() => {
    if (imageLoaded && canvasRef.current) {
      drawCanvas();
    }
  }, [imageLoaded, satelliteConfig, tempBoundaries, drawCanvas]);
  
  // Handle mouse events for drawing (setup mode)
  const handleMouseDown = (e) => {
    if (!isSetupMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    setIsDrawing(true);
    setCurrentDrawing({ x1: x, y1: y, x2: x, y2: y });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isSetupMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    setCurrentDrawing(prev => ({ ...prev, x2: x, y2: y }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDrawing) return;

    // Minimum size check
    const minSize = 30;
    const width = Math.abs(currentDrawing.x2 - currentDrawing.x1);
    const height = Math.abs(currentDrawing.y2 - currentDrawing.y1);

    if (width > minSize && height > minSize) {
      // Normalize coordinates (ensure x1 < x2, y1 < y2)
      const normalizedBoundary = {
        pitchNumber: `${tempBoundaries.length + 1}`,
        sizeType: 'large', // Default - will be configurable in next phase
        boundaries: {
          x1: Math.min(currentDrawing.x1, currentDrawing.x2),
          y1: Math.min(currentDrawing.y1, currentDrawing.y2),
          x2: Math.max(currentDrawing.x1, currentDrawing.x2),
          y2: Math.max(currentDrawing.y1, currentDrawing.y2)
        }
      };

      setTempBoundaries(prev => [...prev, normalizedBoundary]);
    }

    setIsDrawing(false);
    setCurrentDrawing(null);
  };

  // Handle pitch clicks (navigation mode)
  const handleCanvasClick = (e) => {
    if (isSetupMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    // Check which pitch was clicked
    const clickedPitch = satelliteConfig.pitchBoundaries?.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch && onPitchClick) {
      onPitchClick(clickedPitch);
    }
  };

  // Save configuration (setup mode)
  const handleSaveConfiguration = () => {
    if (onSaveConfiguration && tempBoundaries.length > 0) {
      onSaveConfiguration(tempBoundaries);
      setTempBoundaries([]);
    }
  };

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
          Upload a satellite image to get started with interactive pitch navigation
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          margin: 0 
        }}>
          {isSetupMode ? 'Setup Pitch Boundaries' : `${clubName} Facility Overview`}
        </h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {isSetupMode ? (
            <>
              <button
                onClick={handleSaveConfiguration}
                disabled={tempBoundaries.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: tempBoundaries.length === 0 ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: tempBoundaries.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                <Eye size={16} />
                Save & Exit Setup
              </button>
            </>
          ) : (
            <button
              onClick={onEnterSetupMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              <Edit3 size={16} />
              Setup Pitches
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {isSetupMode && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <p style={{ color: '#1e40af', margin: 0 }}>
            <strong>Setup Mode:</strong> Click and drag to draw rectangles around each pitch. 
            Make sure to draw inside the actual pitch boundaries for accurate click detection.
          </p>
        </div>
      )}

      {/* Canvas Container */}
      <div style={{
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
            cursor: isSetupMode 
              ? 'crosshair' 
              : satelliteConfig.pitchBoundaries?.length > 0 
              ? 'pointer' 
              : 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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

      {/* Pitch List (Setup Mode) */}
      {isSetupMode && tempBoundaries.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: '24px',
          marginTop: '24px'
        }}>
          <h3 style={{ 
            fontWeight: '600', 
            marginBottom: '16px',
            color: '#1f2937'
          }}>
            Drawn Pitches ({tempBoundaries.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tempBoundaries.map((pitch, index) => (
              <div 
                key={index} 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}
              >
                <span style={{ fontWeight: '500' }}>Pitch {pitch.pitchNumber}</span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  {pitch.sizeType} ({Math.round(pitch.boundaries.x2 - pitch.boundaries.x1)} × {Math.round(pitch.boundaries.y2 - pitch.boundaries.y1)}px)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Instructions */}
      {!isSetupMode && satelliteConfig.pitchBoundaries?.length > 0 && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#0c4a6e', margin: 0 }}>
            Click on any pitch area to navigate to the detailed allocation view for that pitch.
          </p>
        </div>
      )}
    </div>
  );
};

export default SatelliteOverviewMap;
