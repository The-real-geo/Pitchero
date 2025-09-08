// src/components/UnifiedPitchAllocator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Reusing constants from existing allocators
const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Updated time slots function - 8:00am to 9:30pm
const timeSlots = (start = 8, end = 21.5) => {
  const slots = [];
  for (let h = start; h <= Math.floor(end); h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === Math.floor(end) && m > (end % 1) * 60) break;
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

// Duration options for dropdown
const durationOptions = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 75, label: '75 minutes' },
  { value: 90, label: '90 minutes' },
  { value: 105, label: '105 minutes' },
  { value: 120, label: '120 minutes' },
  { value: 135, label: '135 minutes' },
  { value: 150, label: '150 minutes' },
  { value: 180, label: '180 minutes' }
];

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
  const [deletingAllocation, setDeletingAllocation] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState(new Set());
  
  // Form state - following existing allocator patterns
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [allocationType, setAllocationType] = useState('training');
  const [team, setTeam] = useState('');
  const [section, setSection] = useState('A');
  const [sectionGroup, setSectionGroup] = useState('A');
  const [slot, setSlot] = useState('08:00');
  const [duration, setDuration] = useState(30);

  // Menu and UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState({});
  const [filterType, setFilterType] = useState('all'); // 'all', 'training', 'game'
  
  // Share functionality state
  const [shareLink, setShareLink] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  
  // Time slots - reusing existing pattern
  const slots = useMemo(() => timeSlots(), []);

  // Normalize pitch ID to ensure consistency - MUST BE DEFINED EARLY
  const normalizedPitchId = useMemo(() => {
    if (!pitchId) return '';
    // Ensure consistent format - always 'pitch' + number
    const id = String(pitchId);
    if (!id.startsWith('pitch')) {
      return `pitch${id}`;
    }
    // Also handle cases like 'pitch-10' -> 'pitch10'
    return id.replace('pitch-', 'pitch');
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

  // Filtered allocations based on filter type
  const filteredAllocations = useMemo(() => {
    if (filterType === 'all') return allocations;
    
    const filtered = {};
    Object.entries(allocations).forEach(([key, allocation]) => {
      if (allocation.type === filterType) {
        filtered[key] = allocation;
      }
    });
    return filtered;
  }, [allocations, filterType]);

  // Count total allocations
  const totalAllocations = useMemo(() => {
    const uniqueAllocations = new Set();
    Object.entries(filteredAllocations).forEach(([key, allocation]) => {
      if (allocation.isMultiSlot) {
        // For multi-slot allocations, only count once using startTime
        const uniqueKey = `${allocation.team}-${allocation.startTime}-${allocation.section}`;
        uniqueAllocations.add(uniqueKey);
      } else {
        uniqueAllocations.add(key);
      }
    });
    return uniqueAllocations.size;
  }, [filteredAllocations]);

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

  // Load allocations function
  const loadAllocations = useCallback(async () => {
    if (!clubInfo?.clubId || !date || !normalizedPitchId) return;

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
      }
      
      console.log('Total allocations loaded:', Object.keys(combinedAllocations).length);
      setAllocations(combinedAllocations);
    } catch (error) {
      console.error('Error loading allocations:', error);
      setAllocations({});
    }
  }, [date, normalizedPitchId, clubInfo?.clubId]);

  // Load allocations when date, pitch or club changes
  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

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

  // Add allocation with optimistic updates
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
            sectionGroup: allocationType === 'game' ? sectionGroup : null, // Store the section group for games
            date: date,
            type: allocationType,
            clubId: clubInfo.clubId,
            created: Date.now(),
            createdBy: user.email
          };
        }
      }

      console.log('Adding allocations:', newAllocations);

      // OPTIMISTIC UPDATE - Update local state immediately
      setAllocations(prev => ({
        ...prev,
        ...newAllocations
      }));

      // Save to Firebase
      const collectionName = allocationType === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${date}`);
      
      // Get existing document to merge with
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.exists() ? existingDoc.data() : {};
      
      // If we have many allocations (games), batch them to avoid Firebase limits
      const allocationEntries = Object.entries(newAllocations);
      
      if (allocationEntries.length > 10) {
        // For large updates, batch them in chunks of 10
        console.log(`Batching ${allocationEntries.length} allocations into smaller updates`);
        
        let currentData = { ...existingData };
        const chunkSize = 10;
        
        for (let i = 0; i < allocationEntries.length; i += chunkSize) {
          const chunk = allocationEntries.slice(i, i + chunkSize);
          const chunkObject = Object.fromEntries(chunk);
          
          // Merge this chunk with current data
          currentData = { ...currentData, ...chunkObject };
          
          // Save this batch
          await setDoc(docRef, currentData);
          console.log(`Saved batch ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(allocationEntries.length / chunkSize)}`);
        }
      } else {
        // For small updates, do it all at once
        const updatedData = {
          ...existingData,
          ...newAllocations
        };
        
        await setDoc(docRef, updatedData);
      }
      
      console.log('Allocations saved successfully');
    } catch (error) {
      console.error('Error saving allocation:', error);
      alert(`Failed to save allocation: ${error.message}`);
      // On error, reload to restore correct state
      loadAllocations();
    } finally {
      setSavingAllocation(false);
    }
  };

  // FIXED: Clear allocation with optimistic updates
  const clearAllocation = async (key) => {
    // Check if user is admin
    if (userRole !== 'admin') {
      alert('Only administrators can remove allocations');
      return;
    }

    const allocation = allocations[key];
    if (!allocation || !clubInfo?.clubId) return;

    // Prevent duplicate deletion attempts
    if (deletingKeys.has(key)) {
      console.log('Already deleting this allocation, skipping duplicate request');
      return;
    }

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
            // Use sectionGroup if available, otherwise detect sections to remove
            let sectionsToRemove;
            if (allocation.sectionGroup) {
              sectionsToRemove = getSectionsToAllocate(allocation.team, allocation.sectionGroup);
            } else {
              // Fallback: find all sections with the same team and start time
              sectionsToRemove = [];
              sections.forEach(sec => {
                const checkKey = `${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`;
                if (allocations[checkKey] && allocations[checkKey].team === allocation.team && 
                    allocations[checkKey].startTime === allocation.startTime) {
                  sectionsToRemove.push(sec);
                }
              });
            }
            
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

      // Mark keys as being deleted to prevent duplicate attempts
      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.add(k));
        return newSet;
      });

      // OPTIMISTIC UPDATE - IMMEDIATELY update local state
      setAllocations(prev => {
        const updated = { ...prev };
        keysToRemove.forEach(keyToRemove => {
          delete updated[keyToRemove];
        });
        return updated;
      });

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
        if (Object.keys(existingData).length > 0) {
          await setDoc(docRef, existingData);
        } else {
          // If no data left, delete the document
          await deleteDoc(docRef);
        }
        
        console.log('Allocation removed successfully');
      }

      // Clear deleting keys after successful deletion
      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.delete(k));
        return newSet;
      });

    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert(`Failed to remove allocation: ${error.message}`);
      
      // On error, reload to restore correct state
      await loadAllocations();
      
      // Clear deleting keys on error
      setDeletingKeys(new Set());
    }
  };

  // Clear all allocations for the day with optimistic updates
  const clearAllAllocations = async () => {
    if (userRole !== 'admin') {
      alert('Only administrators can clear allocations');
      return;
    }

    if (!window.confirm(`Are you sure you want to clear ALL allocations for ${new Date(date).toLocaleDateString()}? This cannot be undone.`)) {
      return;
    }

    setDeletingAllocation(true);

    try {
      // OPTIMISTIC UPDATE - Clear local state immediately
      setAllocations({});

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
      
      alert('All allocations cleared successfully');
    } catch (error) {
      console.error('Error clearing allocations:', error);
      alert(`Failed to clear allocations: ${error.message}`);
      // On error, reload to restore correct state
      await loadAllocations();
    } finally {
      setDeletingAllocation(false);
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

  // Share functionality
  const handleShare = async () => {
    try {
      // Load ALL allocations for this date across ALL pitches
      const allPitchAllocations = {};
      
      // We need to load allocations for all possible pitches (pitch1 through pitch10+)
      // First, determine which pitches have allocations
      const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
      
      const [trainingDoc, matchDoc] = await Promise.all([
        getDoc(trainingDocRef),
        getDoc(matchDocRef)
      ]);
      
      // Combine all allocations from both documents
      if (trainingDoc.exists()) {
        const trainingData = trainingDoc.data();
        Object.entries(trainingData).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            allPitchAllocations[key] = { ...value, type: 'training' };
          }
        });
      }
      
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        Object.entries(matchData).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            allPitchAllocations[key] = { ...value, type: 'game' };
          }
        });
      }
      
      // Extract unique pitch IDs from allocations
      const pitchIds = new Set();
      Object.keys(allPitchAllocations).forEach(key => {
        // Key format: "date-time-pitchX-section"
        const parts = key.split('-');
        if (parts.length >= 4) {
          const pitchId = parts[2]; // This will be 'pitch1', 'pitch2', etc.
          pitchIds.add(pitchId);
        }
      });
      
      // Determine allocation type
      const hasTraining = Object.values(allPitchAllocations).some(a => a.type === 'training');
      const hasGame = Object.values(allPitchAllocations).some(a => a.type === 'game');
      let allocationType = 'mixed';
      if (hasTraining && !hasGame) allocationType = 'training';
      if (hasGame && !hasTraining) allocationType = 'match';
      
      // Create share data object with ALL allocations
      const shareData = {
        allocations: allPitchAllocations,
        date: date,
        type: allocationType,
        pitches: Array.from(pitchIds), // List of all pitches with allocations
        pitchNames: pitchNames, // Include pitch names for display
        showGrassArea: showGrassArea, // Include grass area settings
        clubName: clubInfo?.name || 'Unknown Club',
        clubId: clubInfo?.clubId || '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days expiry
        timeRange: {
          start: 8, // Updated to match new time range
          end: 21.5   // 8am to 9:30pm
        }
      };
      
      // Generate unique share ID
      const shareId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Save to Firebase using setDoc directly
      const shareRef = doc(db, 'sharedAllocations', shareId);
      await setDoc(shareRef, shareData);
      
      // Generate the share link
      const link = `${window.location.origin}/share/${shareId}`;
      setShareLink(link);
      setShowShareDialog(true);
      
      console.log(`Share link created with ${Object.keys(allPitchAllocations).length} allocations across ${pitchIds.size} pitch(es)`);
    } catch (error) {
      console.error('Error creating share link:', error);
      alert('Failed to create share link. Please try again.');
    }
  };

  // Share Dialog Component
  const ShareDialog = () => {
    if (!showShareDialog) return null;
    
    return (
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
        zIndex: 1001
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxWidth: '500px',
          width: '90%'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px',
            margin: '0 0 16px 0',
            textAlign: 'center'
          }}>
            Share Pitch Allocation
          </h3>
          
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '16px',
            margin: '0 0 16px 0',
            textAlign: 'center'
          }}>
            Your shareable link has been created! This link will expire in 30 days.
          </p>
          
          <div style={{
            backgroundColor: '#f3f4f6',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            wordBreak: 'break-all',
            fontSize: '14px',
            fontFamily: 'monospace',
            textAlign: 'center'
          }}>
            {shareLink}
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                alert('Link copied to clipboard!');
              }}
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
              Copy Link
            </button>
            
            <button
              onClick={() => {
                window.open(shareLink, '_blank');
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
              Open Link
            </button>
            
            <button
              onClick={() => {
                setShowShareDialog(false);
                setShareLink('');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
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
    );
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
        height: '400px',
        margin: '0 auto'
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
            const allocation = filteredAllocations[key];
            const isDeleting = deletingKeys.has(key);
            
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
                  cursor: allocation && isAdmin && !isDeleting ? 'pointer' : 'default',
                  backgroundColor: allocation ? (allocation.colour || allocation.color) + '90' : 'rgba(255,255,255,0.1)',
                  borderColor: allocation ? (allocation.colour || allocation.color) : 'rgba(255,255,255,0.5)',
                  color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151',
                  opacity: isDeleting ? 0.5 : 1,
                  pointerEvents: isDeleting ? 'none' : 'auto'
                }}
                onClick={() => allocation && isAdmin && !isDeleting && clearAllocation(key)}
                title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Section ${sec} - Available`}
              >
                {/* Type indicator icon */}
                {allocation && (
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '14px',
                    height: '14px',
                    backgroundColor: allocation.type === 'training' ? '#3b82f6' : '#ef4444',
                    color: 'white',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px',
                    zIndex: 20
                  }}>
                    {allocation.type === 'training' ? 'T' : 'M'}
                  </div>
                )}
                
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
                  {allocation ? (isDeleting ? 'Removing...' : allocation.team) : ''}
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
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      display: 'grid',          // grid makes centering reliable
      justifyItems: 'center',   // centers horizontally
      alignContent: 'start',    // keep content top-aligned
      padding: '24px'
    }}>
      <div style={{ 
        width: 'min(1400px, 100%)',  // explicit width so it doesn't flex to full width
        marginInline: 'auto',
        flex: '0 0 auto'              // protects against parent flex layouts
      }}>
        {/* Header with club info and allocation count */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'left' }}>
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
                  {totalAllocations} allocation{totalAllocations !== 1 ? 's' : ''}
                </span>
                <span style={{ marginLeft: '8px' }}>on {currentPitchName}</span>
              </p>
            </div>

            {/* Hamburger Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  padding: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                <div style={{ width: '16px', height: '2px', backgroundColor: '#374151' }}></div>
                <div style={{ width: '16px', height: '2px', backgroundColor: '#374151' }}></div>
                <div style={{ width: '16px', height: '2px', backgroundColor: '#374151' }}></div>
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
                  zIndex: 1000
                }}>
                  {/* User Info Section */}
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                    borderRadius: '8px 8px 0 0'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', color: '#1f2937' }}>
                      🟢 {clubInfo?.name || 'Loading Club...'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '2px' }}>
                      {user?.email}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Role: {userRole === 'admin' ? 'Administrator' : 'Member'}
                    </div>
                  </div>
                  
                  {/* Navigation Buttons */}
                  <div style={{ padding: '8px' }}>
                    <button
                      onClick={() => {
                        navigate('/');
                        setMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      🏠 Back to Main Menu
                    </button>
                    
                    <button
                      onClick={() => {
                        navigate('/club-pitch-map');
                        setMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      📍 Choose Another Pitch
                    </button>
                  </div>
                  
                  {/* Action Buttons */}
                  {isAdmin && (
                    <>
                      <div style={{
                        borderTop: '1px solid #e5e7eb',
                        margin: '0'
                      }}></div>
                      <div style={{ padding: '8px' }}>
                        <button
                          onClick={() => {
                            exportAllocations();
                            setMenuOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: 'white',
                            color: '#374151',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          📤 Export
                        </button>
                        
                        <button
                          onClick={() => {
                            importAllocations();
                            setMenuOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            backgroundColor: 'white',
                            color: '#374151',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          📥 Import
                        </button>
                      </div>
                    </>
                  )}
                  
                  {/* Logout Button - Separated at bottom */}
                  {user && (
                    <>
                      <div style={{
                        borderTop: '1px solid #e5e7eb',
                        margin: '0'
                      }}></div>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: 'white',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '0 0 8px 8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        🚪 Logout
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date navigation and controls */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '16px 24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%'
          }}>
            {/* Previous Day - Left side */}
            <button
              onClick={() => changeDate(-1)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                height: '42px'
              }}
            >
              Previous Day
            </button>
            
            {/* Center content */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
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
              
              {/* Share button moved to center */}
              <button 
                onClick={handleShare}
                disabled={Object.keys(allocations).length === 0 || savingAllocation}
                style={{
                  padding: '10px 16px',
                  backgroundColor: (Object.keys(allocations).length === 0 || savingAllocation) ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (Object.keys(allocations).length === 0 || savingAllocation) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  height: '42px',
                  fontWeight: '500'
                }}
                title="Create a shareable link for this allocation"
              >
                Share
              </button>
            </div>
            
            {/* Next Day - Right side */}
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
              Next Day
            </button>
          </div>
        </div>

        {/* Add New Allocation Form - Only show for admins */}
        {isAdmin && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '20px',
              textAlign: 'center'
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
                  marginBottom: '8px',
                  textAlign: 'center'
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
                  marginBottom: '8px',
                  textAlign: 'center'
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
                  <option value="game">Match</option>
                </select>
              </div>

              {/* Team */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px',
                  textAlign: 'center'
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
                  marginBottom: '8px',
                  textAlign: 'center'
                }}>
                  Duration
                </label>
                <select
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
                >
                  {durationOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px',
                  textAlign: 'center'
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

            {/* Add Button - Now aligned to the right */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px',
              alignItems: 'flex-start' 
            }}>
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
                {savingAllocation ? 'Saving...' : hasConflict ? 'Time Conflict' : `Add ${allocationType === 'training' ? 'Training' : 'Match'}`}
              </button>

              <button
                onClick={clearAllAllocations}
                disabled={deletingAllocation}
                style={{
                  padding: '12px 24px',
                  backgroundColor: deletingAllocation ? '#9ca3af' : '#fee2e2',
                  color: deletingAllocation ? 'white' : '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deletingAllocation ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  opacity: deletingAllocation ? 0.6 : 1
                }}
              >
                {deletingAllocation ? 'Clearing...' : 'Clear All'}
              </button>
            </div>

            {hasConflict && (
              <p style={{
                color: '#ef4444',
                fontSize: '14px',
                marginTop: '8px',
                textAlign: 'right'
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
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            {/* Left-aligned pitch name and date */}
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0,
              textAlign: 'left'
            }}>
              {currentPitchName} - {new Date(date).toLocaleDateString()}
            </h2>
            
            {/* Filter menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {/* Filter icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4.5L6 8.5V14L10 12V8.5L14 4.5V2H2V4.5Z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '14px', color: '#374151' }}>Filter</span>
              </button>
                
                {filterMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: '0',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    minWidth: '180px',
                    zIndex: 1000
                  }}>
                    {/* Expand/Collapse Section */}
                    <div style={{ padding: '8px' }}>
                      <button
                        onClick={() => {
                          setAllSlotsExpanded(true);
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: 'white',
                          color: '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        📂 Expand All
                      </button>
                      
                      <button
                        onClick={() => {
                          setAllSlotsExpanded(false);
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: 'white',
                          color: '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        📁 Collapse All
                      </button>
                    </div>
                    
                    {/* Divider */}
                    <div style={{
                      borderTop: '1px solid #e5e7eb',
                      margin: '0'
                    }}></div>
                    
                    {/* Filter Section */}
                    <div style={{ padding: '8px' }}>
                      <button
                        onClick={() => {
                          setFilterType('all');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: filterType === 'all' ? '#e0f2fe' : 'white',
                          color: filterType === 'all' ? '#0369a1' : '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (filterType !== 'all') {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = filterType === 'all' ? '#e0f2fe' : 'white';
                        }}
                      >
                        🔷 Show All
                      </button>
                      
                      <button
                        onClick={() => {
                          setFilterType('training');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: filterType === 'training' ? '#dbeafe' : 'white',
                          color: filterType === 'training' ? '#1e40af' : '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (filterType !== 'training') {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = filterType === 'training' ? '#dbeafe' : 'white';
                        }}
                      >
                        🏃 Training Only
                      </button>
                      
                      <button
                        onClick={() => {
                          setFilterType('game');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: filterType === 'game' ? '#fee2e2' : 'white',
                          color: filterType === 'game' ? '#991b1b' : '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (filterType !== 'game') {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = filterType === 'game' ? '#fee2e2' : 'white';
                        }}
                      >
                        ⚽ Matches Only
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            width: '100%'
          }}>
            {slots.map(timeSlot => {
              const slotAllocations = Object.entries(filteredAllocations).filter(([key]) =>
                key.includes(`-${timeSlot}-`)
              );
              const hasAllocations = slotAllocations.length > 0;
              
              return (
                <div key={timeSlot} style={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  width: '100%',
                  maxWidth: '600px'
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
                          height: '104px',
                          margin: '0 auto'
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
                                const allocation = filteredAllocations[key];
                                const isDeleting = deletingKeys.has(key);
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
                                      cursor: allocation && isAdmin && !isDeleting ? 'pointer' : 'default',
                                      backgroundColor: allocation ? (allocation.colour || allocation.color) + '90' : 'rgba(255,255,255,0.1)',
                                      borderColor: allocation ? (allocation.colour || allocation.color) : 'rgba(255,255,255,0.5)',
                                      color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151',
                                      opacity: isDeleting ? 0.5 : 1,
                                      pointerEvents: isDeleting ? 'none' : 'auto',
                                      position: 'relative'
                                    }}
                                    onClick={() => allocation && isAdmin && !isDeleting && clearAllocation(key)}
                                    title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Grass Area - Available`}
                                  >
                                    {/* Type indicator icon for grass area */}
                                    {allocation && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        width: '14px',
                                        height: '14px',
                                        backgroundColor: allocation.type === 'training' ? '#3b82f6' : '#ef4444',
                                        color: 'white',
                                        fontSize: '8px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '2px',
                                        zIndex: 20
                                      }}>
                                        {allocation.type === 'training' ? 'T' : 'M'}
                                      </div>
                                    )}
                                    
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
                                      {allocation ? (isDeleting ? 'Removing...' : allocation.team) : ''}
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
                              })()}
                            </div>
                          </div>
                          <div></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Share Dialog */}
      <ShareDialog />
    </div>
  );
};

export default UnifiedPitchAllocator;
