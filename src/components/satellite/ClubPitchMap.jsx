// src/components/satellite/ClubPitchMap.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { auth, db } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ClubPitchMap = ({ onPitchClick }) => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Load satellite config
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

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / satelliteConfig.imageWidth;
    const scaleY = canvas.height / satelliteConfig.imageHeight;

    if (satelliteConfig.pitchBoundaries) {
      satelliteConfig.pitchBoundaries.forEach((pitch, index) => {
        drawPitchBoundary(ctx, pitch, scaleX, scaleY, index);
      });
    }
  }, [imageLoaded, satelliteConfig]);

  const drawPitchBoundary = (ctx, pitch, scaleX, scaleY, index) => {
    const x = pitch.boundaries.x1 * scaleX;
    const y = pitch.boundaries.y1 * scaleY;
    const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
    const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

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

  const handleCanvasClick = (e) => {
    if (!satelliteConfig?.pitchBoundaries) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    const clickedPitch = satelliteConfig.pitchBoundaries.find((pitch) => {
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <h3>Loading Satellite Map...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#fef2f2' }}>
        <Settings size={64} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h3>Error Loading Map</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!satelliteConfig) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#fff3cd' }}>
        <h3>No Satellite Config Found</h3>
      </div>
    );
  }

  if (!satelliteConfig?.imageUrl) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <Settings size={64} color="#9ca3af" style={{ marginBottom: '16px' }} />
        <h3>No Satellite Image</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={handleBackToMenu}
          style={{ padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px' }}
        >
          ← Back to Menu
        </button>
        <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>{clubName} Facility Overview</h2>
        <div style={{ width: '120px' }}></div>
      </div>

      <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ maxWidth: '100%', height: 'auto', cursor: satelliteConfig.pitchBoundaries?.length > 0 ? 'pointer' : 'default' }}
          onClick={handleCanvasClick}
        />
        <img ref={imageRef} src={satelliteConfig.imageUrl} onLoad={handleImageLoad} style={{ display: 'none' }} alt="Satellite view" />
      </div>

      {/* Legend Table */}
      {satelliteConfig.pitchBoundaries?.length > 0 && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '400px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #d1d5db', padding: '8px' }}>Pitch #</th>
                <th style={{ border: '1px solid #d1d5db', padding: '8px' }}>Custom Name</th>
              </tr>
            </thead>
            <tbody>
              {satelliteConfig.pitchBoundaries.map((pitch, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'center' }}>
                    {pitch.pitchNumber || index + 1}
                  </td>
                  <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>
                    {pitch.customName || `Pitch ${index + 1}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {satelliteConfig.pitchBoundaries?.length > 0 && (
        <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '16px', marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#0c4a6e', margin: 0 }}>
            Click on any pitch area to navigate to the detailed allocation view for that pitch.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClubPitchMap;
