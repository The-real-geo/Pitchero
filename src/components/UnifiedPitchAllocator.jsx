// src/components/UnifiedPitchAllocator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Reusing constants from existing allocators
const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Time slots function from existing allocators
const timeSlots = (start = 9, end = 18) => {
  const slots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

const UnifiedPitchAllocator = () => {
  const { pitchId } = useParams();
  const navigate = useNavigate();
  
  // User and club data
  const [user, setUser] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [pitchNames, setPitchNames] = useState({});
  const [showGrassArea, setShowGrassArea] = useState({});
  
  // Allocation state
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Form state - following existing allocator patterns
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [allocationType, setAllocationType] = useState('training');
  const [team, setTeam] = useState('');
  const [section, setSection] = useState('A');
  const [sectionGroup, setSectionGroup] = useState('A');
  const [slot, setSlot] = useState('09:00');
  const [duration, setDuration] = useState(30);

  // Time slots - reusing existing pattern
  const slots = useMemo(() => timeSlots(), []);

  // Helper function from existing allocators
  const isLightColor = (color) => {
    if (!color) return true;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
  };

  // Match day pitch area requirements - reusing existing logic
  const matchDayPitchAreaRequired = useMemo(() => ({
    'Under 6': 'Under 6 & 7',
    'Under 8': 'Under 8 & 9',
    'Under 9': 'Under 8 & 9', 
    'Under 10': 'Under 10-13',
    'Under 11': 'Under 10-13',
    'Under 12': 'Under 10-13',
    'Under 13': 'Under 10-13',
    'Under 14': 'Under 14+',
    'Under 15': 'Under 14+',
    'Under 16': 'Under 14+'
  }), []);

  // Get default pitch area for team - reusing existing logic
  const getDefaultPitchAreaForTeam = useCallback((teamName) => {
    const ageMatch = teamName.match(/Under (\d+)/);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age <= 7) return 'Under 6 & 7';
      if (age <= 9) return 'Under 8 & 9';
      if (age <= 13) return 'Under 10-13';
      return 'Under 14+';
    }
    return 'Under 6 & 7';
  }, []);

  // Get match day duration - reusing existing logic
  const getMatchDayDuration = useCallback((teamName) => {
    const ageMatch = teamName.match(/Under (\d+)/);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age <= 7) return 45;
      if (age <= 9) return 60;
      if (age <= 11) return 75;
      if (age <= 13) return 90;
      return 90;
    }
    return 60;
  }, []);

  // Get section options for match day - reusing existing logic
  const getSectionOptions = useCallback((teamName) => {
    const isUnder6or7 = teamName.includes('Under 6') || teamName.includes('Under 7');
    const isUnder8or9 = teamName.includes('Under 8') || teamName.includes('Under 9');
    const isUnder10to13 = teamName.includes('Under 10') || teamName.includes('Under 11') || 
                          teamName.includes('Under 12') || teamName.includes('Under 13');
    const isUnder14Plus = teamName.includes('Under 14') || teamName.includes('Under 15') || 
                         teamName.includes('Under 16');
    
    if (isUnder6or7) {
      const options = sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
      if (showGrassArea[pitchId]) {
        options.push({ value: 'grass', label: 'Grass Area' });
      }
      return options;
    }
    
    if (isUnder8or9) {
      return [
        { value: 'A+C', label: 'A + C (Left Column, Top and Bottom)' },
        { value: 'B+D', label: 'B + D (Right Column, Top and Bottom)' },
        { value: 'E+G', label: 'E + G (Left Column, Middle Sections)' },
        { value: 'F+H', label: 'F + H (Right Column, Middle Sections)' }
      ];
    }
    
    if (isUnder10to13) {
      return [
        { value: 'A+B+C+D', label: 'A + B + C + D (Top Half)' },
        { value: 'C+D+E+F', label: 'C + D + E + F (Middle Band)' },
        { value: 'E+F+G+H', label: 'E + F + G + H (Bottom Half)' }
      ];
    }
    
    if (isUnder14Plus) {
      return [{ value: 'ALL', label: 'All 8 Sections (Whole Pitch)' }];
    }
    
    return sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
  }, [showGrassArea, pitchId]);

  // Get sections to allocate - reusing existing logic
  const getSectionsToAllocate = useCallback((teamName, selectedLayout) => {
    const pitchAreaReq = matchDayPitchAreaRequired[teamName] || getDefaultPitchAreaForTeam(teamName);
    
    switch (pitchAreaReq) {
      case 'Under 6 & 7':
        return [selectedLayout];
        
      case 'Under 8 & 9':
        const under8Options = {
          'A+C': ['A', 'C'],
          'B+D': ['B', 'D'], 
          'E+G': ['E', 'G'],
          'F+H': ['F', 'H']
        };
        return under8Options[selectedLayout] || ['A', 'C'];
        
      case 'Under 10-13':
        const under10Options = {
          'A+B+C+D': ['A', 'B', 'C', 'D'],
          'C+D+E+F': ['C', 'D', 'E', 'F'],
          'E+F+G+H': ['E', 'F', 'G', 'H']
        };
        return under10Options[selectedLayout] || ['A', 'B', 'C', 'D'];
        
      case 'Under 14+':
        return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        
      default:
        return [selectedLayout];
    }
  }, [matchDayPitchAreaRequired, getDefaultPitchAreaForTeam]);

  // Load user and club data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.clubId) {
              setClubInfo({
                clubId: userData.clubId,
                name: userData.clubName || 'Unknown Club'
              });
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load settings and allocations when club info is available
  useEffect(() => {
    if (!clubInfo?.clubId) return;

    const loadSettings = async () => {
      try {
        const settingsRef = doc(db, 'clubs', clubInfo.clubId, 'settings', 'general');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.teams) setTeams(data.teams);
          if (data.pitchNames) setPitchNames(data.pitchNames);
          if (data.showGrassArea) setShowGrassArea(data.showGrassArea);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [clubInfo?.clubId]);

  // Set default team when teams load
  useEffect(() => {
    if (teams.length > 0 && !team) {
      setTeam(teams[0].name);
    }
  }, [teams, team]);

  // Load allocations for current date and pitch
  useEffect(() => {
    if (!clubInfo?.clubId || !date || !pitchId) return;

    const loadAllocations = () => {
      try {
        // Load from both training and match allocations
        const trainingRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
        const matchRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);

        const unsubscribeTraining = onSnapshot(trainingRef, (doc) => {
          const trainingData = doc.exists() ? doc.data() : {};
          
          onSnapshot(matchRef, (matchDoc) => {
            const matchData = matchDoc.exists() ? matchDoc.data() : {};
            
            // Combine allocations and filter by pitch
            const combined = { ...trainingData, ...matchData };
            const filtered = {};
            
            Object.entries(combined).forEach(([key, value]) => {
              if (key.includes(pitchId) && typeof value === 'object' && value.pitch === pitchId) {
                filtered[key] = value;
              }
            });
            
            setAllocations(filtered);
          });
        });

        return unsubscribeTraining;
      } catch (error) {
        console.error('Error loading allocations:', error);
      }
    };

    const unsubscribe = loadAllocations();
    return () => unsubscribe && unsubscribe();
  }, [clubInfo?.clubId, date, pitchId]);

  // Conflict checking - following existing allocator pattern
  const hasConflict = useMemo(() => {
    const slotsNeeded = duration / 15; // 15-minute intervals
    const startSlotIndex = slots.indexOf(slot);
    
    if (startSlotIndex + slotsNeeded > slots.length) {
      return true;
    }

    const sectionsToCheck = allocationType === 'training' 
      ? [section] 
      : getSectionsToAllocate(team, sectionGroup);
    
    for (let i = 0; i < slotsNeeded; i++) {
      const checkSlot = slots[startSlotIndex + i];
      for (const sectionToCheck of sectionsToCheck) {
        const checkKey = `${date}-${checkSlot}-${pitchId}-${sectionToCheck}`;
        if (allocations[checkKey]) {
          return true;
        }
      }
    }
    
    return false;
  }, [allocations, date, slot, pitchId, section, sectionGroup, duration, slots, allocationType, team, getSectionsToAllocate]);

  // Add allocation - following existing allocator pattern
  const addAllocation = async () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || !clubInfo?.clubId) return;

    const slotsNeeded = duration / 15;
    const startSlotIndex = slots.indexOf(slot);
    const actualDuration = allocationType === 'game' ? getMatchDayDuration(team) : duration;
    
    const sectionsToAllocate = allocationType === 'training' 
      ? [section] 
      : getSectionsToAllocate(team, sectionGroup);

    const updated = { ...allocations };
    
    for (let i = 0; i < slotsNeeded; i++) {
      const currentSlot = slots[startSlotIndex + i];
      
      for (const sectionToAllocate of sectionsToAllocate) {
        const key = `${date}-${currentSlot}-${pitchId}-${sectionToAllocate}`;
        updated[key] = {
          team: selectedTeam.name,
          teamName: selectedTeam.name,
          colour: selectedTeam.color,
          color: selectedTeam.color,
          duration: actualDuration,
          isMultiSlot: slotsNeeded > 1,
          slotIndex: i,
          totalSlots: slotsNeeded,
          startTime: slot,
          endTime: slots[startSlotIndex + slotsNeeded - 1],
          pitch: pitchId,
          section: sectionToAllocate,
          date: date,
          type: allocationType,
          clubId: clubInfo.clubId,
          created: Date.now(),
          createdBy: user.email
        };
      }
    }

    try {
      const collectionName = allocationType === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${date}`);
      await setDoc(docRef, updated, { merge: true });
      setAllocations(updated);
    } catch (error) {
      console.error('Error saving allocation:', error);
    }
  };

  // Clear allocation - following existing allocator pattern
  const clearAllocation = async (key) => {
    const allocation = allocations[key];
    if (!allocation) return;

    const updated = { ...allocations };

    if (allocation.isMultiSlot) {
      const startSlotIndex = slots.indexOf(allocation.startTime);
      for (let i = 0; i < allocation.totalSlots; i++) {
        const slotToRemove = slots[startSlotIndex + i];
        const keyToRemove = `${allocation.date}-${slotToRemove}-${allocation.pitch}-${allocation.section}`;
        delete updated[keyToRemove];
      }
    } else {
      delete updated[key];
    }

    try {
      const collectionName = allocation.type === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${allocation.date}`);
      await setDoc(docRef, updated, { merge: true });
      setAllocations(updated);
    } catch (error) {
      console.error('Error deleting allocation:', error);
    }
  };

  // Handle team change for match day
  const handleTeamChange = (newTeam) => {
    setTeam(newTeam);
    if (allocationType === 'game') {
      const options = getSectionOptions(newTeam);
      setSectionGroup(options[0]?.value || 'A');
      setDuration(getMatchDayDuration(newTeam));
    }
  };

  // Handle allocation type change
  const handleAllocationTypeChange = (type) => {
    setAllocationType(type);
    if (type === 'game' && team) {
      const options = getSectionOptions(team);
      setSectionGroup(options[0]?.value || 'A');
      setDuration(getMatchDayDuration(team));
    } else if (type === 'training') {
      setDuration(30);
      setSection('A');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  const currentPitchName = pitchNames[pitchId] || `Pitch ${pitchId}`;

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
              {currentPitchName} Allocator
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              marginTop: '4px'
            }}>
              Training & Match Day Scheduling
            </p>
          </div>
          <button
            onClick={() => navigate('/club-pitch-map')}
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
            ← Back to Overview
          </button>
        </div>

        {/* Add New Allocation Form */}
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
            Add New Allocation
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Date */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Time */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Start Time
              </label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {slots.map(timeSlot => (
                  <option key={timeSlot} value={timeSlot}>{timeSlot}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Type
              </label>
              <select
                value={allocationType}
                onChange={(e) => handleAllocationTypeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="training">Training</option>
                <option value="game">Game</option>
              </select>
            </div>

            {/* Team */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Team
              </label>
              <select
                value={team}
                onChange={(e) => handleTeamChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {teams.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="180"
                step="15"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                disabled={allocationType === 'game'}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: allocationType === 'game' ? '#f9fafb' : 'white'
                }}
              />
            </div>

            {/* Section Selection */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                {allocationType === 'training' ? 'Section' : 'Layout'}
              </label>
              {allocationType === 'training' ? (
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  {sections.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                  {showGrassArea[pitchId] && (
                    <option value="grass">Grass Area</option>
                  )}
                </select>
              ) : (
                <select
                  value={sectionGroup}
                  onChange={(e) => setSectionGroup(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  {team && getSectionOptions(team).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={addAllocation}
            disabled={hasConflict || !team}
            style={{
              padding: '12px 24px',
              backgroundColor: hasConflict || !team ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: hasConflict || !team ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            {hasConflict ? 'Time Conflict' : `Add ${allocationType === 'training' ? 'Training' : 'Game'}`}
          </button>

          {hasConflict && (
            <p style={{
              color: '#ef4444',
              fontSize: '14px',
              marginTop: '8px'
            }}>
              This time slot conflicts with an existing allocation
            </p>
          )}
        </div>

        {/* Pitch Visual with Allocations */}
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
              {currentPitchName} - {new Date(date).toLocaleDateString()}
            </h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {slots.map(timeSlot => (
                  <option key={timeSlot} value={timeSlot}>View {timeSlot}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#6b7280', margin: '0', fontSize: '14px' }}>
              Click on any allocation to delete it instantly. Training sessions show in blue, games show in red. Currently viewing: <strong>{slot}</strong>
            </p>
          </div>

          {/* Pitch Layout */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            {/* Main Pitch Sections */}
            <div style={{
              position: 'relative',
              width: '280px',
              height: '400px',
              margin: '0 auto',
              backgroundColor: '#bbf7d0',
              border: '4px solid white',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Soccer field markings */}
              <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none'
              }}>
                {/* Center circle */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '80px',
                  height: '80px',
                  border: '2px solid white',
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)'
                }}></div>
                {/* Center line */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: '2px',
                  background: 'white',
                  transform: 'translateY(-50%)'
                }}></div>
                {/* Goal areas */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '16px',
                  width: '96px',
                  height: '56px',
                  border: '2px solid white',
                  borderTop: 'none',
                  transform: 'translateX(-50%)'
                }}></div>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '16px',
                  width: '96px',
                  height: '56px',
                  border: '2px solid white',
                  borderBottom: 'none',
                  transform: 'translateX(-50%)'
                }}></div>
                {/* Penalty areas */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '16px',
                  width: '144px',
                  height: '96px',
                  border: '2px solid white',
                  borderTop: 'none',
                  transform: 'translateX(-50%)'
                }}></div>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '16px',
                  width: '144px',
                  height: '96px',
                  border: '2px solid white',
                  borderBottom: 'none',
                  transform: 'translateX(-50%)'
                }}></div>
              </div>

              {/* Section grid overlay */}
              <div style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: 'repeat(4, 1fr)',
                gap: '4px',
                height: '100%',
                padding: '4px',
                zIndex: 10
              }}>
                {sections.map(sec => {
                  const key = `${date}-${slot}-${pitchId}-${sec}`;
                  const allocation = allocations[key];
                  
                  return (
                    <div 
                      key={sec}
                      style={{
                        border: '2px solid rgba(255,255,255,0.5)',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        position: 'relative',
                        padding: '2px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: allocation ? allocation.colour + '90' : 'rgba(255,255,255,0.1)',
                        borderColor: allocation ? allocation.colour : 'rgba(255,255,255,0.5)',
                        color: allocation ? (isLightColor(allocation.colour) ? '#000' : '#fff') : '#374151'
                      }}
                      onClick={() => allocation && clearAllocation(key)}
                      title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Section ${sec} - Available`}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        left: '2px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        opacity: 0.7
                      }}>
                        {sec}
                      </div>
                      
                      {allocation ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          padding: '0 4px'
                        }}>
                          <div style={{ fontSize: '10px', lineHeight: '1.2' }}>
                            {allocation.team}
                          </div>
                          <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>
                            {allocation.type === 'training' ? 'Training' : 'Game'}
                          </div>
                          {allocation.isMultiSlot && (
                            <div style={{ fontSize: '8px', opacity: 0.6, marginTop: '1px' }}>
                              {allocation.duration}min
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: '#9ca3af', fontSize: '10px' }}>Available</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grass Area (if enabled) */}
            {showGrassArea[pitchId] && (
              <div style={{
                width: '280px',
                height: '80px',
                margin: '0 auto',
                backgroundColor: '#bbf7d0',
                border: '4px solid white',
                borderRadius: '8px',
                padding: '8px'
              }}>
                <div style={{
                  height: '100%',
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  backgroundColor: (() => {
                    const grassKey = `${date}-${slot}-${pitchId}-grass`;
                    const allocation = allocations[grassKey];
                    return allocation ? allocation.colour + '90' : 'rgba(255,255,255,0.1)';
                  })(),
                  borderColor: (() => {
                    const grassKey = `${date}-${slot}-${pitchId}-grass`;
                    const allocation = allocations[grassKey];
                    return allocation ? allocation.colour : 'rgba(255,255,255,0.5)';
                  })(),
                  color: (() => {
                    const grassKey = `${date}-${slot}-${pitchId}-grass`;
                    const allocation = allocations[grassKey];
                    return allocation ? (isLightColor(allocation.colour) ? '#000' : '#fff') : '#374151';
                  })()
                }}
                onClick={() => {
                  const grassKey = `${date}-${slot}-${pitchId}-grass`;
                  const allocation = allocations[grassKey];
                  if (allocation) clearAllocation(grassKey);
                }}
                title={(() => {
                  const grassKey = `${date}-${slot}-${pitchId}-grass`;
                  const allocation = allocations[grassKey];
                  return allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : 'Grass Area - Available';
                })()}
                >
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    opacity: 0.75
                  }}>
                    GRASS
                  </div>
                  
                  {(() => {
                    const grassKey = `${date}-${slot}-${pitchId}-grass`;
                    const allocation = allocations[grassKey];
                    return allocation ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        textAlign: 'center',
                        padding: '0 4px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', lineHeight: 1.2 }}>
                          {allocation.team}
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>
                          {allocation.type === 'training' ? 'Training' : 'Game'}
                        </div>
                        {allocation.isMultiSlot && (
                          <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '1px' }}>
                            {allocation.duration}min
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Available</div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedPitchAllocator;
