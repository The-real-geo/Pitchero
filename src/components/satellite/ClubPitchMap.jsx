// src/components/satellite/ClubPitchMap.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { auth, db } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const ClubPitchMap = ({ 
  onPitchClick 
}) => {
  console.log('🔴🔴🔴 CLUBPITCHMAP COMPONENT LOADED - VERSION 5.0 🔴🔴🔴');
  console.log('Component mounted at:', new Date().toISOString());
  console.log('🟢 VERSION 5.0 - With pitch names fix and new sidebar');
  
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // States for data loading - INCLUDING PITCH NAMES!
  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [pitchNames, setPitchNames] = useState({}); // THIS IS THE CRITICAL STATE FOR PITCH NAMES
  const [clubId, setClubId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // User states
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // TEST USEEFFECT
  useEffect(() => {
    console.log('🔥🔥🔥 BASIC useEffect IS RUNNING! 🔥🔥🔥');
    console.log('Component has mounted successfully');
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Load user and club data
  useEffect(() => {
    console.log('🔍 Starting auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('👤 Auth state changed, currentUser:', currentUser?.uid || 'null');
      
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          console.log('📄 User doc exists:', userDoc.exists());
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('📊 User data clubId:', userData.clubId);
            
            setUserRole(userData.role || 'user');
            
            if (userData.clubId) {
              setClubId(userData.clubId);
              console.log('✅ Club ID SET:', userData.clubId);
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
        console.log('❌ No user authenticated');
        setError('User not authenticated');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load satellite configuration when clubId is available
  useEffect(() => {
    console.log('🔍 useEffect for satellite config triggered, clubId is:', clubId);
    
    const loadSatelliteConfig = async () => {
      if (!clubId) {
        console.log('⚠️ No clubId, returning early');
        return;
      }

      console.log('🚀 STARTING TO LOAD SATELLITE CONFIG - VERSION 5.0');
      console.log('🔑 Club ID:', clubId);

      try {
        setLoading(true);
        
        // Load club document for satellite config
        const clubRef = doc(db, 'clubs', clubId);
        const clubDoc = await getDoc(clubRef);
        
        if (clubDoc.exists()) {
          const clubData = clubDoc.data();
          setClubName(clubData.name || 'Club');
          
          if (clubData.satelliteConfig) {
            setSatelliteConfig(clubData.satelliteConfig);
            console.log('✅ Satellite config loaded');
          } else {
            setSatelliteConfig(null);
            console.log('⚠️ No satellite config found');
          }
        } else {
          setError('Club not found');
        }
        
        // CRITICAL: Load pitch names from settings/general document
        try {
          const settingsRef = doc(db, 'clubs', clubId, 'settings', 'general');
          console.log('🔍 FETCHING PITCH NAMES FROM:', `clubs/${clubId}/settings/general`);
          const settingsDoc = await getDoc(settingsRef);
          
          if (settingsDoc.exists()) {
            const settingsData = settingsDoc.data();
            console.log('📋 SETTINGS DATA:', settingsData);
            
            if (settingsData.pitchNames) {
              setPitchNames(settingsData.pitchNames);
              console.log('✅ PITCH NAMES LOADED:', settingsData.pitchNames);
            } else {
              console.log('❌ NO pitchNames FIELD IN SETTINGS');
              setPitchNames({});
            }
          } else {
            console.log('❌ SETTINGS DOCUMENT DOES NOT EXIST');
            setPitchNames({});
          }
        } catch (settingsError) {
          console.error('❌ ERROR LOADING PITCH NAMES:', settingsError);
          setPitchNames({});
        }
        
      } catch (err) {
        console.error('❌ Error loading satellite config:', err);
        setError('Failed to load satellite configuration');
      } finally {
        setLoading(false);
      }
    };

    loadSatelliteConfig();
  }, [clubId]);

  // Helper function to get pitch display name
  const getPitchDisplayName = (pitchNumber) => {
    const possibleKeys = [
      `pitch-${pitchNumber}`,
      `pitch${pitchNumber}`,
      `Pitch ${pitchNumber}`,
      `Pitch-${pitchNumber}`,
      pitchNumber.toString(),
    ];
    
    for (const key of possibleKeys) {
      if (pitchNames && pitchNames[key]) {
        return pitchNames[key];
      }
    }
    
    return `Pitch ${pitchNumber}`;
  };

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
        maxWidth: '600px',
        marginTop: '100px'
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
        maxWidth: '600px',
        marginTop: '100px'
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
        maxWidth: '800px',
        marginTop: '100px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#856404', marginBottom: '16px' }}>
          No Satellite Configuration
        </h3>
        <p style={{ color: '#856404' }}>
          The satellite config is not loading. Please check Firebase configuration.
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
        maxWidth: '600px',
        marginTop: '100px'
      }}>
        <Settings size={64} color="#9ca3af" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          No Satellite Image
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          No satellite image has been configured for this facility yet. Please set up the satellite view in Settings.
        </p>
        <button
          onClick={() => navigate('/menu')}
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

  // Main render with map and sidebar
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      gap: '0'
    }}>
      {/* Left Sidebar - Pitch Quick Navigation */}
      {satelliteConfig?.pitchBoundaries && (
        <div style={{
          width: '250px',
          flexShrink: 0,
          backgroundColor: '#243665',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* User Info Section at the top */}
          <div style={{
            padding: '20px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.1)'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '12px'
            }}>
              {clubName || 'Loading...'}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.9)',
              marginBottom: '4px'
            }}>
              {user?.email || 'Not logged in'}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              padding: '4px 8px',
              backgroundColor: userRole === 'admin' ? '#10b981' : '#6b7280',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '4px'
            }}>
              {userRole === 'admin' ? 'Administrator' : userRole === 'viewer' ? 'Viewer' : 'User'}
            </div>
          </div>
          
          {/* Scrollable pitch navigation section */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: '16px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Pitch Navigation
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {satelliteConfig.pitchBoundaries.map((pitch, index) => {
                const pitchNum = pitch.pitchNumber || (index + 1);
                const displayName = getPitchDisplayName(pitchNum);
                
                return (
                  <button
                    key={pitchNum}
                    onClick={() => {
                      // Navigate to the selected pitch allocator
                      navigate(`/allocator/${pitchNum}`);
                    }}
                    style={{
                      padding: '12px 8px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                    }}
                  >
                    <div>{displayName}</div>
                    <div style={{ 
                      fontSize: '11px', 
                      marginTop: '4px', 
                      opacity: 0.8 
                    }}>
                      Click to view allocations
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Bottom navigation buttons */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.1)'
          }}>
            <button
              onClick={() => navigate('/menu')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }}
            >
              🏠 Back to Menu
            </button>
            
            <button
              onClick={() => navigate('/settings')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }}
            >
              ⚙️ Settings
            </button>
            
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ 
        flex: 1,
        padding: '24px',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#1f2937', 
            margin: 0 
          }}>
            {clubName} Facility Overview
          </h2>
        </div>

        {/* Main content container with map and legend */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          maxWidth: '1400px',
          margin: '0 auto'
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

          {/* Clean Legend - Non-clickable */}
          {satelliteConfig?.pitchBoundaries?.length > 0 && (
            <div style={{
              minWidth: '200px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '16px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                Pitch Legend
                {Object.keys(pitchNames).length === 0 && (
                  <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '8px' }}>
                    (Names not loaded)
                  </span>
                )}
              </div>
              
              {console.log('🎨 RENDERING LEGEND with pitchNames:', pitchNames)}
              {console.log('🎨 PitchNames keys:', Object.keys(pitchNames))}
              
              {satelliteConfig.pitchBoundaries.map((pitch, index) => {
                const pitchNumber = pitch.pitchNumber || (index + 1);
                const displayName = getPitchDisplayName(pitchNumber);
                
                return (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      marginBottom: '4px',
                      cursor: 'default',
                      pointerEvents: 'none'  // Non-clickable
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      marginRight: '12px'
                    }}>
                      {pitchNumber}
                    </div>
                    
                    <div style={{ 
                      flex: 1,
                      fontSize: '14px',
                      color: '#374151'
                    }}>
                      {displayName}
                    </div>
                  </div>
                );
              })}
              
              <div style={{
                padding: '8px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1e40af',
                textAlign: 'center',
                maxWidth: '250px',
                margin: '12px auto 0'
              }}>
                Click on a pitch on the map to view the training or game allocations for that specific pitch.
              </div>
            </div>
          )}
        </div>

        {/* Bottom instruction if no pitches configured */}
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
    </div>
  );
};

export default ClubPitchMap;
