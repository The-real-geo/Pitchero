import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColorPicker } from './ColorPicker';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Constants
const SETTINGS_CONFIG = {
  MAX_TEAM_NAME_LENGTH: 50,
  MAX_PITCHES: 20,
  DEBOUNCE_DELAY: 1000,
  DEFAULT_PITCH_ORIENTATION: 'portrait',
  DEFAULT_TEAM_COLOR: '#FF0000',
  EXPORT_VERSION: '2.1',
  SAVE_DELAY: 500
};

// Default teams configuration
const DEFAULT_TEAMS = [
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

// Utility functions
const normalizePitchId = (id) => {
  if (!id) return '';
  // Ensure consistent string format
  return String(id);
};

const validateTeamName = (name, existingTeams) => {
  const errors = [];
  const trimmedName = name.trim();
  
  if (!trimmedName) {
    errors.push('Team name is required');
  }
  if (trimmedName.length > SETTINGS_CONFIG.MAX_TEAM_NAME_LENGTH) {
    errors.push(`Team name must be less than ${SETTINGS_CONFIG.MAX_TEAM_NAME_LENGTH} characters`);
  }
  if (existingTeams.some(team => team.name.toLowerCase() === trimmedName.toLowerCase())) {
    errors.push('Team name already exists');
  }
  
  return errors;
};

const validateImportData = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid settings format');
  }
  
  if (!data.teams || !Array.isArray(data.teams)) {
    throw new Error('Invalid settings format: teams array is required');
  }
  
  // Validate team structure
  data.teams.forEach((team, index) => {
    if (!team.name || typeof team.name !== 'string') {
      throw new Error(`Invalid team at position ${index + 1}: missing name`);
    }
    if (!team.color || typeof team.color !== 'string') {
      throw new Error(`Invalid team at position ${index + 1}: missing color`);
    }
  });
  
  // Check version compatibility
  if (data.version && !['2.0', '2.1'].includes(data.version)) {
    console.warn('Settings version may not be fully compatible');
  }
  
  return true;
};

// Loading skeleton component
const SettingsSkeleton = () => (
  <div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
    <div style={{ height: '32px', backgroundColor: '#e5e7eb', borderRadius: '8px', width: '200px', marginBottom: '16px' }}></div>
    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
      <div style={{ height: '40px', backgroundColor: '#e5e7eb', borderRadius: '6px', width: '120px' }}></div>
      <div style={{ height: '40px', backgroundColor: '#e5e7eb', borderRadius: '6px', width: '120px' }}></div>
      <div style={{ height: '40px', backgroundColor: '#e5e7eb', borderRadius: '6px', width: '120px' }}></div>
    </div>
    <div style={{ backgroundColor: '#e5e7eb', borderRadius: '12px', height: '300px', marginBottom: '24px' }}></div>
    <div style={{ backgroundColor: '#e5e7eb', borderRadius: '12px', height: '200px' }}></div>
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);

