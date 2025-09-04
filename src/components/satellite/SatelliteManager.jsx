// src/components/satellite/SatelliteManager.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, getUserProfile } from '../../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import SatelliteImageUpload from './SatelliteImageUpload';
import SatelliteOverviewMap from './SatelliteOverviewMap';

const SatelliteManager = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, loading, error] = useAuthState(auth);
  
  // State
  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState(searchParams.get('view') || 'overview');

  // Get user profile and club ID
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
          setClubId(profile?.clubId);
          console.log('User club ID:', profile?.clubId);
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

  // Handle pitch click - navigate to training/match day allocator
  const handlePitchClick = (pitch) => {
    console.log('Navigating to pitch:', pitch.pitchId, pitch);
    
    // Navigate to training allocator with pitch information
    // You can modify this to go to match day allocator based on your needs
    navigate(`/training?pitch=${pitch.pitchId}&pitchNumber=${pitch.pitchNumber}`);
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
          <button
            onClick={() => navigate('/menu')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '20px'
    }}>
      {/* Header with back button */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => navigate('/menu')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Back to Menu
        </button>
      </div>

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

        {/* Navigation Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '24px',
          gap: '16px'
        }}>
          {satelliteConfig?.imageUrl && (
            <>
              <button
                onClick={() => setView('overview')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: view === 'overview' ? '#3b82f6' : '#e5e7eb',
                  color: view === 'overview' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Overview
              </button>
              <button
                onClick={() => setView('setup')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: view === 'setup' ? '#3b82f6' : '#e5e7eb',
                  color: view === 'setup' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Setup Pitches
              </button>
            </>
          )}
          <button
            onClick={() => setView('upload')}
            style={{
              padding: '12px 24px',
              backgroundColor: view === 'upload' ? '#3b82f6' : '#e5e7eb',
              color: view === 'upload' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Change Image
          </button>
        </div>
      </div>
    </div>
  );
};

export default SatelliteManager;
