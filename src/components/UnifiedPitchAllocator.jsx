// src/components/UnifiedPitchAllocator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Simulated Firebase imports - replace with actual imports in your project
const auth = { currentUser: { uid: 'demo-user', email: 'admin@demo.com' } };
const db = {};

// Simulated Firebase functions
const onAuthStateChanged = (auth, callback) => {
  setTimeout(() => callback({ uid: 'demo-user', email: 'admin@demo.com' }), 100);
  return () => {};
};
const signOut = async () => console.log('Signing out...');
const doc = () => ({});
const getDoc = async () => ({ exists: () => true, data: () => ({}) });
const setDoc = async () => console.log('Saving to Firebase...');
const deleteDoc = async () => console.log('Deleting from Firebase...');

// Simulated router hooks
const useParams = () => ({ pitchId: '1' });
const useNavigate = () => (path) => console.log(`Navigating to: ${path}`);

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
  const [userRole, setUserRole] = useState('admin'); // Demo as admin
  const [clubInfo, setClubInfo] = useState({ clubId: 'demo-club', name: 'Demo Football Club' });
  const [teams, setTeams] = useState([
    { name: 'Under 8 Lions', color: '#3b82f6' },
    { name: 'Under 10 Tigers', color: '#ef4444' },
    { name: 'Under 12 Eagles', color: '#10b981' },
    { name: 'Under 14 Panthers', color: '#f59e0b' }
  ]);
  const [pitchNames, setPitchNames] = useState({ pitch1: 'Main Pitch', pitch2: 'Training Ground' });
  const [showGrassArea, setShowGrassArea] = useState({ pitch1: true });
  
  // Allocation state
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [deletingAllocation, setDeletingAllocation] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState(new Set());
  
  // Form state - following existing allocator patterns
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [allocationType, setAllocationType] = useState('training');
  const [team, setTeam] = useState('Under 8 Lions');
  const [section, setSection] = useState('A');
  const [sectionGroup, setSectionGroup] = useState('A');
  const [slot, setSlot] = useState('08:00');
  const [duration, setDuration] = useState(30);

  // Menu and UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState({});
  const [viewFilter, setViewFilter] = useState('all'); // 'all', 'training', 'matches'
  
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

  // Filter allocations based on current view
  const filteredAllocations = useMemo(() => {
    if (viewFilter === 'all') return allocations;
    
    const filtered = {};
    Object.entries(allocations).forEach(([key, allocation]) => {
      if (viewFilter === 'training' && allocation.type === 'training') {
        filtered[key] = allocation;
      } else if (viewFilter === 'matches' && allocation.type === 'game') {
        filtered[key] = allocation;
      }
    });
    return filtered;
  }, [allocations, viewFilter]);

  // Initialize demo user on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
      setMenuOpen(false);
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
            sectionGroup: allocationType === 'game' ? sectionGroup : null,
            date: date,
            type: allocationType,
            clubId: clubInfo.clubId,
            created: Date.now(),
            createdBy: user.email
          };
        }
      }

      console.log('Adding allocations:', newAllocations);

      // Update local state immediately
      setAllocations(prev => ({
        ...prev,
        ...newAllocations
      }));

      // Simulate Firebase save
      await setDoc();
      
      console.log('Allocations saved successfully');
    } catch (error) {
      console.error('Error saving allocation:', error);
      alert(`Failed to save allocation: ${error.message}`);
    } finally {
      setSavingAllocation(false);
    }
  };

  // Clear allocation with optimistic updates
  const clearAllocation = async (key) => {
    if (userRole !== 'admin') {
      alert('Only administrators can remove allocations');
      return;
    }

    const allocation = allocations[key];
    if (!allocation || !clubInfo?.clubId) return;

    if (deletingKeys.has(key)) {
      console.log('Already deleting this allocation, skipping duplicate request');
      return;
    }

    try {
      const keysToRemove = [];
      
      if (allocation.isMultiSlot) {
        const startSlotIndex = slots.indexOf(allocation.startTime);
        for (let i = 0; i < allocation.totalSlots; i++) {
          const slotToRemove = slots[startSlotIndex + i];
          
          if (allocation.type === 'game') {
            let sectionsToRemove;
            if (allocation.sectionGroup) {
              sectionsToRemove = getSectionsToAllocate(allocation.team, allocation.sectionGroup);
            } else {
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

      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.add(k));
        return newSet;
      });

      // Update local state immediately
      setAllocations(prev => {
        const updated = { ...prev };
        keysToRemove.forEach(keyToRemove => {
          delete updated[keyToRemove];
        });
        return updated;
      });

      // Simulate Firebase delete
      await deleteDoc();
      
      console.log('Allocation removed successfully');

      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.delete(k));
        return newSet;
      });

    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert(`Failed to remove allocation: ${error.message}`);
      setDeletingKeys(new Set());
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

    setDeletingAllocation(true);

    try {
      setAllocations({});
      await deleteDoc();
      alert('All allocations cleared successfully');
    } catch (error) {
      console.error('Error clearing allocations:', error);
      alert(`Failed to clear allocations: ${error.message}`);
    } finally {
      setDeletingAllocation(false);
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
      const shareId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const link = `${window.location.origin}/share/${shareId}`;
      setShareLink(link);
      setShowShareDialog(true);
      
      console.log(`Share link created with ${Object.keys(allocations).length} allocations`);
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
                navigator.clipboard?.writeText(shareLink);
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
                  cursor: allocation && userRole === 'admin' && !isDeleting ? 'pointer' : 'default',
                  backgroundColor: allocation ? (allocation.colour || allocation.color) + '90' : 'rgba(255,255,255,0.1)',
                  borderColor: allocation ? (allocation.colour || allocation.color) : 'rgba(255,255,255,0.5)',
                  color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151',
                  opacity: isDeleting ? 0.5 : 1,
                  pointerEvents: isDeleting ? 'none' : 'auto'
                }}
                onClick={() => allocation && userRole === 'admin' && !isDeleting && clearAllocation(key)}
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
      display: 'grid',
      justifyItems: 'center',
      alignContent: 'start',
      padding: '24px'
    }}>
      <div style={{ 
        width: 'min(1400px, 100%)',
        marginInline: 'auto',
        flex: '0 0 auto'
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
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                Back to Overview
              </button>

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
                        {clubInfo?.name || 'Loading Club...'}
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
                        ⚽ Choose Another Pitch
                      </button>
                    </div>
                    
                    {/* Action Buttons */}
                    {isAdmin && (
                      <div style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                        <button
                          onClick={() => {
                            alert('Export feature would download allocation data');
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
                            alert('Import feature would allow uploading allocation data');
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
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  height: '42px'
                }}
              >
                Previous Day
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
                Next Day
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
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
              
              {isAdmin && (
                <>
                  <button
                    onClick={clearAllAllocations}
                    disabled={deletingAllocation}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: deletingAllocation ? '#9ca3af' : '#fee2e2',
                      color: deletingAllocation ? 'white' : '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: deletingAllocation ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      height: '42px',
                      opacity: deletingAllocation ? 0.6 : 1
                    }}
                  >
                    {deletingAllocation ? 'Clearing...' : 'Clear All'}
                  </button>
                  
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
                      fontWeight: '600',
                      height: '42px'
                    }}
                  >
                    {savingAllocation ? 'Saving...' : hasConflict ? 'Time Conflict' : `Add ${allocationType === 'training' ? 'Training' : 'Match'}`}
                  </button>
                </>
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

            {hasConflict && (
              <p style={{
                color: '#ef4444',
                fontSize: '14px',
                marginTop: '8px',
                textAlign: 'center'
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
            <div style={{ textAlign: 'left' }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                {currentPitchName}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '4px 0 0 0'
              }}>
                {new Date(date).toLocaleDateString()}
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              {/* Filter Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
                  </svg>
                  Filter
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
                    minWidth: '160px',
                    zIndex: 1000
                  }}>
                    <button
                      onClick={() => {
                        setAllSlotsExpanded(true);
                        setFilterMenuOpen(false);
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
                        borderRadius: '8px 8px 0 0'
                      }}
                    >
                      Expand All
                    </button>
                    
                    <button
                      onClick={() => {
                        setAllSlotsExpanded(false);
                        setFilterMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        color: '#374151',
                        border: 'none',
                        borderTop: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        textAlign: 'left'
                      }}
                    >
                      Collapse All
                    </button>
                    
                    <div style={{ borderTop: '1px solid #e5e7eb' }}>
                      <button
                        onClick={() => {
                          setViewFilter('all');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: viewFilter === 'all' ? '#e0f2fe' : 'white',
                          color: viewFilter === 'all' ? '#0369a1' : '#374151',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left'
                        }}
                      >
                        Show All
                      </button>
                      
                      <button
                        onClick={() => {
                          setViewFilter('training');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: viewFilter === 'training' ? '#dbeafe' : 'white',
                          color: viewFilter === 'training' ? '#1e40af' : '#374151',
                          border: 'none',
                          borderTop: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left'
                        }}
                      >
                        Training Only
                      </button>
                      
                      <button
                        onClick={() => {
                          setViewFilter('matches');
                          setFilterMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          backgroundColor: viewFilter === 'matches' ? '#fef2f2' : 'white',
                          color: viewFilter === 'matches' ? '#dc2626' : '#374151',
                          border: 'none',
                          borderTop: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          textAlign: 'left',
                          borderRadius: '0 0 8px 8px'
                        }}
                      >
                        Matches Only
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Demo note */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#92400e'
          }}>
            <strong>Demo Mode:</strong> This is a demonstration of the updated layout. In the real application, allocations would be loaded from Firebase and changes would be saved automatically.
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            width: '100%'
          }}>
            {slots.slice(0, 6).map(timeSlot => {
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
                                  backgroundColor: 'rgba(255,255,255,0.1)',
                                  borderColor: 'rgba(255,255,255,0.5)',
                                  color: '#374151'
                                }}
                                title="Grass Area - Available"
                              >
                                <div style={{
                                  fontSize: '12px',
                                  opacity: 0.75,
                                  marginBottom: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  GRASS
                                </div>
                              </div>
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