function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // Settings state
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(SETTINGS_CONFIG.DEFAULT_TEAM_COLOR);
  
  // Dynamic pitch states
  const [configuredPitches, setConfiguredPitches] = useState([]);
  const [pitchOrientations, setPitchOrientations] = useState({});
  const [showGrassArea, setShowGrassArea] = useState({});
  const [pitchNames, setPitchNames] = useState({});
  const [localPitchNames, setLocalPitchNames] = useState({});
  
  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Error and success state
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  
  // Loading states
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Refs for debouncing
  const saveTimeoutRef = useRef(null);
  const successTimeoutRef = useRef(null);
  
  // Memoized values
  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);

  // Show success message temporarily
  const showSuccess = useCallback((message) => {
    setSuccessMessage(message);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  }, []);

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
                    id: normalizePitchId(p.pitchId || p.pitchNumber || `pitch${p.pitchNumber}`),
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
          setErrors(prev => ({ ...prev, load: 'Failed to load user data' }));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize default settings for configured pitches
  useEffect(() => {
    if (configuredPitches.length > 0) {
      const defaultOrientations = {};
      const defaultGrassAreas = {};
      const defaultNames = {};
      
      configuredPitches.forEach(pitch => {
        const pitchId = normalizePitchId(pitch.id);
        defaultOrientations[pitchId] = SETTINGS_CONFIG.DEFAULT_PITCH_ORIENTATION;
        defaultGrassAreas[pitchId] = false;
        defaultNames[pitchId] = `Pitch ${pitch.number}`;
      });
      
      setPitchOrientations(prev => ({...defaultOrientations, ...prev}));
      setShowGrassArea(prev => ({...defaultGrassAreas, ...prev}));
      setPitchNames(prev => ({...defaultNames, ...prev}));
      setLocalPitchNames(prev => ({...defaultNames, ...prev}));
    }
  }, [configuredPitches]);

  // Firestore functions with optimistic updates
  const saveSettingsToFirestore = useCallback(async (customSettings = null, showSuccessMsg = true) => {
    if (!clubInfo?.clubId || !user) {
      console.error('No club ID or user available');
      return false;
    }

    setIsSavingSettings(true);
    try {
      const settingsRef = doc(db, 'clubs', clubInfo.clubId, 'settings', 'general');
      
      const settingsData = customSettings || {
        teams,
        pitchOrientations,
        showGrassArea,
        pitchNames,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.email
      };
      
      if (customSettings) {
        settingsData.lastUpdated = new Date().toISOString();
        settingsData.updatedBy = user.email;
      }

      await setDoc(settingsRef, settingsData);
      console.log('Settings saved to Firestore successfully');
      
      if (showSuccessMsg) {
        showSuccess('Settings saved successfully');
      }
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error('Error saving settings to Firestore:', error);
      setErrors({ submit: 'Failed to save settings. Please try again.' });
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }, [clubInfo, user, teams, pitchOrientations, showGrassArea, pitchNames, showSuccess]);

  // Debounced save function
  const debouncedSave = useCallback((settings) => {
    setHasUnsavedChanges(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveSettingsToFirestore(settings, false);
    }, SETTINGS_CONFIG.SAVE_DELAY);
  }, [saveSettingsToFirestore]);

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

  // Team management functions
  const handleAddTeam = async () => {
    const trimmedName = newTeamName.trim();
    
    // Validation
    const validationErrors = validateTeamName(trimmedName, teams);
    if (validationErrors.length > 0) {
      setErrors({ teamName: validationErrors[0] });
      return;
    }
    
    const updatedTeams = [...teams, { name: trimmedName, color: newTeamColor }];
    setTeams(updatedTeams);
    setNewTeamName('');
    setNewTeamColor(SETTINGS_CONFIG.DEFAULT_TEAM_COLOR);
    setErrors({});
    
    const success = await saveSettingsToFirestore({
      teams: updatedTeams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
    
    if (success) {
      showSuccess('Team added successfully');
    }
  };

  const removeTeam = async (index) => {
    const removedTeam = teams[index];
    const updatedTeams = teams.filter((_, i) => i !== index);
    setTeams(updatedTeams);
    
    const success = await saveSettingsToFirestore({
      teams: updatedTeams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
    
    if (success) {
      showSuccess(`Team "${removedTeam.name}" removed`);
    }
  };

  const updateTeamColor = (index, color) => {
    const updatedTeams = [...teams];
    updatedTeams[index].color = color;
    setTeams(updatedTeams);
    
    // Use debounced save for color changes
    debouncedSave({
      teams: updatedTeams,
      pitchOrientations,
      showGrassArea,
      pitchNames
    });
  };

  // Pitch configuration functions
  const updatePitchOrientation = async (pitchId, orientation) => {
    const normalizedId = normalizePitchId(pitchId);
    const updated = { ...pitchOrientations, [normalizedId]: orientation };
    setPitchOrientations(updated);
    
    await saveSettingsToFirestore({
      teams,
      pitchOrientations: updated,
      showGrassArea,
      pitchNames
    });
  };

  const updateGrassAreaVisibility = async (pitchId, show) => {
    const normalizedId = normalizePitchId(pitchId);
    const updated = { ...showGrassArea, [normalizedId]: show };
    setShowGrassArea(updated);
    
    await saveSettingsToFirestore({
      teams,
      pitchOrientations,
      showGrassArea: updated,
      pitchNames
    });
  };

  const handlePitchNameChange = (pitchId, name) => {
    const normalizedId = normalizePitchId(pitchId);
    setLocalPitchNames(prev => ({ ...prev, [normalizedId]: name }));
  };

  const handlePitchNameBlur = async (pitchId) => {
    const normalizedId = normalizePitchId(pitchId);
    
    if (localPitchNames[normalizedId] !== pitchNames[normalizedId]) {
      const updated = { ...pitchNames, [normalizedId]: localPitchNames[normalizedId] };
      setPitchNames(updated);
      
      const success = await saveSettingsToFirestore({
        teams,
        pitchOrientations,
        showGrassArea,
        pitchNames: updated
      });
      
      if (success) {
        showSuccess('Pitch name updated');
      }
    }
  };

  const resetToDefaults = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }
    
    setTeams(DEFAULT_TEAMS);
    
    const defaultOrientations = {};
    const defaultGrassAreas = {};
    const defaultNames = {};
    
    configuredPitches.forEach(pitch => {
      const pitchId = normalizePitchId(pitch.id);
      defaultOrientations[pitchId] = SETTINGS_CONFIG.DEFAULT_PITCH_ORIENTATION;
      defaultGrassAreas[pitchId] = false;
      defaultNames[pitchId] = `Pitch ${pitch.number}`;
    });
    
    setPitchOrientations(defaultOrientations);
    setShowGrassArea(defaultGrassAreas);
    setPitchNames(defaultNames);
    setLocalPitchNames(defaultNames);
    setErrors({});
    
    const success = await saveSettingsToFirestore({
      teams: DEFAULT_TEAMS,
      pitchOrientations: defaultOrientations,
      showGrassArea: defaultGrassAreas,
      pitchNames: defaultNames
    });
    
    if (success) {
      showSuccess('Settings reset to defaults');
    }
  };

  // Import/Export functions
  const handleExport = () => {
    const settings = {
      teams,
      pitchOrientations,
      showGrassArea,
      pitchNames,
      configuredPitches,
      exportDate: new Date().toISOString(),
      version: SETTINGS_CONFIG.EXPORT_VERSION,
      clubName: clubInfo?.name
    };
    setExportData(JSON.stringify(settings, null, 2));
    setShowExportModal(true);
  };

  const processImport = async () => {
    try {
      const settings = JSON.parse(importData);
      
      // Validate imported data
      validateImportData(settings);
      
      // Apply imported settings
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
      
      const success = await saveSettingsToFirestore({
        teams: settings.teams || teams,
        pitchOrientations: settings.pitchOrientations || pitchOrientations,
        showGrassArea: settings.showGrassArea || showGrassArea,
        pitchNames: settings.pitchNames || pitchNames
      });
      
      if (success) {
        showSuccess('Settings imported successfully');
      }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Loading state
  if (isLoadingSettings) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <SettingsSkeleton />
        </div>
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
            aria-label="Back to Menu"
          >
            ← Back to Menu
          </button>
        </div>

        {/* Status indicators */}
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
          }}
          role="status"
          aria-live="polite"
          >
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

        {successMessage && (
          <div style={{
            backgroundColor: '#d1fae5',
            border: '1px solid #34d399',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#065f46',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          role="status"
          aria-live="polite"
          >
            ✓ {successMessage}
          </div>
        )}

        {hasUnsavedChanges && !isSavingSettings && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#d97706',
            fontSize: '14px'
          }}
          role="status"
          >
            ⚠️ You have unsaved changes. They will be saved automatically.
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
          }}
          role="alert"
          >
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
          }}
          role="alert"
          >
            {errors.load}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '32px',
          flexWrap: 'wrap'
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
            aria-label="Export Settings"
            aria-busy={isSavingSettings}
          >
            📤 Export Settings
          </button>
          <button
            onClick={() => setShowImportModal(true)}
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
            aria-label="Import Settings"
            aria-busy={isSavingSettings}
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
            aria-label="Reset to Defaults"
            aria-busy={isSavingSettings}
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
            marginBottom: '20px',
            flexWrap: 'wrap'
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
                minWidth: '200px',
                padding: '8px 12px',
                border: errors.teamName ? '1px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              aria-label="New team name"
              aria-invalid={!!errors.teamName}
              aria-describedby={errors.teamName ? "team-error" : undefined}
              maxLength={SETTINGS_CONFIG.MAX_TEAM_NAME_LENGTH}
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
              aria-label="Add new team"
              aria-busy={isSavingSettings}
            >
              Add Team
            </button>
          </div>

          {errors.teamName && (
            <div 
              id="team-error"
              style={{
                color: '#ef4444',
                fontSize: '14px',
                marginTop: '-16px',
                marginBottom: '16px'
              }}
              role="alert"
            >
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
                key={`${team.name}-${index}`}
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
                    border: '1px solid #d1d5db',
                    flexShrink: 0
                  }}
                  aria-label={`Team color: ${team.color}`}
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
                  aria-label={`Remove team ${team.name}`}
                  aria-busy={isSavingSettings}
                >
                  Remove
                </button>
              </div>
            ))}
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
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
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
              onMouseOver={(e) => !isSavingSettings && (e.currentTarget.style.backgroundColor = '#6d28d9')}
              onMouseOut={(e) => !isSavingSettings && (e.currentTarget.style.backgroundColor = '#7c3aed')}
              aria-label="Go to Satellite Overview"
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
                  const pitchId = normalizePitchId(pitch.id);
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
                        <label 
                          htmlFor={`pitch-name-${pitchId}`}
                          style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151',
                            marginBottom: '8px'
                          }}
                        >
                          Pitch Name
                        </label>
                        {isAdmin ? (
                          <input
                            id={`pitch-name-${pitchId}`}
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
                            aria-label={`Name for pitch ${pitch.number}`}
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
                        <div 
                          style={{ display: 'flex', gap: '12px' }}
                          role="radiogroup"
                          aria-label={`Orientation for pitch ${pitch.number}`}
                        >
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
                            role="radio"
                            aria-checked={pitchOrientations[pitchId] === 'portrait'}
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
                            role="radio"
                            aria-checked={pitchOrientations[pitchId] === 'landscape'}
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
                            aria-label={`Show grass area for training on pitch ${pitch.number}`}
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
                {configuredPitches.length < SETTINGS_CONFIG.MAX_PITCHES && ` You can configure up to ${SETTINGS_CONFIG.MAX_PITCHES} pitches total.`}
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
        }}
        role="dialog"
        aria-labelledby="import-modal-title"
        aria-modal="true"
        >
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 
              id="import-modal-title"
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}
            >
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
              aria-label="Import settings JSON"
            />
            
            {errors.import && (
              <div 
                style={{
                  marginTop: '12px',
                  color: '#ef4444',
                  fontSize: '14px'
                }}
                role="alert"
              >
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
                aria-busy={isSavingSettings}
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
        }}
        role="dialog"
        aria-labelledby="export-modal-title"
        aria-modal="true"
        >
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 
              id="export-modal-title"
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}
            >
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
              aria-label="Exported settings JSON"
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportData);
                  showSuccess('Settings copied to clipboard!');
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
      
      {/* Global styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Settings;
