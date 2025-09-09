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
  const [clubName, setClubName] = useState(''); // Add state for club name
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
        // Load from club document directly, not subcollection
        const clubRef = doc(db, 'clubs', clubId);
        const clubDoc = await getDoc(clubRef);
        
        if (clubDoc.exists()) {
          const clubData = clubDoc.data();
          
          // Set club name from club document
          setClubName(clubData.name || 'Club'); // Fallback to 'Club' if name not found
          
          // Access satelliteConfig field from club document
          if (clubData.satelliteConfig) {
            setSatelliteConfig(clubData.satelliteConfig);
          } else {
            setSatelliteConfig(null); // No satellite config yet
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
  }, [imageLoaded, satelliteConfig]);

  // Draw individual pitch boundary
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
  }, [imageLoaded, satelliteConfig, drawCanvas]);

  // Handle pitch clicks (navigation mode)
  const handleCanvasClick = (e) => {
    if (!satelliteConfig?.pitchBoundaries) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    // Check which pitch was clicked
    const clickedPitch = satelliteConfig.pitchBoundaries.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch) {
      // Call external handler if provided
      if (onPitchClick) {
        onPitchClick(clickedPitch);
      } else {
        // Navigate to unified allocator with pitch info
        console.log('Clicked pitch:', clickedPitch);
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
        
        {/* Debug info even during loading */}
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderRadius: '4px',
          marginTop: '16px',
          fontSize: '12px',
          color: '#374151',
          textAlign: 'left'
        }}>
          <div><strong>Debug Info (Loading):</strong></div>
          <div>Club ID: {clubId || 'Not loaded'}</div>
          <div>Satellite Config: {satelliteConfig ? 'Loaded' : 'Not loaded'}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Error: {error || 'None'}</div>
        </div>
        
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
        
        {/* Debug info even during error */}
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderRadius: '4px',
          marginTop: '16px',
          fontSize: '12px',
          color: '#374151',
          textAlign: 'left'
        }}>
          <div><strong>Debug Info (Error):</strong></div>
          <div>Club ID: {clubId || 'Not loaded'}</div>
          <div>Club Name: {clubName || 'Not loaded'}</div>
          <div>Satellite Config: {satelliteConfig ? 'Loaded' : 'Not loaded'}</div>
          <div>Has imageUrl: {satelliteConfig?.imageUrl ? 'Yes' : 'No'}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Error: {error || 'None'}</div>
        </div>
      </div>
    );
  }

  // Debug view - let's always show this first to see what's happening
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
          Debug: No Satellite Config
        </h3>
        
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '16px',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#374151',
          textAlign: 'left',
          marginBottom: '16px'
        }}>
          <div><strong>Current State:</strong></div>
          <div>Club ID: {clubId || 'Not loaded'}</div>
          <div>Club Name: {clubName || 'Not loaded'}</div>
          <div>Satellite Config: {satelliteConfig ? 'Loaded' : 'NULL - This is the problem!'}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Error: {error || 'None'}</div>
          
          {satelliteConfig && (
            <div style={{ marginTop: '12px' }}>
              <div><strong>Satellite Config Details:</strong></div>
              <div>Has imageUrl: {satelliteConfig.imageUrl ? 'Yes' : 'No'}</div>
              <div>ImageUrl: {satelliteConfig.imageUrl || 'None'}</div>
              <div>Has pitchBoundaries: {satelliteConfig.pitchBoundaries ? 'Yes' : 'No'}</div>
              <div>Boundaries count: {satelliteConfig.pitchBoundaries?.length || 0}</div>
            </div>
          )}
        </div>
        
        <p style={{ color: '#856404' }}>
          The satellite config is not loading. Check Firebase for the club document structure.
        </p>
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
        
        {/* Show what we do have */}
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderRadius: '4px',
          marginTop: '16px',
          fontSize: '12px',
          color: '#374151',
          textAlign: 'left'
        }}>
          <div><strong>Debug Info:</strong></div>
          <div>Club ID: {clubId}</div>
          <div>Club Name: {clubName}</div>
          <div>Has Satellite Config: Yes</div>
          <div>Has imageUrl: No - This is why the map won't show</div>
          <div>Has pitchBoundaries: {satelliteConfig.pitchBoundaries ? 'Yes' : 'No'}</div>
          <div>Boundaries count: {satelliteConfig.pitchBoundaries?.length || 0}</div>
        </div>
      </div>
    );
  }

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
        
        {/* Empty div for spacing */}
        <div style={{ width: '120px' }}></div>
      </div>

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

      {/* Navigation Instructions */}
      {satelliteConfig.pitchBoundaries?.length > 0 && (
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

export default ClubPitchMap;
