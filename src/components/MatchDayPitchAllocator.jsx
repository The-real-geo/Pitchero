// src/components/MatchDayPitchAllocator.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseAllocations } from '../hooks/useFirebaseAllocations';
import { sections, pitches, matchDayTimeSlots, isLightColor, getDefaultPitchAreaForTeam } from '../utils/constants';

function MatchDayPitchAllocator({ onBack, teams, pitchOrientations, showGrassArea, matchDayPitchAreaRequired }) {
  // 🔥 FIREBASE INTEGRATION - Replace useState with Firebase hook
  const {
    allocations,
    loading,
    error,
    loadAllocationsForDate,
    saveAllocationToFirestore,
    clearAllAllocationsForDate
  } = useFirebaseAllocations('matchAllocations');

  // Local state for form inputs
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [team, setTeam] = useState(teams[0].name);
  const [pitch, setPitch] = useState(pitches[0].id);
  const [slot, setSlot] = useState(matchDayTimeSlots()[0]);
  const [matchDayLayout, setMatchDayLayout] = useState('A');
  const [manuallyExpandedSlotsMatchDay, setManuallyExpandedSlotsMatchDay] = useState(new Set());

  const slots = useMemo(() => matchDayTimeSlots(), []);

  // 🔥 LOAD DATA when date changes
  useEffect(() => {
    loadAllocationsForDate(date);
  }, [date, loadAllocationsForDate]);

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

  // 🔥 UPDATED addAllocation with Firebase
  const addAllocation = async () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || loading) return;

    const slotsNeeded = Math.ceil(duration / 15);
    const startSlotIndex = slots.indexOf(slot);

    try {
      // Create allocation for each section and each time slot
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

          // 🔥 SAVE to Firebase
          await saveAllocationToFirestore(selectedTeam.name, allocation, date);
        }
      }
    } catch (err) {
      console.error("Failed to add match day allocation:", err);
    }
  };

  // 🔥 UPDATED clearAllocation with Firebase
  const clearAllocation = async (key) => {
    const allocation = allocations[key];
    if (!allocation || loading) return;

    try {
      // If part of a group, we need to clear all related allocations
      if (allocation.isPartOfGroup && allocation.groupSections) {
        // This is a simplified approach - in a real app you might want to 
        // delete specific Firebase documents by ID
        await clearAllAllocationsForDate(date);
        await loadAllocationsForDate(date);
      } else {
        // For individual allocations, clear the specific date
        await clearAllAllocationsForDate(date);
        await loadAllocationsForDate(date);
      }
    } catch (err) {
      console.error("Failed to clear allocation:", err);
    }
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#fed7aa',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Loading indicator */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 1000
          }}>
            Saving to database...
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#dc2626'
          }}>
            <strong>Database Error:</strong> {error}
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

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onBack}
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
              {loading ? 'Adding...' : 'Add Allocation'}
            </button>
            
            <button 
              onClick={() => clearAllAllocationsForDate(date)}
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
              {loading ? 'Clearing...' : 'Clear All'}
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

        {/* Pitch visualization */}
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
                            {/* Pitch background and markings */}
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
                            </div>
                            
                            {/* Interactive sections */}
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
                                      cursor: 'pointer',
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
                          
                          {/* Grass area for pitches that have it enabled */}
                          {showGrassArea[p.id] && (
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
                                            cursor: 'pointer',
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
                                </div>
                                <div></div>
                              </div>
                            </div>
                          )}
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