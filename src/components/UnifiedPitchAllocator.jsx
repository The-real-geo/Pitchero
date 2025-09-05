// src/components/UnifiedPitchAllocator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

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
  const [userRole, setUserRole] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [pitchNames, setPitchNames] = useState({});
  const [showGrassArea, setShowGrassArea] = useState({});
  
  // Allocation state
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingAllocation, setSavingAllocation] = useState(false);
  
  // Form state - following existing allocator patterns
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [allocationType, setAllocationType] = useState('training');
  const [team, setTeam] = useState('');
  const [section, setSection] = useState('A');
  const [sectionGroup, setSectionGroup] = useState('A');
  const [slot, setSlot] = useState('09:00');
  const [duration, setDuration] = useState(30);

  // Menu and UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState({});

  // Time slots - reusing existing pattern
  const slots = useMemo(() => timeSlots(), []);

  // Normalize pitch ID to ensure consistency - MUST BE DEFINED EARLY
  const normalizedPitchId = useMemo(() => {
    // If pitchId is just a number like '1' or '2', convert to 'pitch1' or 'pitch2'
    if (pitchId && !pitchId.startsWith('pitch')) {
      return `pitch${pitchId}`;
    }
    return pitchId;
  }, [pitchId]);

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
      if (showGrassArea[normalizedPitchId]) {
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
  }, [showGrassArea, normalizedPitchId]);

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

  // Count total allocations
  const totalAllocations = useMemo(() => {
    const uniqueAllocations = new Set();
    Object.entries(allocations).forEach(([key, allocation]) => {
      if (allocation.isMultiSlot) {
        // For multi-slot allocations, only count once using startTime
        const uniqueKey = `${allocation.team}-${allocation.startTime}-${allocation.section}`;
        uniqueAllocations.add(uniqueKey);
      } else {
        uniqueAllocations.add(key);
      }
    });
    return uniqueAllocations.size;
  }, [allocations]);

  // Load user and club data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User data loaded:', userData);
            setUserRole(userData.role);
            if (userData.clubId) {
              // Fetch the actual club document to get the club name
              const clubDoc = await getDoc(doc(db, 'clubs', userData.clubId));
              console.log('Club document exists:', clubDoc.exists());
              console.log('Club document ID:', userData.clubId);
              
              if (clubDoc.exists()) {
                const clubData = clubDoc.data();
                console.log('Full club data:', clubData);
                console.log('Club name field:', clubData.name);
                
                // Extract the name with comprehensive fallbacks
                const clubName = clubData.name || 
                               clubData.Name || 
                               clubData.clubName || 
                               clubData.ClubName || 
                               `Club ${userData.clubId}`;
                
                console.log('Extracted club name:', clubName);
                
                setClubInfo({
                  clubId: userData.clubId,
                  name: clubName
                });
              } else {
                console.log('Club document not found for ID:', userData.clubId);
                // Fallback if club document doesn't exist
                setClubInfo({
                  clubId: userData.clubId,
                  name: `Club ${userData.clubId}`
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user/club data:', error);
          console.error('Error details:', error.message);
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
          // Update club name if it exists in settings
          if (data.clubName) {
            setClubInfo(prev => ({
              ...prev,
              name: data.clubName
            }));
          }
          if (data.teams) {
            setTeams(data.teams);
            // Set initial team if teams are loaded
            if (data.teams.length > 0 && !team) {
              setTeam(data.teams[0].name);
            }
          }
          if (data.pitchNames) setPitchNames(data.pitchNames);
          if (data.showGrassArea) setShowGrassArea(data.showGrassArea);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [clubInfo?.clubId, team]);

  // FIXED: Load allocations from Firebase when date, pitch or club changes
  useEffect(() => {
    if (!clubInfo?.clubId || !date || !normalizedPitchId) return;

    const loadAllocations = async () => {
      try {
        console.log('Loading allocations for:', { date, pitchId: normalizedPitchId, clubId: clubInfo.clubId });
        
        // Load both training and match allocations
        const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
        const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
        
        const [trainingDoc, matchDoc] = await Promise.all([
          getDoc(trainingDocRef),
          getDoc(matchDocRef)
        ]);
        
        let combinedAllocations = {};
        
        // Process training allocations
        if (trainingDoc.exists()) {
          const trainingData = trainingDoc.data();
          // Filter for current pitch only
          Object.entries(trainingData).forEach(([key, value]) => {
            if (key.includes(`-${normalizedPitchId}-`) && typeof value === 'object') {
              combinedAllocations[key] = { ...value, type: 'training' };
            }
          });
          console.log('Loaded training allocations:', Object.keys(combinedAllocations).length);
        }
        
        // Process match allocations
        if (matchDoc.exists()) {
          const matchData = matchDoc.data();
          // Filter for current pitch only
          Object.entries(matchData).forEach(([key, value]) => {
            if (key.includes(`-${normalizedPitchId}-`) && typeof value === 'object') {
              combinedAllocations[key] = { ...value, type: 'game' };
            }
          });
          console.log('Loaded match allocations:', Object.keys(combinedAllocations).length);
        }
        
        console.log('Total allocations loaded:', Object.keys(combinedAllocations).length);
        setAllocations(combinedAllocations);
      } catch (error) {
        console.error('Error loading allocations:', error);
        setAllocations({});
      }
    };

    loadAllocations();
  }, [date, normalizedPitchId, clubInfo?.clubId]);

  // Initialize expanded slots on mount
  useEffect(() => {
    const initialExpanded = {};
    slots.forEach(slot => {
      initialExpanded[slot] = true; // Start with all slots expanded
    });
    setExpandedSlots(initialExpanded);
  }, [slots]);

  // Logout handler
  const handleLogout = async () => {
    try {
      setMenuOpen(false); // Close menu before logout
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
        const checkKey = `${date}-${checkSlot}-${normalizedPitchId}-${sectionToCheck}`;
        if (allocations[checkKey]) {
          return true;
        }
      }
    }
    
    return false;
  }, [allocations, date, slot, normalizedPitchId, section, sectionGroup, duration, slots, allocationType, team, getSectionsToAllocate]);

  // Add allocation - following existing allocator pattern
  const addAllocation = async () => {
    // Check if user is admin
    if (userRole !== 'admin') {
      alert('Only administrators can add allocations');
      return;
    }

    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || !clubInfo?.clubId) {
      console.log('Cannot add allocation:', { selectedTeam, hasConflict, clubId: clubInfo?.clubId });
      return;
    }

    setSavingAllocation(true);
    
    try {
      const slotsNeeded = duration / 15;
      const startSlotIndex = slots.indexOf(slot);
      const actualDuration = allocationType === 'game' ? getMatchDayDuration(team) : duration;
      
      const sectionsToAllocate = allocationType === 'training' 
        ? [section] 
        : getSectionsToAllocate(team, sectionGroup);

      // Build the allocation objects
      const newAllocations = {};
      
      for (let i = 0; i < slotsNeeded; i++) {
        const currentSlot = slots[startSlotIndex + i];
        
        for (const sectionToAllocate of sectionsToAllocate) {
          const key = `${date}-${currentSlot}-${normalizedPitchId}-${sectionToAllocate}`;
          newAllocations[key] = {
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
            pitch: normalizedPitchId,
            section: sectionToAllocate,
            date: date,
            type: allocationType,
            clubId: clubInfo.clubId,
            created: Date.now(),
            createdBy: user.email
          };
        }
      }

      console.log('Adding allocations:', newAllocations);

      // Save to Firebase
      const collectionName = allocationType === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${date}`);
      
      // Get existing document to merge with
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.exists() ? existingDoc.data() : {};
      
      // Merge new allocations with existing
      const updatedData = {
        ...existingData,
        ...newAllocations
      };
      
      await setDoc(docRef, updatedData);
      
      // Update local state
      setAllocations(prev => ({
        ...prev,
        ...newAllocations
      }));
      
      console.log('Allocations saved successfully');
    } catch (error) {
      console.error('Error saving allocation:', error);
      alert(`Failed to save allocation: ${error.message}`);
    } finally {
      setSavingAllocation(false);
    }
  };

  // Clear allocation - following existing allocator pattern
  const clearAllocation = async (key) => {
    // Check if user is admin
    if (userRole !== 'admin') {
      alert('Only administrators can remove allocations');
      return;
    }

    const allocation = allocations[key];
    if (!allocation || !clubInfo?.clubId) return;

    try {
      // Determine which slots to remove
      const keysToRemove = [];
      
      if (allocation.isMultiSlot) {
        // Remove all slots for multi-slot allocation
        const startSlotIndex = slots.indexOf(allocation.startTime);
        for (let i = 0; i < allocation.totalSlots; i++) {
          const slotToRemove = slots[startSlotIndex + i];
          
          // If it's a game, might need to remove multiple sections
          if (allocation.type === 'game') {
            const sectionsToRemove = getSectionsToAllocate(allocation.team, allocation.sectionGroup);
            sectionsToRemove.forEach(sec => {
              keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`);
            });
          } else {
            keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${allocation.section}`);
          }
        }
      } else {
        keysToRemove.push(key);
      }

      console.log('Removing keys:', keysToRemove);

      // Get the Firebase document
      const collectionName = allocation.type === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${allocation.date}`);
      const existingDoc = await getDoc(docRef);
      
      if (existingDoc.exists()) {
        const existingData = existingDoc.data();
        
        // Remove the keys
        keysToRemove.forEach(keyToRemove => {
          delete existingData[keyToRemove];
        });
        
        // Save back to Firebase
        await setDoc(docRef, existingData);
        
        // Update local state
        setAllocations(prev => {
          const updated = { ...prev };
          keysToRemove.forEach(keyToRemove => {
            delete updated[keyToRemove];
          });
          return updated;
        });
        
        console.log('Allocation removed successfully');
      }
    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert(`Failed to remove allocation: ${error.message}`);
    }
  };

  // Clear all allocations for the day
  const clearAllAllocations = async () => {
    if (userRole !== 'admin') {
      alert('Only administrators can clear allocations');
      return;
    }

    if (!window.confirm(`Are you sure you want to clear ALL allocations for ${new Date(date).toLocaleDateString()}? This cannot be undone.`)) {
      return;
    }

    try {
      // Clear both training and match allocations
      const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
      
      // Get existing documents
      const [trainingDoc, matchDoc] = await Promise.all([
        getDoc(trainingDocRef),
        getDoc(matchDocRef)
      ]);
      
      // Filter out allocations for this pitch and update
      if (trainingDoc.exists()) {
        const trainingData = trainingDoc.data();
        const filteredData = {};
        Object.entries(trainingData).forEach(([key, value]) => {
          if (!key.includes(`-${normalizedPitchId}-`)) {
            filteredData[key] = value;
          }
        });
        
        if (Object.keys(filteredData).length > 0) {
          await setDoc(trainingDocRef, filteredData);
        } else {
          await deleteDoc(trainingDocRef);
        }
      }
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        const filteredData = {};
        Object.entries(matchData).forEach(([key, value]) => {
          if (!key.includes(`-${normalizedPitchId}-`)) {
            filteredData[key] = value;
          }
        });
        
        if (Object.keys(filteredData).length > 0) {
          await setDoc(matchDocRef, filteredData);
        } else {
          await deleteDoc(matchDocRef);
        }
      }
      
      // Clear local state
      setAllocations({});
      
      alert('All allocations cleared successfully');
    } catch (error) {
      console.error('Error clearing allocations:', error);
      alert(`Failed to clear allocations: ${error.message}`);
    }
  };

  // Export allocations
  const exportAllocations = () => {
    const exportData = {
      club: clubInfo.name,
      date: date,
      pitch: pitchNames[normalizedPitchId] || `Pitch ${pitchId}`,
      allocations: allocations,
      exported: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `allocations_${date}_pitch${pitchId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import allocations
  const importAllocations = async () => {
    if (userRole !== 'admin') {
      alert('Only administrators can import allocations');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.allocations) {
          alert('Invalid import file format');
          return;
        }
        
        if (!window.confirm(`Import allocations from ${data.date}? This will merge with existing allocations.`)) {
          return;
        }
        
        // Save imported allocations
        const trainingAllocations = {};
        const matchAllocations = {};
        
        Object.entries(data.allocations).forEach(([key, allocation]) => {
          if (allocation.type === 'training') {
            trainingAllocations[key] = allocation;
          } else {
            matchAllocations[key] = allocation;
          }
        });
        
        // Save to Firebase
        if (Object.keys(trainingAllocations).length > 0) {
          const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
          const existingDoc = await getDoc(trainingDocRef);
          const existingData = existingDoc.exists() ? existingDoc.data() : {};
          await setDoc(trainingDocRef, { ...existingData, ...trainingAllocations });
        }
        
        if (Object.keys(matchAllocations).length > 0) {
          const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
          const existingDoc = await getDoc(matchDocRef);
          const existingData = existingDoc.exists() ? existingDoc.data() : {};
          await setDoc(matchDocRef, { ...existingData, ...matchAllocations });
        }
        
        // Update local state
        setAllocations(prev => ({ ...prev, ...data.allocations }));
        
        alert('Allocations imported successfully');
      } catch (error) {
        console.error('Error importing allocations:', error);
        alert('Failed to import allocations. Please check the file format.');
      }
    };
    
    input.click();
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

  // Navigate to next/previous day
  const changeDate = (days) => {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() + days);
    setDate(currentDate.toISOString().split('T')[0]);
  };

  // Toggle slot expansion
  const toggleSlotExpanded = (slot) => {
    setExpandedSlots(prev => ({
      ...prev,
      [slot]: !prev[slot]
    }));
  };

  // Expand/Collapse all slots
  const setAllSlotsExpanded = (expanded) => {
    const newExpanded = {};
    slots.forEach(slot => {
      newExpanded[slot] = expanded;
    });
    setExpandedSlots(newExpanded);
  };

  // Render pitch section
  const renderPitchSection = (timeSlot) => {
    return (
      <div style={{
        position: 'relative',
        backgroundColor: '#dcfce7',
        border: '4px solid white',
        borderRadius: '8px',
        padding: '16px',
        width: '280px',
        height: '400px'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#bbf7d0',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Pitch boundary lines */}
          <div style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            right: '2px',
            bottom: '2px',
            border: '2px solid white',
            borderRadius: '4px'
          }}></div>
          
          {/* Center line */}
          <div style={{
            position: 'absolute',
            left: '2px',
            right: '2px',
            top: '50%',
            height: '2px',
            transform: 'translateY(-50%)',
            backgroundColor: 'white'
          }}></div>
          
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
          
          {/* Center spot */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '4px',
            height: '4px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)'
          }}></div>
          
          {/* Top penalty area */}
          <div style={{
            position: 'absolute',
            top: '2px',
            left: '25%',
            right: '25%',
            height: '60px',
            border: '2px solid white',
            borderTop: 'none'
          }}></div>
          
          {/* Bottom penalty area */}
          <div style={{
            position: 'absolute',
            bottom: '2px',
            left: '25%',
            right: '25%',
            height: '60px',
            border: '2px solid white',
            borderBottom: 'none'
          }}></div>
          
          {/* Top goal area */}
          <div style={{
            position: 'absolute',
            top: '2px',
            left: '37.5%',
            right: '37.5%',
            height: '25px',
            border: '2px solid white',
            borderTop: 'none'
          }}></div>
          
          {/* Bottom goal area */}
          <div style={{
            position: 'absolute',
            bottom: '2px',
            left: '37.5%',
            right: '37.5%',
            height: '25px',
            border: '2px solid white',
            borderBottom: 'none'
          }}></div>
          
          {/* Corner arcs */}
          <div style={{
            position: 'absolute',
            top: '0px',
            left: '0px',
            width: '20px',
            height: '20px',
            border: '2px solid white',
            borderRadius: '0 0 20px 0',
            borderTop: 'none',
            borderLeft: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            width: '20px',
            height: '20px',
            border: '2px solid white',
            borderRadius: '0 0 0 20px',
            borderTop: 'none',
            borderRight: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '0px',
            left: '0px',
            width: '20px',
            height: '20px',
            border: '2px solid white',
            borderRadius: '0 20px 0 0',
            borderBottom: 'none',
            borderLeft: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            width: '20px',
            height: '20px',
            border: '2px solid white',
            borderRadius: '20px 0 0 0',
            borderBottom: 'none',
            borderRight: 'none'
          }}></div>
        </div>
        
        <div style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: '4px',
          height: '100%',
          zIndex: 10
        }}>
          {sections.map(sec => {
            const key = `${date}-${timeSlot}-${normalizedPitchId}-${sec}`;
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
                  cursor: allocation && isAdmin ? 'pointer' : 'default',
                  backgroundColor: allocation ? (allocation.colour || allocation.color) + '90' : 'rgba(255,255,255,0.1)',
                  borderColor: allocation ? (allocation.colour || allocation.color) : 'rgba(255,255,255,0.5)',
                  color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151'
                }}
                onClick={() => allocation && isAdmin && clearAllocation(key)}
                title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Section ${sec} - Available`}
              >
                <div style={{
                  fontSize: '12px',
                  opacity: 0.75,
                  marginBottom: '4px',
                  fontWeight: 'bold'
                }}>
                  {sec}
                </div>
                <div style={{
                  textAlign: 'center',
                  padding: '0 4px',
                  fontSize: '12px',
                  lineHeight: 1.2
                }}>
                  {allocation ? allocation.team : ''}
                </div>
                {allocation && allocation.isMultiSlot && (
                  <div style={{
                    fontSize: '12px',
                    opacity: 0.6,
                    marginTop: '4px'
                  }}>
                    {allocation.duration}min
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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

  const currentPitchName = pitchNames[normalizedPitchId] || `Pitch ${pitchId}`;
  const isAdmin = userRole === 'admin';

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Hamburger Menu */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            padding: '10px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151', marginBottom: '4px' }}></div>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151', marginBottom: '4px' }}></div>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151' }}></div>
        </button>
        
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: '50px',
            right: '0',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            minWidth: '200px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              padding: '8px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                🏢 {clubInfo?.name || 'Loading Club...'}
              </div>
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                👤 {user?.email}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Role: {userRole === 'admin' ? 'Administrator' : 'Member'}
              </div>
            </div>
            
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    importAllocations();
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px'
                  }}
                >
                  📥 Import Allocation
                </button>
                
                <button
                  onClick={() => {
                    exportAllocations();
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px'
                  }}
                >
                  📤 Export Allocations
                </button>
              </>
            )}
            
            {/* Logout button */}
            <div style={{
              borderTop: '1px solid #e5e7eb',
              marginTop: '8px',
              paddingTop: '8px'
            }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'white',
                  color: '#dc2626',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header with club info and allocation count */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: '0'
              }}>
                {clubInfo?.name || 'Loading...'}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '4px 0 0 0'
              }}>
                <span style={{
                  padding: '2px 8px',
                  backgroundColor: totalAllocations > 0 ? '#10b981' : '#6b7280',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  📊 {totalAllocations} allocation{totalAllocations !== 1 ? 's' : ''}
                </span>
                <span style={{ marginLeft: '8px' }}>on {currentPitchName}</span>
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
        </div>

        {/* Date navigation and controls */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <button
                onClick={() => changeDate(-1)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                ← Previous Day
              </button>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <span style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
                </span>
              </div>
              
              <button
                onClick={() => changeDate(1)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                Next Day →
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => setAllSlotsExpanded(true)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                Expand All
              </button>
              
              <button
                onClick={() => setAllSlotsExpanded(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                Collapse All
              </button>
              
              {isAdmin && (
                <button
                  onClick={clearAllAllocations}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    height: '42px'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Add New Allocation Form - Only show for admins */}
        {isAdmin && (
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
                  <option value="">Select a team</option>
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
                    {showGrassArea[normalizedPitchId] && (
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
              disabled={hasConflict || !team || savingAllocation}
              style={{
                padding: '12px 24px',
                backgroundColor: hasConflict || !team ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: hasConflict || !team || savingAllocation ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              {savingAllocation ? 'Saving...' : hasConflict ? 'Time Conflict' : `Add ${allocationType === 'training' ? 'Training' : 'Game'}`}
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
        )}

        {/* Time Slots with Pitch Visuals */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '20px'
          }}>
            {currentPitchName} - {new Date(date).toLocaleDateString()}
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {slots.map(timeSlot => {
              const slotAllocations = Object.entries(allocations).filter(([key]) =>
                key.includes(`-${timeSlot}-`)
              );
              const hasAllocations = slotAllocations.length > 0;
              
              return (
                <div key={timeSlot} style={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div
                    onClick={() => toggleSlotExpanded(timeSlot)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{
                        backgroundColor: hasAllocations ? '#dbeafe' : '#f3f4f6',
                        color: hasAllocations ? '#1e40af' : '#6b7280',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        border: '1px solid',
                        borderColor: hasAllocations ? '#93c5fd' : '#e5e7eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: '80px'
                      }}>
                        {timeSlot}
                      </span>
                      {hasAllocations ? (
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          {[...new Set(slotAllocations.map(([, a]) => a.team))].join(', ')}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '14px',
                          color: '#9ca3af'
                        }}>
                          Available
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      transform: expandedSlots[timeSlot] ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▼
                    </div>
                  </div>
                  
                  {expandedSlots[timeSlot] && (
                    <div style={{
                      padding: '16px',
                      borderTop: '1px solid #e5e7eb',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {renderPitchSection(timeSlot)}
                      
                      {/* Grass area for pitches that have it enabled */}
                      {showGrassArea[normalizedPitchId] && (
                        <div style={{
                          width: '280px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '4px',
                          height: '104px'
                        }}>
                          <div style={{
                            position: 'relative',
                            backgroundColor: '#dcfce7',
                            border: '4px solid white',
                            borderRadius: '8px',
                            padding: '8px'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: '#bbf7d0',
                              borderRadius: '8px'
                            }}></div>
                            
                            <div style={{ position: 'relative', zIndex: 10, height: '100%' }}>
                              {(() => {
                                const key = `${date}-${timeSlot}-${normalizedPitchId}-grass`;
                                const allocation = allocations[key];
                                return (
                                  <div 
                                    style={{
                                      height: '100%',
                                      border: '2px solid white',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      transition: 'all 0.2s',
                                      cursor: allocation && isAdmin ? 'pointer' : 'default',
                                      backgroundColor: allocation ? (allocation.colour || allocation.color) + '90' : 'rgba(255,255,255,0.1)',
                                      borderColor: allocation ? (allocation.colour || allocation.color) : 'rgba(255,255,255,0.5)',
                                      color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151'
                                    }}
                                    onClick={() => allocation && isAdmin && clearAllocation(key)}
                                    title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Grass Area - Available`}
                                  >
                                    <div style={{
                                      fontSize: '12px',
                                      opacity: 0.75,
                                      marginBottom: '4px',
                                      fontWeight: 'bold'
                                    }}>
                                      GRASS
                                    </div>
                                    <div style={{
                                      textAlign: 'center',
                                      padding: '0 4px',
                                      fontSize: '12px',
                                      lineHeight: 1.2
                                    }}>
                                      {allocation ? allocation.team : ''}
                                    </div>
                                    {allocation && allocation.isMultiSlot && (
                                      <div style={{
                                        fontSize: '12px',
                                        opacity: 0.6',
                                        marginTop: '4px'
                                      }}>
                                        {allocation.duration}min
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div></div>
                        </div>
                      )}
                      
                      {/* Spacer for pitches without grass area */}
                      {!showGrassArea[normalizedPitchId] && (
                        <div style={{ 
                          height: '104px',
                          width: '280px'
                        }}></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedPitchAllocator;
