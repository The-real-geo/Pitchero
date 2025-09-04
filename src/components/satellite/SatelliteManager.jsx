import React, { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase'; // Adjust path to your firebase config
import SatelliteImageUpload from './SatelliteImageUpload';
import SatelliteOverviewMap from './SatelliteOverviewMap';

const SatelliteManager = ({ 
  clubId, 
  onNavigateToPitch, // Function to navigate to your existing detailed allocation view
  currentView = 'overview' // 'overview' | 'upload' | 'setup'
}) => {
  const [satelliteConfig, setSatelliteConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(currentView);

  // Subscribe to satellite config changes
  useEffect(() => {
    if (!clubId) return;

    const clubRef = doc(db, 'clubs', clubId);
    const unsubscribe = onSnapshot(clubRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSatelliteConfig(data.satelliteConfig || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clubId]);

  // Handle image upload completion
  const handleImageUploaded = (imageData) => {
    console.log('Image uploaded successfully:', imageData);
    setView('setup'); // Move to setup mode after upload
  };

  // Handle pitch click - navigate to your existing detailed view
  const handlePitchClick = (pitch) => {
    if (onNavigateToPitch) {
      // This calls your existing navigation function
      // pitch object contains: { pitchId, pitchNumber, sizeType, boundaries, etc. }
      onNavigateToPitch(pitch.pitchId, pitch);
    }
  };

  // Save pitch boundary configuration
  const handleSaveConfiguration = async (pitchBoundaries) => {
    try {
      const clubRef = doc(db, 'clubs', clubId);
      
      // Add pitchIds to boundaries (link to your existing pitch system)
      const boundariesWithIds = pitchBoundaries.map((boundary, index) => ({
        ...boundary,
        pitchId: `pitch-${index + 1}`, // Adjust this to match your existing pitch ID system
        sectionsAvailable: getSectionsForSize(boundary.sizeType),
        isActive: true
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

  // Initialize satellite config if it doesn't exist
  const initializeSatelliteConfig = async () => {
    try {
      const clubRef = doc(db, 'clubs', clubId);
      await updateDoc(clubRef, {
        'satelliteConfig': {
          imageUrl: null,
          imageWidth: 0,
          imageHeight: 0,
          lastUpdated: null,
          pitchBoundaries: []
        }
      });
    } catch (error) {
      console.error('Failed to initialize satellite config:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Render different views based on current state
  return (
    <div className="max-w-6xl mx-auto p-4">
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
      <div className="flex justify-center mt-6 space-x-4">
        {satelliteConfig?.imageUrl && (
          <>
            <button
              onClick={() => setView('overview')}
              className={`px-4 py-2 rounded-lg ${
                view === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setView('setup')}
              className={`px-4 py-2 rounded-lg ${
                view === 'setup'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Setup Pitches
            </button>
          </>
        )}
        <button
          onClick={() => setView('upload')}
          className={`px-4 py-2 rounded-lg ${
            view === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Change Image
        </button>
      </div>
    </div>
  );
};

export default SatelliteManager;
