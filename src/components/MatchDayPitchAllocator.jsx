import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseAllocations } from '../hooks/useFirebaseAllocations';
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];
const pitches = [
  { id: "pitch2", name: "Pitch 2 - Grass", hasGrassArea: true },
  { id: "pitch1", name: "Pitch 1 - Astro", hasGrassArea: false }
];

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

const matchDayTimeSlots = (start = 8, end = 21) => {
  const slots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const minutes = m.toString().padStart(2, '0');
      slots.push(`${h}:${minutes}`);
    }
  }
  slots.push(`${end}:00`);
  return slots;
};

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

function getDefaultPitchAreaForTeam(teamName) {
  if (teamName.includes('Under 6') || teamName.includes('Under 7')) {
    return 'Under 6 & 7';
  } else if (teamName.includes('Under 8') || teamName.includes('Under 9')) {
    return 'Under 8 & 9';
  } else if (teamName.includes('Under 10') || teamName.includes('Under 11') || teamName.includes('Under 12') || teamName.includes('Under 13')) {
    return 'Under 10-13';
  } else if (teamName.includes('Under 14') || teamName.includes('Under 15') || teamName.includes('Under 16')) {
    return 'Under 14+';
  } else {
    return 'Under 10-13';
  }
}

function MatchDayPitchAllocator({ onBack }) {
  // Firebase integration
  const navigate = useNavigate();
  const {
    allocations,
    loading,
    error,
    userProfile,
    clubInfo,
    loadAllocationsForDate,
    saveAllocationToFirestore,
    clearAllAllocationsForDate,
    deleteAllocationFromFirestore
  } = useFirebaseAllocations('matchAllocations');

  // Auth state
  const [user, setUser] = useState(null);

  // State management
  const [teams] = useState(defaultTeams);
  const [pitchOrientations] = useState({
    'pitch1': 'portrait',
    'pitch2': 'portrait'
  });
  const [showGrassArea] = useState({
    'pitch1': false,
    'pitch2': true
  });
  const [matchDayPitchAreaRequired] = useState(() => {
    const defaults = {};
    defaultTeams.forEach(team => {
      defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
    });
    return defaults;
  });

  // Local state for form inputs
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [team, setTeam] = useState(teams[0].name);
  const [pitch, setPitch] = useState(pitches[0].id);
  const [slot, setSlot] = useState(matchDayTimeSlots()[0]);
  const [matchDayLayout, setMatchDayLayout] = useState('A');
  const [manuallyExpandedSlotsMatchDay, setManuallyExpandedSlotsMatchDay] = useState(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [summaryType, setSummaryType] = useState('section');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const slots = useMemo(() => matchDayTimeSlots(), []);

  // Auth monitoring
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load data when date changes
  useEffect(() => {
    loadAllocationsForDate(date);
  }, [date, loadAllocationsForDate]);

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getMatchDayDuration = (teamName) => {
    const pitchAreaReq = matchDayPitchAreaRequired[teamName] || getDefaultPitchAreaForTeam(teamName);
    switch (pitchAreaReq) {
      case 'Under 6 & 7': return 50;
      case 'Under 8 & 9': return 50;
      case 'Under 10-13': return 60;
      case 'Under 14+': return 80;
      default: return 60;
    }
  };

  const getMatchDayLayoutOptions = (teamName, currentPitch) => {
    const pitchAreaReq = matchDayPitchAreaRequired[teamName] || getDefaultPitchAreaForTeam(teamName);
    
    if (pitchAreaReq === 'Under 6 & 7') {
      const options = sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
      if (showGrassArea[currentPitch]) {
        options.push({ value: 'grass', label: 'Grass Area' });
      }
      return options;
    }
    
    if (pitchAreaReq === 'Under 8 & 9') {
      return [
        { value: 'A+C', label: 'A + C (Left Column, Top and Bottom)' },
        { value: 'B+D', label: 'B + D (Right Column, Top and Bottom)' },
        { value: 'E+G', label: 'E + G (Left Column, Middle Sections)' },
        { value: 'F+H', label: 'F + H (Right Column, Middle Sections)' }
      ];
    }
    
    if (pitchAreaReq === 'Under 10-13') {
      return [
        { value: 'A+B+C+D', label: 'A + B + C + D (Top Half)' },
        { value: 'C+D+E+F', label: 'C + D + E + F (Middle Band)' },
        { value: 'E+F+G+H', label: 'E + F + G + H (Bottom Half)' }
      ];
    }
    
    if (pitchAreaReq === 'Under 14+') {
      return [{ value: 'ALL', label: 'All 8 Sections (Whole Pitch)' }];
    }
    
    return sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
  };

  const getSectionsToAllocate = (teamName, selectedLayout) => {
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
  };

  const hasAllocationsForTimeSlotMatchDay = (timeSlot) => {
    return pitches.some(pitch => {
      return sections.some(section => {
        const key = `${date}-${timeSlot}-${pitch.id}-${section}`;
        return allocations[key];
      }) || (showGrassArea[pitch.id] && allocations[`${date}-${timeSlot}-${pitch.id}-grass`]);
    });
  };

  const toggleTimeSlotExpansionMatchDay = (timeSlot) => {
    const newExpanded = new Set(manuallyExpandedSlotsMatchDay);
    if (newExpanded.has(timeSlot)) {
      newExpanded.delete(timeSlot);
    } else {
      newExpanded.add(timeSlot);
    }
    setManuallyExpandedSlotsMatchDay(newExpanded);
  };

  const shouldShowTimeSlotExpandedMatchDay = (timeSlot) => {
    return hasAllocationsForTimeSlotMatchDay(timeSlot) || manuallyExpandedSlotsMatchDay.has(timeSlot);
  };

  const duration = getMatchDayDuration(team);
  const sectionsToAllocate = getSectionsToAllocate(team, matchDayLayout);

  const handleTeamChange = (newTeam) => {
    setTeam(newTeam);
    const options = getMatchDayLayoutOptions(newTeam, pitch);
    setMatchDayLayout(options[0]?.value || 'A');
  };

  const hasConflict = useMemo(() => {
    const slotsNeeded = Math.ceil(duration / 15);
    const startSlotIndex = slots.indexOf(slot);
    
    if (startSlotIndex + slotsNeeded > slots.length) {
      return true;
    }
    
    for (const sectionToCheck of sectionsToAllocate) {
      for (let i = 0; i < slotsNeeded; i++) {
        const checkSlot = slots[startSlotIndex + i];
        const checkKey = `${date}-${checkSlot}-${pitch}-${sectionToCheck}`;
        if (allocations[checkKey]) {
          return true;
        }
      }
    }
    
    return false;
  }, [allocations, date, slot, pitch, duration, slots, sectionsToAllocate]);

  // Add allocation with Firebase - creates separate entries for each section and time slot
  const addAllocation = async () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || loading) return;

    const slotsNeeded = Math.ceil(duration / 15);
    const startSlotIndex = slots.indexOf(slot);

    try {
      // Create allocations for each section and each time slot
      for (const sectionToAllocate of sectionsToAllocate) {
        for (let i = 0; i < slotsNeeded; i++) {        
          const currentSlot = slots[startSlotIndex + i];
          const allocation = {
            team: selectedTeam.name,
            colour: selectedTeam.color,
            duration: duration,
            isMultiSlot: slotsNeeded > 1,
            slotIndex: i,
            totalSlots: slotsNeeded,
            startTime: slot,
            endTime: slots[startSlotIndex + slotsNeeded - 1],
            pitch: pitch,
            section: sectionToAllocate,
            date: date,
            isPartOfGroup: sectionsToAllocate.length > 1,
            groupSections: sectionsToAllocate
          };

          await saveAllocationToFirestore(selectedTeam.name, allocation, date);
        }
      }
    } catch (err) {
      console.error("Failed to add match day allocation:", err);
    }
  };

  // Enhanced clear allocation function for multi-section bookings
  const clearAllocation = async (key) => {
    const allocation = allocations[key];
    if (!allocation || loading) return;

    try {
      if (!allocation.id) {
        console.error("No ID found for allocation:", allocation);
        return;
      }

      // If this allocation is part of a multi-section group, remove all sections in the group
      if (allocation.isPartOfGroup && allocation.groupSections) {
        const relatedAllocations = [];
        
        // Find all allocations that are part of the same booking
        allocation.groupSections.forEach(sectionName => {
          const relatedKey = `${allocation.date}-${allocation.startTime}-${allocation.pitch}-${sectionName}`;
          const relatedAlloc = allocations[relatedKey];
          if (relatedAlloc && relatedAlloc.id) {
            relatedAllocations.push(relatedAlloc);
          }
        });

        // Also check for multi-slot allocations (different time slots for the same booking)
        if (allocation.isMultiSlot && allocation.totalSlots > 1) {
          const slotsNeeded = allocation.totalSlots;
          const startSlotIndex = slots.indexOf(allocation.startTime);
          
          for (let i = 0; i < slotsNeeded; i++) {
            const slotTime = slots[startSlotIndex + i];
            allocation.groupSections.forEach(sectionName => {
              const multiSlotKey = `${allocation.date}-${slotTime}-${allocation.pitch}-${sectionName}`;
              const multiSlotAlloc = allocations[multiSlotKey];
              if (multiSlotAlloc && multiSlotAlloc.id && !relatedAllocations.some(ra => ra.id === multiSlotAlloc.id)) {
                relatedAllocations.push(multiSlotAlloc);
              }
            });
          }
        }

        // Delete all related allocations
        console.log(`Deleting ${relatedAllocations.length} related allocations for ${allocation.team}`);
        for (const relatedAlloc of relatedAllocations) {
          await deleteAllocationFromFirestore(relatedAlloc.id, relatedAlloc.date);
        }
      } else {
        // Single section allocation or handle multi-slot single section
        if (allocation.isMultiSlot && allocation.totalSlots > 1) {
          const slotsNeeded = allocation.totalSlots;
          const startSlotIndex = slots.indexOf(allocation.startTime);
          
          for (let i = 0; i < slotsNeeded; i++) {
            const slotTime = slots[startSlotIndex + i];
            const multiSlotKey = `${allocation.date}-${slotTime}-${allocation.pitch}-${allocation.section}`;
            const multiSlotAlloc = allocations[multiSlotKey];
            if (multiSlotAlloc && multiSlotAlloc.id) {
              await deleteAllocationFromFirestore(multiSlotAlloc.id, multiSlotAlloc.date);
            }
          }
        } else {
          // Simple single allocation
          await deleteAllocationFromFirestore(allocation.id, allocation.date);
        }
      }
    } catch (error) {
      console.error('Error clearing allocation:', error);
    }
  };

  const clearAllAllocations = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    if (loading) return;
    await clearAllAllocationsForDate(date);
    setShowClearConfirm(false);
  };

  const cancelClearAll = () => {
    setShowClearConfirm(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const exportData = {
      allocations: allocations,
      exportDate: new Date().toISOString(),
      appVersion: "PitcHero Match Day v1.0"
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `match-allocations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            const allocationsToImport = importData.allocations || importData;
            
            // Import each allocation to Firebase
            for (const [allocation] of Object.entries(allocationsToImport)) {
              await saveAllocationToFirestore(allocation.team, allocation, allocation.date);
            }
          } catch (error) {
            console.error('Error importing file:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const generateSectionSummary = () => {
    const summary = {};
    const uniqueAllocations = {};
    
    Object.entries(allocations).forEach(([key, allocation]) => {
      const uniqueKey = `${allocation.date}-${allocation.startTime}-${allocation.pitch}-${allocation.section}-${allocation.team}`;
      if (!uniqueAllocations[uniqueKey]) {
        uniqueAllocations[uniqueKey] = allocation;
      }
    });
    
    Object.values(uniqueAllocations).forEach(allocation => {
      const sectionKey = `${allocation.pitch}-${allocation.section}`;
      const teamKey = allocation.team;
      
      if (!summary[sectionKey]) {
        summary[sectionKey] = {};
      }
      if (!summary[sectionKey][teamKey]) {
        summary[sectionKey][teamKey] = [];
      }
      
      summary[sectionKey][teamKey].push(allocation);
    });
    
    Object.keys(summary).forEach(sectionKey => {
      Object.keys(summary[sectionKey]).forEach(teamKey => {
        summary[sectionKey][teamKey].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.startTime.localeCompare(b.startTime);
        });
      });
    });
    
    return summary;
  };

  const generateTeamSummary = () => {
    const summary = {};
    const uniqueAllocations = {};
    
    Object.entries(allocations).forEach(([key, allocation]) => {
      const uniqueKey = `${allocation.date}-${allocation.startTime}-${allocation.pitch}-${allocation.section}-${allocation.team}`;
      if (!uniqueAllocations[uniqueKey]) {
        uniqueAllocations[uniqueKey] = allocation;
      }
    });
    
    Object.values(uniqueAllocations).forEach(allocation => {
      const teamKey = allocation.team;
      
      if (!summary[teamKey]) {
        summary[teamKey] = [];
      }
      
      summary[teamKey].push(allocation);
    });
    
    Object.keys(summary).forEach(teamKey => {
      summary[teamKey].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });
    });
    
    return summary;
  };

  const formatTimeRange = (allocation) => {
    if (allocation.duration <= 15) {
      return allocation.startTime;
    } else {
      const endTime = allocation.endTime;
      return `${allocation.startTime} - ${endTime}`;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#059669',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      width: '100vw',
      position: 'absolute',
      top: 0,
      left: 0,
      margin: 0,
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate("/menu")}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back to Menu
            </button>
            <h1 style={{
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>Match Day Pitch Allocator</h1>
          </div>

          {/* Status indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px'
          }}>
            {user && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {clubInfo && (
                  <div style={{
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    🏢 {clubInfo.name}
                  </div>
                )}
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  👤 {user.email} ({userProfile?.role || 'loading...'})
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Logout
                </button>
              </div>
            )}
            {loading && (
              <div style={{
                padding: '6px 12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                💾 Saving...
              </div>
            )}
            <div style={{
              padding: '6px 12px',
              backgroundColor: '#ea580c',
              color: 'white',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              📊 {Object.keys(allocations).length} Match Allocations
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            color: '#dc2626'
          }}>
            <strong>⚠️ Database Error:</strong> {error}
            <button
              onClick={() => loadAllocationsForDate(date)}
              style={{
                marginLeft: '12px',
                padding: '4px 8px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Instructions for removing allocations */}
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '1px solid #6ee7b7',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '14px',
          color: '#047857'
        }}>
          <strong>💡 Tip:</strong> Click on any colored section in the pitch layout below to remove that specific match allocation. Multi-slot and multi-section bookings will be completely removed when you click on any part of them.
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button 
            onClick={() => {
              setSummaryType('section');
              setShowSummary(!showSummary);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: showSummary && summaryType === 'section' ? '#c2410c' : '#ea580c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Summary by Section
          </button>
          
          <button 
            onClick={() => {
              setSummaryType('team');
              setShowSummary(!showSummary);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: showSummary && summaryType === 'team' ? '#9333ea' : '#a855f7',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Summary by Team
          </button>

          <button 
            onClick={handleExport}
            disabled={Object.keys(allocations).length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: Object.keys(allocations).length === 0 ? '#9ca3af' : '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: Object.keys(allocations).length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📤 Export
          </button>

          <button 
            onClick={handleImport}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#9ca3af' : '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📥 Import
          </button>

          <button 
            onClick={handlePrint}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            title="Print or save as PDF (Ctrl+P / Cmd+P as backup)"
          >
            🖨️ Print PDF
          </button>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '32px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#374151'
          }}>Add New Match Day Allocation</h2>
          
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#0c4a6e'
          }}>
            <strong>Match Duration:</strong> {duration} minutes 
            <br />
            <strong>Time Slots Booked:</strong> {Math.ceil(duration / 15) * 15} minutes ({Math.ceil(duration / 15)} x 15-min slots)
            <br />
            <strong>Pitch Area:</strong> {matchDayPitchAreaRequired[team] || getDefaultPitchAreaForTeam(team)}
            <br />
            <strong>Layout sections:</strong> {sectionsToAllocate.join(', ')}
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  opacity: loading ? 0.6 : 1
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>Time (8:00 - 21:00)</label>
              <select 
                value={slot} 
                onChange={(e) => setSlot(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {slots.filter(s => s !== '21:00').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>Pitch</label>
              <select 
                value={pitch} 
                onChange={(e) => setPitch(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {pitches.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>Match Day Layouts</label>
              <select 
                value={matchDayLayout} 
                onChange={(e) => setMatchDayLayout(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {getMatchDayLayoutOptions(team, pitch).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>Team</label>
              <select 
                value={team} 
                onChange={(e) => handleTeamChange(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {teams.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <button 
              onClick={addAllocation}
              disabled={hasConflict || loading}
              style={{
                padding: '8px 24px',
                backgroundColor: (hasConflict || loading) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (hasConflict || loading) ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? '💾 Adding...' : 'Add Match Allocation'}
            </button>
            
            <button 
              onClick={clearAllAllocations}
              disabled={loading || Object.keys(allocations).length === 0}
              style={{
                padding: '8px 24px',
                backgroundColor: (loading || Object.keys(allocations).length === 0) ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (loading || Object.keys(allocations).length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Clear All
            </button>
            
            {hasConflict && (
              <div style={{
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                ⚠️ Scheduling conflict detected for {duration}-minute match (books {Math.ceil(duration / 15) * 15} min) across sections: {sectionsToAllocate.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
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
              padding: '32px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px',
                margin: '0 0 16px 0'
              }}>
                Clear All Match Day Allocations
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '24px',
                margin: '0 0 24px 0'
              }}>
                Are you sure you want to clear all match day allocations for <strong>{new Date(date).toLocaleDateString()}</strong>? 
                This will permanently delete the allocations from the database.
              </p>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={cancelClearAll}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearAll}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: loading ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {loading ? 'Clearing...' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Display */}
        {showSummary && (
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '32px'
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
                color: '#374151',
                margin: 0
              }}>
                Match Day Schedule Summary - {summaryType === 'section' ? 'By Section' : 'By Team'}
              </h2>
              <button
                onClick={() => setShowSummary(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Close Summary
              </button>
            </div>
            
            {summaryType === 'section' ? (
              <div>
                {Object.entries(generateSectionSummary()).length === 0 ? (
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No match allocations to display</p>
                ) : (
                  Object.entries(generateSectionSummary()).map(([sectionKey, teamsInSection]) => {
                    const [pitchId, sectionName] = sectionKey.split('-');
                    const pitchName = pitches.find(p => p.id === pitchId)?.name || pitchId;
                    
                    return (
                      <div key={sectionKey} style={{
                        marginBottom: '24px',
                        border: '1px solid #fed7aa',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          backgroundColor: '#fed7aa',
                          padding: '12px 16px',
                          borderBottom: '1px solid #fb923c'
                        }}>
                          <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#9a3412',
                            margin: 0
                          }}>
                            {pitchName} - {sectionName === 'grass' ? 'Grass Area' : `Section ${sectionName}`}
                          </h3>
                        </div>
                        
                        {Object.entries(teamsInSection).map(([teamName, allocations]) => {
                          const teamData = teams.find(t => t.name === teamName);
                          const teamColor = teamData?.color || '#6b7280';
                          
                          return (
                            <div key={teamName} style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid #fef3c7'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '8px'
                              }}>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  backgroundColor: teamColor,
                                  borderRadius: '2px'
                                }}></div>
                                <span style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#374151'
                                }}>{teamName}</span>
                              </div>
                              
                              <div style={{
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: '#6b7280'
                              }}>
                                {allocations.map((allocation, index) => (
                                  <div key={index} style={{ marginBottom: '4px' }}>
                                    {formatDate(allocation.date)} • {formatTimeRange(allocation)} • {allocation.duration} minutes match
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                {Object.entries(generateTeamSummary()).length === 0 ? (
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No match allocations to display</p>
                ) : (
                  Object.entries(generateTeamSummary()).map(([teamName, allocations]) => {
                    const teamData = teams.find(t => t.name === teamName);
                    const teamColor = teamData?.color || '#6b7280';
                    
                    return (
                      <div key={teamName} style={{
                        marginBottom: '20px',
                        border: '1px solid #fed7aa',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          backgroundColor: '#fed7aa',
                          padding: '12px 16px',
                          borderBottom: '1px solid #fb923c',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: teamColor,
                            borderRadius: '3px'
                          }}></div>
                          <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#9a3412',
                            margin: 0
                          }}>
                            {teamName} ({allocations.length} match{allocations.length !== 1 ? 'es' : ''})
                          </h3>
                        </div>
                        
                        <div style={{ padding: '12px 16px' }}>
                          {allocations.map((allocation, index) => {
                            const pitchName = pitches.find(p => p.id === allocation.pitch)?.name || allocation.pitch;
                            const sectionDisplay = allocation.section === 'grass' ? 'Grass Area' : `Section ${allocation.section}`;
                            
                            return (
                              <div key={index} style={{
                                padding: '8px 0',
                                borderBottom: index < allocations.length - 1 ? '1px solid #fef3c7' : 'none',
                                fontSize: '14px',
                                color: '#374151'
                              }}>
                                <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                                  {formatDate(allocation.date)} • {formatTimeRange(allocation)}
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                  {pitchName} - {sectionDisplay} • {allocation.duration} minute match
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Visual Pitch Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          alignItems: 'start'
        }}>
          {pitches.map((p) => (
            <div key={p.id} style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              height: 'fit-content'
            }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '8px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  margin: 0
                }}>{p.name}</h2>
              </div>
              
              <div style={{ padding: '4px' }}>
                {slots.map((s) => {
                  const hasAllocations = hasAllocationsForTimeSlotMatchDay(s);
                  const isExpanded = shouldShowTimeSlotExpandedMatchDay(s);
                  const isManuallyExpanded = manuallyExpandedSlotsMatchDay.has(s);
                  
                  return (
                    <div key={s} style={{ marginBottom: '8px' }}>
                      <h3 style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span 
                          style={{
                            backgroundColor: '#fed7aa',
                            color: '#9a3412',
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: !hasAllocations ? 'pointer' : 'default',
                            border: isManuallyExpanded ? '2px solid #f59e0b' : '2px solid transparent',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => !hasAllocations && toggleTimeSlotExpansionMatchDay(s)}
                          title={!hasAllocations ? 'Click to expand/collapse this time slot' : s}
                        >
                          {s} {!hasAllocations && (isManuallyExpanded ? '▼' : '▶')}
                        </span>
                      </h3>
                      
                      {isExpanded && (
                        <>
                          <div style={{
                            position: 'relative',
                            backgroundColor: '#dcfce7',
                            border: '4px solid white',
                            borderRadius: '8px',
                            padding: '16px',
                            width: pitchOrientations[p.id] === 'portrait' ? '280px' : '400px',
                            height: pitchOrientations[p.id] === 'portrait' ? '400px' : '280px',
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
                                ...(pitchOrientations[p.id] === 'portrait' ? {
                                  left: '2px',
                                  right: '2px',
                                  top: '50%',
                                  height: '2px',
                                  transform: 'translateY(-50%)'
                                } : {
                                  top: '2px',
                                  bottom: '2px',
                                  left: '50%',
                                  width: '2px',
                                  transform: 'translateX(-50%)'
                                }),
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
                              
                              {/* Corner arcs */}
                              {[
                                { top: '0px', left: '0px', borderRadius: '0 0 20px 0', borderTop: 'none', borderLeft: 'none' },
                                { top: '0px', right: '0px', borderRadius: '0 0 0 20px', borderTop: 'none', borderRight: 'none' },
                                { bottom: '0px', left: '0px', borderRadius: '0 20px 0 0', borderBottom: 'none', borderLeft: 'none' },
                                { bottom: '0px', right: '0px', borderRadius: '20px 0 0 0', borderBottom: 'none', borderRight: 'none' }
                              ].map((corner, i) => (
                                <div key={i} style={{
                                  position: 'absolute',
                                  ...corner,
                                  width: '20px',
                                  height: '20px',
                                  border: '2px solid white'
                                }}></div>
                              ))}
                            </div>
                            
                            <div style={{
                              position: 'relative',
                              display: 'grid',
                              gridTemplateColumns: pitchOrientations[p.id] === 'portrait' ? '1fr 1fr' : 'repeat(4, 1fr)',
                              gridTemplateRows: pitchOrientations[p.id] === 'portrait' ? 'repeat(4, 1fr)' : '1fr 1fr',
                              gap: '4px',
                              height: '100%',
                              zIndex: 10
                            }}>
                              {sections.map((sec) => {
                                const key = `${date}-${s}-${p.id}-${sec}`;
                                const alloc = allocations[key];
                                const isPreviewSection = sectionsToAllocate.includes(sec) && p.id === pitch;
                                
                                return (
                                  <div 
                                    key={sec} 
                                    style={{
                                      border: isPreviewSection && !alloc ? '3px solid #f59e0b' : '2px solid rgba(255,255,255,0.5)',
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
                                      cursor: alloc ? 'pointer' : 'default',
                                      backgroundColor: alloc ? alloc.colour + '90' : (isPreviewSection ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)'),
                                      borderColor: alloc ? alloc.colour : (isPreviewSection ? '#f59e0b' : 'rgba(255,255,255,0.5)'),
                                      color: alloc ? (isLightColor(alloc.colour) ? '#000' : '#fff') : '#374151'
                                    }}
                                    onClick={() => alloc && clearAllocation(key)}
                                    title={alloc ? `${alloc.team} (${alloc.duration}min match, books ${Math.ceil(alloc.duration / 15) * 15}min) - Click to remove` : (isPreviewSection ? `Will be allocated for ${team}` : `Section ${sec} - Available`)}
                                  >
                                    <div style={{
                                      fontSize: '12px',
                                      opacity: 0.75,
                                      marginBottom: '4px',
                                      fontWeight: 'bold'
                                    }}>{sec}</div>
                                    <div style={{
                                      textAlign: 'center',
                                      padding: '0 4px',
                                      fontSize: '12px',
                                      lineHeight: 1.2
                                    }}>
                                      {alloc ? alloc.team : (isPreviewSection ? 'SELECTED' : '')}
                                    </div>
                                    {alloc && alloc.isMultiSlot && (
                                      <div style={{
                                        fontSize: '12px',
                                        opacity: 0.6,
                                        marginTop: '4px'
                                      }}>
                                        {Math.ceil(alloc.duration / 15) * 15}min
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Grass area space - always rendered for alignment */}
                          <div style={{ marginTop: '8px' }}>
                            <div style={{
                              position: 'relative',
                              width: pitchOrientations[p.id] === 'portrait' ? '280px' : '400px',
                              margin: '0 auto',
                              display: 'grid',
                              gridTemplateColumns: pitchOrientations[p.id] === 'portrait' ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
                              gap: '4px',
                              height: '104px'
                            }}>
                              <div style={{
                                position: 'relative',
                                backgroundColor: showGrassArea[p.id] ? '#dcfce7' : 'white',
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
                                  backgroundColor: showGrassArea[p.id] ? '#bbf7d0' : 'white',
                                  borderRadius: '8px'
                                }}></div>
                                
                                {showGrassArea[p.id] && (
                                  <div style={{ position: 'relative', zIndex: 10, height: '100%' }}>
                                    {(() => {
                                      const key = `${date}-${s}-${p.id}-grass`;
                                      const alloc = allocations[key];
                                      const isPreviewGrass = sectionsToAllocate.includes('grass') && p.id === pitch;
                                      return (
                                        <div 
                                          style={{
                                            height: '100%',
                                            border: isPreviewGrass && !alloc ? '3px solid #f59e0b' : '2px solid rgba(255,255,255,0.5)',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s',
                                            cursor: alloc ? 'pointer' : 'default',
                                            backgroundColor: alloc ? alloc.colour + '90' : (isPreviewGrass ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)'),
                                            borderColor: alloc ? alloc.colour : (isPreviewGrass ? '#f59e0b' : 'rgba(255,255,255,0.5)'),
                                            color: alloc ? (isLightColor(alloc.colour) ? '#000' : '#fff') : '#374151'
                                          }}
                                          onClick={() => alloc && clearAllocation(key)}
                                          title={alloc ? `${alloc.team} (${alloc.duration}min match, books ${Math.ceil(alloc.duration / 15) * 15}min) - Click to remove` : (isPreviewGrass ? `Will be allocated for ${team}` : `Grass Area - Available`)}
                                        >
                                          <div style={{
                                            fontSize: '12px',
                                            opacity: 0.75,
                                            marginBottom: '4px',
                                            fontWeight: 'bold'
                                          }}>GRASS</div>
                                          <div style={{
                                            textAlign: 'center',
                                            padding: '0 4px',
                                            fontSize: '12px',
                                            lineHeight: 1.2
                                          }}>
                                            {alloc ? alloc.team : (isPreviewGrass ? 'SELECTED' : '')}
                                          </div>
                                          {alloc && alloc.isMultiSlot && (
                                            <div style={{
                                              fontSize: '12px',
                                              opacity: 0.6,
                                              marginTop: '4px'
                                            }}>
                                              {alloc.duration}min
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                              <div></div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MatchDayPitchAllocator;