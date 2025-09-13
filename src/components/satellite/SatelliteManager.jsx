// src/components/satellite/SatelliteManager.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db, getUserProfile } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import SatelliteImageUpload from './SatelliteImageUpload';
import SatelliteOverviewMap from './SatelliteOverviewMap';

const SatelliteManager = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, loading, error] = useAuthState(auth);
  
  // State
  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState(searchParams.get('view') || 'overview');

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Get user profile and club ID
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setClubId(profile?.clubId);
          setUserRole(profile?.role || 'user');
          console.log('User club ID:', profile?.clubId);
          
          // Fetch club name
          if (profile?.clubId) {
            const clubDoc = await getDoc(doc(db, 'clubs', profile.clubId));
            if (clubDoc.exists()) {
              setClubName(clubDoc.data().name || 'Club');
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
      setIsLoading(false);
    };

    if (!loading) {
      fetchUserProfile();
    }
  }, [user, loading]);

  // Subscribe to satellite config changes
  useEffect(() => {
    if (!clubId) return;

    const clubRef = doc(db, 'clubs', clubId);
    const unsubscribe = onSnapshot(clubRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSatelliteConfig(data.satelliteConfig || null);
      }
    });

    return () => unsubscribe();
  }, [clubId]);

  // Update URL when view changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (view !== 'overview') {
      newSearchParams.set('view', view);
    } else {
      newSearchParams.delete('view');
    }
    setSearchParams(newSearchParams);
  }, [view, searchParams, setSearchParams]);

  // Handle image upload completion
  const handleImageUploaded = (imageData) => {
    console.log('Image uploaded successfully:', imageData);
    setView('setup');
  };

  // Handle pitch click - navigate to UnifiedPitchAllocator
  const handlePitchClick = (pitch) => {
    console.log('Navigating to pitch:', pitch.pitchId, pitch);
    
    // Extract pitch number from pitchId or use pitchNumber
    // pitchId format is typically "pitch-1", so we extract the number
    let pitchNum = pitch.pitchNumber;
    if (!pitchNum && pitch.pitchId) {
      const match = pitch.pitchId.match(/\d+/);
      pitchNum = match ? match[0] : '1';
    }
    
    // Navigate to UnifiedPitchAllocator with the pitch number
    navigate(`/allocator/${pitchNum}`);
  };

  // Save pitch boundary configuration
  const handleSaveConfiguration = async (pitchBoundaries) => {
    try {
      const clubRef = doc(db, 'clubs', clubId);
      
      // Add pitchIds to boundaries (link to your existing pitch system)
      const boundariesWithIds = pitchBoundaries.map((boundary, index) => ({
        ...boundary,
        pitchId: `pitch-${index + 1}`,
        sectionsAvailable: getSectionsForSize(boundary.sizeType),
        isActive: true,
        createdBy: user.uid,
        createdAt: new Date()
      }));

      await updateDoc(clubRef, {
        'satelliteConfig.pitchBoundaries': boundariesWithIds,
        'satelliteConfig.lastUpdated': new Date()
      });

      setView('overview');
      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  // Helper function to get sections based on pitch size
  const getSectionsForSize = (sizeType) => {
    const sizeConfig = {
      small: 1,   // Training pitch
      medium: 4,  // Junior pitch
      large: 8    // Full pitch
    };
    return sizeConfig[sizeType] || 8;
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading satellite configuration...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error || !clubId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '32px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Access Error</h2>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            {error ? 'Authentication error' : 'No club found for your account'}
          </p>
        </div>
      </div>
    );
  }

  // Main component render with sidebar
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      gap: '0'
    }}>
      {/* Left Sidebar */}
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

        {/* Satellite Configuration Buttons */}
        {satelliteConfig?.imageUrl && (
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button
              onClick={() => setView('overview')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: view === 'overview' 
                  ? 'rgba(59, 130, 246, 0.3)' 
                  : 'rgba(255,255,255,0.1)',
                border: view === 'overview'
                  ? '1px solid rgba(59, 130, 246, 0.5)'
                  : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                marginBottom: '8px'
              }}
              onMouseEnter={(e) => {
                if (view !== 'overview') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (view !== 'overview') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
            >
              🗺️ Overview
            </button>

            <button
              onClick={() => setView('setup')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: view === 'setup' 
                  ? 'rgba(59, 130, 246, 0.3)' 
                  : 'rgba(255,255,255,0.1)',
                border: view === 'setup'
                  ? '1px solid rgba(59, 130, 246, 0.5)'
                  : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                marginBottom: '8px'
              }}
              onMouseEnter={(e) => {
                if (view !== 'setup') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (view !== 'setup') {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
            >
              ⚙️ Setup Pitches
            </button>
          </div>
        )}

        <div style={{
          padding: '16px'
        }}>
          <button
            onClick={() => setView('upload')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: view === 'upload' 
                ? 'rgba(59, 130, 246, 0.3)' 
                : 'rgba(255,255,255,0.1)',
              border: view === 'upload'
                ? '1px solid rgba(59, 130, 246, 0.5)'
                : '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (view !== 'upload') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (view !== 'upload') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }
            }}
          >
            📷 Change Image
          </button>
        </div>
        
        {/* Spacer to push bottom buttons down */}
        <div style={{
          flex: 1
        }}></div>
        
        {/* Bottom navigation buttons */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => navigate('/club-pitch-map')}
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
            🗺️ Back to Map View
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

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* View: Upload satellite image */}
          {(view === 'upload' || !satelliteConfig?.imageUrl) && (
            <SatelliteImageUpload
              clubId={clubId}
              onImageUploaded={handleImageUploaded}
            />
          )}

          {/* View: Setup pitch boundaries */}
          {view === 'setup' && satelliteConfig?.imageUrl && (
            <SatelliteOverviewMap
              clubId={clubId}
              satelliteConfig={satelliteConfig}
              isSetupMode={true}
              onSaveConfiguration={handleSaveConfiguration}
            />
          )}

          {/* View: Overview map (navigation mode) */}
          {view === 'overview' && satelliteConfig?.imageUrl && (
            <SatelliteOverviewMap
              clubId={clubId}
              satelliteConfig={satelliteConfig}
              isSetupMode={false}
              onPitchClick={handlePitchClick}
              onEnterSetupMode={() => setView('setup')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SatelliteManager;
