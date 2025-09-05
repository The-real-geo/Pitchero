import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColorPicker } from './ColorPicker';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Default teams configuration
const defaultTeams = [
  { name: "Under 6", color: "#00FFFF" },
  { name: "Under 8", color: "#FF0000" },
  { name: "Under 9", color: "#0000FF" },
  { name: "Under 10", color: "#00AA00" },
  { name: "Under 11 - Red", color: "#CC0000" },
  { name: "Under 11 - Black", color: "#000000" },
  { name: "Under 12 YPL", color: "#FFD700" },
  { name: "Under 12 YSL", color: "#FF6600" },
  { name: "Under 13 YCC", color: "#8B00FF" },
  { name: "Under 14 YCC", color: "#FF1493" },
  { name: "Under 14 YSL", color: "#00CED1" },
  { name: "Under 15 YCC", color: "#8B4513" },
  { name: "Under 16 YCC", color: "#696969" }
];

function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // Settings state
  const [teams, setTeams] = useState(defaultTeams);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#FF0000');
  
  // Dynamic pitch states
  const [configuredPitches, setConfiguredPitches] = useState([]); // Pitches from satellite config
  const [pitchOrientations, setPitchOrientations] = useState({});
  const [showGrassArea, setShowGrassArea] = useState({});
  const [pitchNames, setPitchNames] = useState({});
  const [localPitchNames, setLocalPitchNames] = useState({});
  
  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Error state
  const [errors, setErrors] = useState({});
  
  // Loading states
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Get club info and user role from user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Set user role
            setUserRole(userData.role || 'user');
            
            // Get the actual club info if we have a clubId
            if (userData.clubId) {
              const clubDoc = await getDoc(doc(db, 'clubs', userData.clubId));
              if (clubDoc.exists()) {
                const clubData = clubDoc.data();
                setClubInfo({
                  clubId: userData.clubId,
                  name: clubData.name || userData.clubName || 'Unknown Club',
                  satelliteConfig: clubData.satelliteConfig || null
                });
                
                // Extract configured pitches from satellite config
                if (clubData.satelliteConfig?.pitchBoundaries) {
                  const pitches = clubData.satelliteConfig.pitchBoundaries.map(p => ({
                    id: p.pitchId || p.pitchNumber || `pitch-${p.pitchNumber}`,
                    number: p.pitchNumber || 'Unknown'
                  }));
                  setConfiguredPitches(pitches);
                  console.log('Configured pitches from satellite:', pitches);
                }
              } else {
                // Fallback if club document doesn't exist
                setClubInfo({
                  clubId: userData.clubId,
                  name: userData.clubName || 'Unknown Club',
                  satelliteConfig: null
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user/club data:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize default settings for configured pitches
  useEffect(() => {
    if (configuredPitches.length > 0) {
      // Initialize default pitch settings for all configured pitches
      const defaultOrientations = {};
      const defaultGrassAreas = {};
      const defaultNames = {};
      
      configuredPitches.forEach(pitch => {
        const pitchId = pitch.id;
        defaultOrientations[pitchId] = 'portrait';
        defaultGrassAreas[pitchId] = false;
        defaultNames[pitchId] = `Pitch ${pitch.number}`;
      });
      
      // Set as initial values (will be overwritten by loaded settings if they exist)
      setPitchOrientations(prev => ({...defaultOrientations, ...prev}));
      setShowGrassArea(prev => ({...defaultGrassAreas, ...prev}));
      setPitchNames(prev => ({...defaultNames, ...prev}));
      setLocalPitchNames(prev => ({...defaultNames, ...prev}));
    }
  }, [configuredPitches]);

  // Firestore functions
  const saveSettingsToFirestore = async (customSettings = null) => {
    if (!clubInfo?.clubId || !user) {
      console.error('No club ID or user available');
      return;
    }

    setIsSavingSettings(true);
    try {
      const settingsRef = doc(db, 'clubs', clubInfo.clubId, 'settings', 'general');
      
      // Use custom settings if provided, otherwise use current state
      const settingsData = customSettings || {
        teams,
        pitchOrientations,
        showGrassArea,
        pitchNames,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.email
      };
      
      // If custom settings provided, ensure metadata is added
      if (customSettings) {
        settingsData.lastUpdated = new Date().toISOString();
        settingsData.updatedBy = user.email;
      }

      await setDoc(settingsRef, settingsData);
      console.log('Settings saved to Firestore successfully');
    } catch (error) {
      console.error('Error saving settings to Firestore:', error);
      setErrors({ submit: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadSettingsFromFirestore = async () => {
    if (!clubInfo?.clubId) {
      console.log('No club ID available yet');
      return;
    }

    setIsLoadingSettings(true);
    try {
      const settingsRef = doc(db, 'clubs', clubInfo.clubId, 'settings', 'general');
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        console.log('Loaded settings from Firestore:', data);
        
        if (data.teams) setTeams(data.teams);
        if (data.pitchOrientations) setPitchOrientations(data.pitchOrientations);
        if (data.showGrassArea) setShowGrassArea(data.showGrassArea);
        if (data.pitchNames) {
          setPitchNames(data.pitchNames);
          setLocalPitchNames(data.pitchNames);
        }
      } else {
        console.log('No settings found in Firestore, using defaults');
      }
    } catch (error) {
      console.error('Error loading settings from Firestore:', error);
      setErrors({ load: 'Failed to load settings. Using default values.' });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Load settings when club info is available
  useEffect(() => {
    if (clubInfo?.clubId) {
      loadSettingsFromFirestore();
    }
  }, [clubInfo?.clubId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Team management functions with Firestore save
  const handleAddTeam = async () => {
    const trimmedName = newTeamName.trim();
    
    // Validation
    const newErrors = {};
    if (!trimmedName) {
      newErrors.teamName = 'Team name is required';
    }
    if (teams.some(team => team.name.toLowerCase() === trimmedName.toLowerCase())) {
      newErrors.teamName = 'Team name already exists';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const updatedTeams = [...teams, { name: trimmedName, color: newTeamColor }];
    setTeams(updatedTeams);
    setNewTeamName('');
    setNewTeamColor('#FF0000');
    setErrors({});
    
    // Save to Firestore with the updated teams directly
    await saveSettingsToFirestore({
      teams: updatedTeams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
  };

  const removeTeam = async (index) => {
    const updatedTeams = teams.filter((_, i) => i !== index);
    setTeams(updatedTeams);
    
    // Save to Firestore with the updated teams directly
    await saveSettingsToFirestore({
      teams: updatedTeams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
  };

  const updateTeamColor = (index, color) => {
    const updatedTeams = [...teams];
    updatedTeams[index].color = color;
    setTeams(updatedTeams);
    // Note: Not auto-saving color changes to avoid excessive Firestore writes
    // User should click a save button or it saves when they add/remove teams
  };
  
  // Manual save function for color changes
  const saveColorChanges = async () => {
    await saveSettingsToFirestore({
      teams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
  };

  // Pitch configuration functions with Firestore save
  const updatePitchOrientation = async (pitchId, orientation) => {
    const updated = { ...pitchOrientations, [pitchId]: orientation };
    setPitchOrientations(updated);
    
    // Save to Firestore with updated settings directly
    await saveSettingsToFirestore({
      teams,
      pitchOrientations: updated,
      showGrassArea,
      pitchNames
    });
  };

  const updateGrassAreaVisibility = async (pitchId, show) => {
    const updated = { ...showGrassArea, [pitchId]: show };
    setShowGrassArea(updated);
    
    // Save to Firestore with updated settings directly
    await saveSettingsToFirestore({
      teams,
      pitchOrientations,
      showGrassArea: updated,
      pitchNames
    });
  };

  // New functions for pitch name handling
  const handlePitchNameChange = (pitchId, name) => {
    setLocalPitchNames(prev => ({ ...prev, [pitchId]: name }));
  };

  const handlePitchNameBlur = async (pitchId) => {
    // Only save if the name actually changed
    if (localPitchNames[pitchId] !== pitchNames[pitchId]) {
      const updated = { ...pitchNames, [pitchId]: localPitchNames[pitchId] };
      setPitchNames(updated);
      
      // Save to Firestore
      await saveSettingsToFirestore({
        teams,
        pitchOrientations,
        showGrassArea,
        pitchNames: updated
      });
    }
  };

  const resetToDefaults = async () => {
    // Reset teams to defaults
    setTeams(defaultTeams);
    
    // Reset pitch settings to defaults for all configured pitches
    const defaultOrientations = {};
    const defaultGrassAreas = {};
    const defaultNames = {};
    
    configuredPitches.forEach(pitch => {
      const pitchId = pitch.id;
      defaultOrientations[pitchId] = 'portrait';
      defaultGrassAreas[pitchId] = false;
      defaultNames[pitchId] = `Pitch ${pitch.number}`;
    });
    
    setPitchOrientations(defaultOrientations);
    setShowGrassArea(defaultGrassAreas);
    setPitchNames(defaultNames);
    setLocalPitchNames(defaultNames);
    setErrors({});
    
    // Save defaults to Firestore
    await saveSettingsToFirestore({
      teams: defaultTeams,
      pitchOrientations: defaultOrientations,
      showGrassArea: defaultGrassAreas,
      pitchNames: defaultNames
    });
  };

  // Import/Export functions
  const handleExport = () => {
    const settings = {
      teams,
      pitchOrientations,
      showGrassArea,
      pitchNames,
      configuredPitches, // Include configured pitches info for reference
      exportDate: new Date().toISOString(),
      version: '2.0' // Updated version for dynamic pitches
    };
    setExportData(JSON.stringify(settings, null, 2));
    setShowExportModal(true);
  };

  const handleImport = () => {
    setShowImportModal(true);
    setImportData('');
  };

  const processImport = async () => {
    try {
      const settings = JSON.parse(importData);
      
      // Validate the imported data structure
      if (!settings.teams || !Array.isArray(settings.teams)) {
        throw new Error('Invalid settings format: teams array is required');
      }
      
      // Apply imported settings to state
      if (settings.teams) setTeams(settings.teams);
      if (settings.pitchOrientations) setPitchOrientations(settings.pitchOrientations);
      if (settings.showGrassArea) setShowGrassArea(settings.showGrassArea);
      if (settings.pitchNames) {
        setPitchNames(settings.pitchNames);
        setLocalPitchNames(settings.pitchNames);
      }
      
      setShowImportModal(false);
      setImportData('');
      setErrors({});
      
      // Save imported settings to Firestore with the actual imported data
      await saveSettingsToFirestore({
        teams: settings.teams || teams,
        pitchOrientations: settings.pitchOrientations || pitchOrientations,
        showGrassArea: settings.showGrassArea || showGrassArea,
        pitchNames: settings.pitchNames || pitchNames
      });
    } catch (error) {
      setErrors({ import: `Import failed: ${error.message}` });
    }
  };

  const downloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settings-${clubInfo?.name || 'club'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Check if user is admin
  const isAdmin = userRole === 'admin';

  // Loading overlay
  if (isLoadingSettings) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{
          animation: 'spin 1s linear infinite',
          width: '50px',
          height: '50px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%'
        }}></div>
        <p style={{
          marginTop: '16px',
          fontSize: '16px',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          Loading settings...
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

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: '0'
            }}>
              Settings
            </h1>
            {clubInfo && (
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginTop: '4px'
              }}>
                {clubInfo.name} • {user?.email} • Role: {userRole}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/menu')}
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
        </div>

        {/* Saving indicator */}
        {isSavingSettings && (
          <div style={{
            backgroundColor: '#dbeafe',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              animation: 'spin 1s linear infinite',
              width: '16px',
              height: '16px',
              border: '2px solid #93c5fd',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%'
            }}></div>
            <span style={{ color: '#1e40af', fontSize: '14px' }}>
              Saving settings to cloud...
            </span>
          </div>
        )}

        {/* Error Messages */}
        {errors.submit && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            color: '#dc2626'
          }}>
            {errors.submit}
          </div>
        )}

        {errors.load && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            color: '#d97706'
          }}>
            {errors.load}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '32px'
        }}>
          <button
            onClick={handleExport}
            disabled={isSavingSettings}
            style={{
              padding: '10px 20px',
              backgroundColor: isSavingSettings ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isSavingSettings ? 0.6 : 1
            }}
          >
            📤 Export Settings
          </button>
          <button
            onClick={handleImport}
            disabled={isSavingSettings}
            style={{
              padding: '10px 20px',
              backgroundColor: isSavingSettings ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isSavingSettings ? 0.6 : 1
            }}
          >
            📥 Import Settings
          </button>
          <button
            onClick={resetToDefaults}
            disabled={isSavingSettings}
            style={{
              padding: '10px 20px',
              backgroundColor: isSavingSettings ? '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: isSavingSettings ? 0.6 : 1
            }}
          >
            🔄 Reset to Defaults
          </button>
        </div>

        {/* Teams Configuration */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '20px'
          }}>
            Teams Configuration
          </h2>

          {/* Add Team Form */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <input
              type="text"
              placeholder="Enter team name..."
              value={newTeamName}
              onChange={(e) => {
                setNewTeamName(e.target.value);
                setErrors({ ...errors, teamName: '' });
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTeam()}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: errors.teamName ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <ColorPicker
              color={newTeamColor}
              onChange={setNewTeamColor}
            />
            <button
              onClick={handleAddTeam}
              disabled={isSavingSettings}
              style={{
                padding: '8px 20px',
                backgroundColor: isSavingSettings ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isSavingSettings ? 0.6 : 1
              }}
            >
              Add Team
            </button>
          </div>

          {errors.teamName && (
            <div style={{
              color: '#ef4444',
              fontSize: '14px',
              marginTop: '-16px',
              marginBottom: '16px'
            }}>
              {errors.teamName}
            </div>
          )}

          {/* Teams List */}
          <div style={{
            display: 'grid',
            gap: '8px'
          }}>
            {teams.map((team, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: team.color,
                    borderRadius: '4px',
                    border: '1px solid #d1d5db'
                  }}
                />
                <span style={{
                  flex: 1,
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  {team.name}
                </span>
                <ColorPicker
                  color={team.color}
                  onChange={(color) => updateTeamColor(index, color)}
                />
                <button
                  onClick={() => removeTeam(index)}
                  disabled={isSavingSettings}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: isSavingSettings ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    opacity: isSavingSettings ? 0.6 : 1
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          {/* Save Color Changes Button */}
          <div style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={saveColorChanges}
              disabled={isSavingSettings}
              style={{
                padding: '8px 16px',
                backgroundColor: isSavingSettings ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isSavingSettings ? 0.6 : 1
              }}
            >
              {isSavingSettings ? 'Saving...' : 'Save Color Changes'}
            </button>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#0369a1'
          }}>
            💡 Total teams configured: {teams.length}
          </div>
        </div>

        {/* Pitch Configuration */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0'
            }}>
              Pitch Configuration {configuredPitches.length > 0 && `(${configuredPitches.length} pitch${configuredPitches.length !== 1 ? 'es' : ''})`}
            </h2>
            <button
              onClick={() => navigate('/satellite')}
              disabled={isSavingSettings}
              style={{
                padding: '16px 24px',
                backgroundColor: isSavingSettings ? '#9ca3af' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                fontWeight: '600',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isSavingSettings ? 0.6 : 1
              }}
              onMouseOver={(e) => !isSavingSettings && (e.target.style.backgroundColor = '#6d28d9')}
              onMouseOut={(e) => !isSavingSettings && (e.target.style.backgroundColor = '#7c3aed')}
            >
              📡 Satellite Overview
            </button>
          </div>

          {/* Check if there are configured pitches */}
          {configuredPitches.length === 0 ? (
            <div style={{
              padding: '32px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '16px',
                color: '#92400e',
                marginBottom: '16px'
              }}>
                No pitches have been configured yet.
              </p>
              <p style={{
                fontSize: '14px',
                color: '#92400e',
                marginBottom: '24px'
              }}>
                Click the "Satellite Overview" button above to set up your facility's pitches.
              </p>
            </div>
          ) : (
            <>
              {/* Scrollable container for many pitches */}
              <div style={{
                maxHeight: '600px',
                overflowY: 'auto',
                paddingRight: '8px'
              }}>
                {configuredPitches.map((pitch) => {
                  const pitchId = pitch.id;
                  return (
                    <div
                      key={pitchId}
                      style={{
                        marginBottom: '24px',
                        padding: '16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      {/* Pitch Name - only editable by admin */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '8px'
                        }}>
                          Pitch Name
                        </label>
                        {isAdmin ? (
                          <input
                            type="text"
                            value={localPitchNames[pitchId] || ''}
                            onChange={(e) => handlePitchNameChange(pitchId, e.target.value)}
                            onBlur={() => handlePitchNameBlur(pitchId)}
                            disabled={isSavingSettings}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              opacity: isSavingSettings ? 0.6 : 1
                            }}
                            placeholder={`Pitch ${pitch.number}`}
                          />
                        ) : (
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            {pitchNames[pitchId] || `Pitch ${pitch.number}`}
                          </div>
                        )}
                        {isAdmin && (
                          <p style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '4px',
                            fontStyle: 'italic'
                          }}>
                            Admin only: You can customize this pitch name
                          </p>
                        )}
                      </div>

                      {/* Orientation */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          marginBottom: '8px'
                        }}>
                          Orientation
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={() => updatePitchOrientation(pitchId, 'portrait')}
                            disabled={isSavingSettings}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: pitchOrientations[pitchId] === 'portrait' ? '#3b82f6' : '#e5e7eb',
                              color: pitchOrientations[pitchId] === 'portrait' ? 'white' : '#374151',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              opacity: isSavingSettings ? 0.6 : 1
                            }}
                          >
                            Portrait
                          </button>
                          <button
                            onClick={() => updatePitchOrientation(pitchId, 'landscape')}
                            disabled={isSavingSettings}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: pitchOrientations[pitchId] === 'landscape' ? '#3b82f6' : '#e5e7eb',
                              color: pitchOrientations[pitchId] === 'landscape' ? 'white' : '#374151',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isSavingSettings ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              opacity: isSavingSettings ? 0.6 : 1
                            }}
                          >
                            Landscape
                          </button>
                        </div>
                      </div>

                      {/* Grass Area Option */}
                      <div>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151',
                          cursor: isSavingSettings ? 'not-allowed' : 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={showGrassArea[pitchId] || false}
                            onChange={(e) => updateGrassAreaVisibility(pitchId, e.target.checked)}
                            disabled={isSavingSettings}
                            style={{ cursor: isSavingSettings ? 'not-allowed' : 'pointer' }}
                          />
                          Show grass area for training
                        </label>
                        <p style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginTop: '4px',
                          marginLeft: '24px'
                        }}>
                          Enable an additional grass training area for this pitch
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Info about configured pitches */}
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#0369a1'
              }}>
                💡 {configuredPitches.length} pitch{configuredPitches.length !== 1 ? 'es' : ''} configured. 
                {configuredPitches.length < 30 && ` You can configure up to 30 pitches total.`}
              </div>
            </>
          )}
          
          {!isAdmin && configuredPitches.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#d97706'
            }}>
              ⚠️ Note: Only administrators can change pitch names. Contact your admin if you need to update them.
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Import Settings
            </h3>
            
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your settings JSON here..."
              style={{
                width: '100%',
                height: '300px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
            
            {errors.import && (
              <div style={{
                marginTop: '12px',
                color: '#ef4444',
                fontSize: '14px'
              }}>
                {errors.import}
              </div>
            )}
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                  setErrors({ ...errors, import: '' });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={processImport}
                disabled={!importData || isSavingSettings}
                style={{
                  padding: '8px 16px',
                  backgroundColor: (!importData || isSavingSettings) ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!importData || isSavingSettings) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: (!importData || isSavingSettings) ? 0.6 : 1
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Export Settings
            </h3>
            
            <textarea
              value={exportData}
              readOnly
              style={{
                width: '100%',
                height: '300px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'monospace',
                resize: 'vertical',
                backgroundColor: '#f9fafb'
              }}
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportData);
                  alert('Settings copied to clipboard!');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={downloadExport}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                💾 Download JSON
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
