import React, { useState, useMemo } from "react";

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

const timeSlots = (start = 17, end = 21) => {
  const slots = [];
  for (let h = start; h < end; h++) {
    slots.push(`${h}:00`, `${h}:30`);
  }
  return slots;
};

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

// Menu Component
function Menu({ onNavigate }) {
  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#10b981',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 32px 0'
        }}>PitcHero</h1>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <button
            onClick={() => onNavigate('training')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Training Pitch Allocator
          </button>
          
          <button
            onClick={() => onNavigate('matchday')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#047857'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#059669'}
          >
            Match Day Pitch Allocator
          </button>
          
          <button
            onClick={() => onNavigate('settings')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Training Pitch Allocator Component
function TrainingPitchAllocator({ onBack, teams, pitchOrientations, showGrassArea }) {
  const [allocations, setAllocations] = useState({});
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [team, setTeam] = useState(teams[0].name);
  const [pitch, setPitch] = useState(pitches[0].id);
  const [section, setSection] = useState(sections[0]);
  const [slot, setSlot] = useState(timeSlots()[0]);
  const [duration, setDuration] = useState(30);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryType, setSummaryType] = useState('section');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [manuallyExpandedSlotsTraining, setManuallyExpandedSlotsTraining] = useState(new Set());

  const slots = useMemo(() => timeSlots(), []);

  const hasConflict = useMemo(() => {
    const slotsNeeded = duration / 30;
    const startSlotIndex = slots.indexOf(slot);
    
    if (startSlotIndex + slotsNeeded > slots.length) {
      return true;
    }
    
    for (let i = 0; i < slotsNeeded; i++) {
      const checkSlot = slots[startSlotIndex + i];
      const checkKey = `${date}-${checkSlot}-${pitch}-${section}`;
      if (allocations[checkKey]) {
        return true;
      }
    }
    
    return false;
  }, [allocations, date, slot, pitch, section, duration, slots]);

  const addAllocation = () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict) return;

    const slotsNeeded = duration / 30;
    const startSlotIndex = slots.indexOf(slot);

    const updated = { ...allocations };
    for (let i = 0; i < slotsNeeded; i++) {
      const currentSlot = slots[startSlotIndex + i];
      const key = `${date}-${currentSlot}-${pitch}-${section}`;
      updated[key] = {
        team: selectedTeam.name,
        colour: selectedTeam.color,
        duration: duration,
        isMultiSlot: slotsNeeded > 1,
        slotIndex: i,
        totalSlots: slotsNeeded,
        startTime: slot,
        endTime: slots[startSlotIndex + slotsNeeded - 1],
        pitch: pitch,
        section: section,
        date: date
      };
    }
    setAllocations(updated);
  };

  const hasAllocationsForTimeSlotTraining = (timeSlot) => {
    return pitches.some(pitch => {
      return sections.some(section => {
        const key = `${date}-${timeSlot}-${pitch.id}-${section}`;
        return allocations[key];
      }) || (showGrassArea[pitch.id] && allocations[`${date}-${timeSlot}-${pitch.id}-grass`]);
    });
  };

  const toggleTimeSlotExpansionTraining = (timeSlot) => {
    const newExpanded = new Set(manuallyExpandedSlotsTraining);
    if (newExpanded.has(timeSlot)) {
      newExpanded.delete(timeSlot);
    } else {
      newExpanded.add(timeSlot);
    }
    setManuallyExpandedSlotsTraining(newExpanded);
  };

  const shouldShowTimeSlotExpandedTraining = (timeSlot) => {
    return hasAllocationsForTimeSlotTraining(timeSlot) || manuallyExpandedSlotsTraining.has(timeSlot);
  };

  const clearAllocation = (key) => {
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

    setAllocations(updated);
  };

  const clearAllAllocations = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    setAllocations({});
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
      appVersion: "PitcHero v1.0"
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `training-allocations-${new Date().toISOString().split('T')[0]}.json`;
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
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            if (importData.allocations) {
              setAllocations(importData.allocations);
            } else {
              setAllocations(importData);
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
    if (allocation.duration <= 30) {
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
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
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
            }}>Training Pitch Allocator</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setSummaryType('section');
                setShowSummary(!showSummary);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: showSummary && summaryType === 'section' ? '#047857' : '#10b981',
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
                backgroundColor: showSummary && summaryType === 'team' ? '#6d28d9' : '#8b5cf6',
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
                backgroundColor: Object.keys(allocations).length === 0 ? '#9ca3af' : '#06b6d4',
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
              style={{
                padding: '8px 16px',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
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
          }}>Add New Allocation</h2>
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
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
              }}>Time</label>
              <select 
                value={slot} 
                onChange={(e) => setSlot(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                {slots.map((s) => (
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
              }}>Duration</label>
              <select 
                value={duration} 
                onChange={(e) => setDuration(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>120 minutes</option>
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
              }}>Section</label>
              <select 
                value={section} 
                onChange={(e) => setSection(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                {sections.map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
                {showGrassArea[pitch] && (
                  <option value="grass">Grass Area</option>
                )}
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
                onChange={(e) => setTeam(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
              disabled={hasConflict}
              style={{
                padding: '8px 24px',
                backgroundColor: hasConflict ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: hasConflict ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Add Allocation
            </button>
            
            <button 
              onClick={clearAllAllocations}
              disabled={Object.keys(allocations).length === 0}
              style={{
                padding: '8px 24px',
                backgroundColor: Object.keys(allocations).length === 0 ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: Object.keys(allocations).length === 0 ? 'not-allowed' : 'pointer',
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
                ⚠️ Scheduling conflict detected
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
                Clear All Allocations
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '24px',
                margin: '0 0 24px 0'
              }}>
                Are you sure you want to clear all training allocations? This action cannot be undone.
              </p>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={cancelClearAll}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearAll}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Clear All
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
                Training Schedule Summary - {summaryType === 'section' ? 'By Section' : 'By Team'}
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
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No allocations to display</p>
                ) : (
                  Object.entries(generateSectionSummary()).map(([sectionKey, teamsInSection]) => {
                    const [pitchId, sectionName] = sectionKey.split('-');
                    const pitchName = pitches.find(p => p.id === pitchId)?.name || pitchId;
                    
                    return (
                      <div key={sectionKey} style={{
                        marginBottom: '24px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          backgroundColor: '#f3f4f6',
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#1f2937',
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
                              borderBottom: '1px solid #f3f4f6'
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
                                    {formatDate(allocation.date)} • {formatTimeRange(allocation)} • {allocation.duration} minutes
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
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No allocations to display</p>
                ) : (
                  Object.entries(generateTeamSummary()).map(([teamName, allocations]) => {
                    const teamData = teams.find(t => t.name === teamName);
                    const teamColor = teamData?.color || '#6b7280';
                    
                    return (
                      <div key={teamName} style={{
                        marginBottom: '20px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          backgroundColor: '#f3f4f6',
                          padding: '12px 16px',
                          borderBottom: '1px solid #e5e7eb',
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
                            color: '#1f2937',
                            margin: 0
                          }}>
                            {teamName} ({allocations.length} session{allocations.length !== 1 ? 's' : ''})
                          </h3>
                        </div>
                        
                        <div style={{ padding: '12px 16px' }}>
                          {allocations.map((allocation, index) => {
                            const pitchName = pitches.find(p => p.id === allocation.pitch)?.name || allocation.pitch;
                            const sectionDisplay = allocation.section === 'grass' ? 'Grass Area' : `Section ${allocation.section}`;
                            
                            return (
                              <div key={index} style={{
                                padding: '8px 0',
                                borderBottom: index < allocations.length - 1 ? '1px solid #f3f4f6' : 'none',
                                fontSize: '14px',
                                color: '#374151'
                              }}>
                                <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                                  {formatDate(allocation.date)} • {formatTimeRange(allocation)}
                                </div>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                  {pitchName} - {sectionDisplay} • {allocation.duration} minutes
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

        {/* FIXED: Single pitch rendering section - removed duplicate */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          {pitches.map((p) => (
            <div key={p.id} style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden'
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
                  const hasAllocations = hasAllocationsForTimeSlotTraining(s);
                  const isExpanded = shouldShowTimeSlotExpandedTraining(s);
                  const isManuallyExpanded = manuallyExpandedSlotsTraining.has(s);
                  
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
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: !hasAllocations ? 'pointer' : 'default',
                            border: isManuallyExpanded ? '2px solid #3b82f6' : '2px solid transparent',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => !hasAllocations && toggleTimeSlotExpansionTraining(s)}
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
                              
                              {/* Penalty areas */}
                              {pitchOrientations[p.id] === 'portrait' ? (
                                <>
                                  {/* Top penalty area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '25%',
                                    right: '25%',
                                    height: '60px',
                                    border: '2px solid white',
                                    borderTop: 'none'
                                  }}></div>
                                  
                                  {/* Bottom penalty area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    left: '25%',
                                    right: '25%',
                                    height: '60px',
                                    border: '2px solid white',
                                    borderBottom: 'none'
                                  }}></div>
                                </>
                              ) : (
                                <>
                                  {/* Left penalty area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '2px',
                                    top: '25%',
                                    bottom: '25%',
                                    width: '60px',
                                    border: '2px solid white',
                                    borderLeft: 'none'
                                  }}></div>
                                  
                                  {/* Right penalty area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    right: '2px',
                                    top: '25%',
                                    bottom: '25%',
                                    width: '60px',
                                    border: '2px solid white',
                                    borderRight: 'none'
                                  }}></div>
                                </>
                              )}
                              
                              {/* Goal areas */}
                              {pitchOrientations[p.id] === 'portrait' ? (
                                <>
                                  {/* Top goal area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '37.5%',
                                    right: '37.5%',
                                    height: '25px',
                                    border: '2px solid white',
                                    borderTop: 'none'
                                  }}></div>
                                  
                                  {/* Bottom goal area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    left: '37.5%',
                                    right: '37.5%',
                                    height: '25px',
                                    border: '2px solid white',
                                    borderBottom: 'none'
                                  }}></div>
                                </>
                              ) : (
                                <>
                                  {/* Left goal area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '2px',
                                    top: '37.5%',
                                    bottom: '37.5%',
                                    width: '25px',
                                    border: '2px solid white',
                                    borderLeft: 'none'
                                  }}></div>
                                  
                                  {/* Right goal area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    right: '2px',
                                    top: '37.5%',
                                    bottom: '37.5%',
                                    width: '25px',
                                    border: '2px solid white',
                                    borderRight: 'none'
                                  }}></div>
                                </>
                              )}
                              
                              {/* Corner arcs */}
                              {pitchOrientations[p.id] === 'portrait' ? (
                                <>
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
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
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
                                      backgroundColor: alloc ? alloc.colour + '90' : 'rgba(255,255,255,0.1)',
                                      borderColor: alloc ? alloc.colour : 'rgba(255,255,255,0.5)',
                                      color: alloc ? (isLightColor(alloc.colour) ? '#000' : '#fff') : '#374151'
                                    }}
                                    onClick={() => alloc && clearAllocation(key)}
                                    title={alloc ? `${alloc.team} (${alloc.duration}min) - Click to remove` : `Section ${sec} - Available`}
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
                                      {alloc ? alloc.team : ''}
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
                                            cursor: 'pointer',
                                            backgroundColor: alloc ? alloc.colour + '90' : 'rgba(255,255,255,0.1)',
                                            borderColor: alloc ? alloc.colour : 'rgba(255,255,255,0.5)',
                                            color: alloc ? (isLightColor(alloc.colour) ? '#000' : '#fff') : '#374151'
                                          }}
                                          onClick={() => alloc && clearAllocation(key)}
                                          title={alloc ? `${alloc.team} (${alloc.duration}min) - Click to remove` : `Grass Area - Available`}
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
                                            {alloc ? alloc.team : ''}
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
                          
                          {/* Spacer for pitches without grass area to maintain alignment */}
                          {!showGrassArea[p.id] && (
                            <div style={{ 
                              marginTop: '8px',
                              height: '104px',
                              width: pitchOrientations[p.id] === 'portrait' ? '280px' : '400px',
                              margin: '8px auto 0 auto'
                            }}></div>
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

// Match Day Pitch Allocator Component
function MatchDayPitchAllocator({ onBack, teams, pitchOrientations, showGrassArea, matchDayPitchAreaRequired }) {
  const [allocations, setAllocations] = useState({});
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [team, setTeam] = useState(teams[0].name);
  const [pitch, setPitch] = useState(pitches[0].id);
  const [slot, setSlot] = useState(matchDayTimeSlots()[0]);
  const [matchDayLayout, setMatchDayLayout] = useState('A');
  const [manuallyExpandedSlotsMatchDay, setManuallyExpandedSlotsMatchDay] = useState(new Set());

  const slots = useMemo(() => matchDayTimeSlots(), []);

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

  const addAllocation = () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict) return;

    const slotsNeeded = Math.ceil(duration / 15);
    const startSlotIndex = slots.indexOf(slot);

    const updated = { ...allocations };
    
    for (const sectionToAllocate of sectionsToAllocate) {
      for (let i = 0; i < slotsNeeded; i++) {
        const currentSlot = slots[startSlotIndex + i];
        const key = `${date}-${currentSlot}-${pitch}-${sectionToAllocate}`;
        updated[key] = {
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
      }
    }
    setAllocations(updated);
  };

  const clearAllocation = (key) => {
    const allocation = allocations[key];
    if (!allocation) return;

    const updated = { ...allocations };

    if (allocation.isPartOfGroup && allocation.groupSections) {
      const sectionsToRemove = allocation.groupSections;
      const startSlotIndex = slots.indexOf(allocation.startTime);
      
      for (const sectionToRemove of sectionsToRemove) {
        for (let i = 0; i < allocation.totalSlots; i++) {
          const slotToRemove = slots[startSlotIndex + i];
          const keyToRemove = `${allocation.date}-${slotToRemove}-${allocation.pitch}-${sectionToRemove}`;
          delete updated[keyToRemove];
        }
      }
    } else if (allocation.isMultiSlot) {
      const startSlotIndex = slots.indexOf(allocation.startTime);
      
      for (let i = 0; i < allocation.totalSlots; i++) {
        const slotToRemove = slots[startSlotIndex + i];
        const keyToRemove = `${allocation.date}-${slotToRemove}-${allocation.pitch}-${allocation.section}`;
        delete updated[keyToRemove];
      }
    } else {
      delete updated[key];
    }

    setAllocations(updated);
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#fed7aa',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
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
              disabled={hasConflict}
              style={{
                padding: '8px 24px',
                backgroundColor: hasConflict ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: hasConflict ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Add Allocation
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
                              
                              {/* Penalty areas */}
                              {pitchOrientations[p.id] === 'portrait' ? (
                                <>
                                  {/* Top penalty area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '25%',
                                    right: '25%',
                                    height: '60px',
                                    border: '2px solid white',
                                    borderTop: 'none'
                                  }}></div>
                                  
                                  {/* Bottom penalty area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    left: '25%',
                                    right: '25%',
                                    height: '60px',
                                    border: '2px solid white',
                                    borderBottom: 'none'
                                  }}></div>
                                </>
                              ) : (
                                <>
                                  {/* Left penalty area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '2px',
                                    top: '25%',
                                    bottom: '25%',
                                    width: '60px',
                                    border: '2px solid white',
                                    borderLeft: 'none'
                                  }}></div>
                                  
                                  {/* Right penalty area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    right: '2px',
                                    top: '25%',
                                    bottom: '25%',
                                    width: '60px',
                                    border: '2px solid white',
                                    borderRight: 'none'
                                  }}></div>
                                </>
                              )}
                              
                              {/* Goal areas */}
                              {pitchOrientations[p.id] === 'portrait' ? (
                                <>
                                  {/* Top goal area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '37.5%',
                                    right: '37.5%',
                                    height: '25px',
                                    border: '2px solid white',
                                    borderTop: 'none'
                                  }}></div>
                                  
                                  {/* Bottom goal area (Portrait) */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    left: '37.5%',
                                    right: '37.5%',
                                    height: '25px',
                                    border: '2px solid white',
                                    borderBottom: 'none'
                                  }}></div>
                                </>
                              ) : (
                                <>
                                  {/* Left goal area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '2px',
                                    top: '37.5%',
                                    bottom: '37.5%',
                                    width: '25px',
                                    border: '2px solid white',
                                    borderLeft: 'none'
                                  }}></div>
                                  
                                  {/* Right goal area (Landscape) */}
                                  <div style={{
                                    position: 'absolute',
                                    right: '2px',
                                    top: '37.5%',
                                    bottom: '37.5%',
                                    width: '25px',
                                    border: '2px solid white',
                                    borderRight: 'none'
                                  }}></div>
                                </>
                              )}
                              
                              {/* Corner arcs - same for both orientations as they're at corners */}
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
                          
                          {/* Spacer for pitches without grass area to maintain alignment */}
                          {!showGrassArea[p.id] && (
                            <div style={{ 
                              marginTop: '8px',
                              height: '104px',
                              width: pitchOrientations[p.id] === 'portrait' ? '280px' : '400px',
                              margin: '8px auto 0 auto'
                            }}></div>
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

// Settings Component
function Settings({ onBack, teams, addTeam, removeTeam, pitchOrientations, updatePitchOrientation, showGrassArea, updateGrassAreaVisibility, matchDayPitchAreaRequired, updateMatchDayPitchAreaRequired }) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6');

  const handleAddTeam = () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      addTeam({
        name: newTeamName.trim(),
        color: newTeamColor
      });
      setNewTeamName('');
      setNewTeamColor('#3B82F6');
    }
  };

  const generateRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setNewTeamColor(randomColor);
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
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
          }}>Settings</h1>
        </div>
        
        {/* Team Management Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Team Management</h2>
          
          {/* Add New Team */}
          <div style={{
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Add New Team</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '12px',
              alignItems: 'end'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
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
                }}>Color</label>
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              
              <button
                onClick={generateRandomColor}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                Random Color
              </button>
              
              <button
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: newTeamName.trim() ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newTeamName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Add Team
              </button>
            </div>
          </div>
          
          {/* Current Teams List */}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Current Teams ({teams.length})</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px'
            }}>
              {teams.map((team) => {
                const isDefaultTeam = defaultTeams.some(dt => dt.name === team.name);
                return (
                  <div key={team.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          backgroundColor: team.color,
                          border: '1px solid #d1d5db'
                        }}
                      ></div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>{team.name}</span>
                    </div>
                    
                    {!isDefaultTeam && (
                      <button
                        onClick={() => removeTeam(team.name)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Pitch Configuration Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Pitch Configuration</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {pitches.map((pitch) => (
              <div key={pitch.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fafafa'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>{pitch.name}</h3>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Orientation</label>
                  
                  <div style={{
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="portrait"
                        checked={pitchOrientations[pitch.id] === 'portrait'}
                        onChange={() => updatePitchOrientation(pitch.id, 'portrait')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Portrait</span>
                    </label>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="landscape"
                        checked={pitchOrientations[pitch.id] === 'landscape'}
                        onChange={() => updatePitchOrientation(pitch.id, 'landscape')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Landscape</span>
                    </label>
                  </div>
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Grass Area</label>
                  
                  {pitch.hasGrassArea ? (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={showGrassArea[pitch.id]}
                        onChange={(e) => updateGrassAreaVisibility(pitch.id, e.target.checked)}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Show grass area</span>
                    </label>
                  ) : (
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Not available for this pitch type
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Match Day Settings Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Match Day Settings</h2>
          
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            Configure pitch area requirements for each team's match day allocations.
          </p>
          
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#0c4a6e'
          }}>
            <strong>Match Day Auto-Allocation Rules:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Under 6 & 7:</strong> Any single section or grass area for 50 minutes (books 60 min)</li>
              <li><strong>Under 8 & 9:</strong> 2 vertical sections for 50 minutes (books 60 min)</li>
              <li><strong>Under 10-13:</strong> 4 sections (half pitch) for 60 minutes (books 60 min)</li>
              <li><strong>Under 14+:</strong> Full pitch (8 sections) for 80 minutes (books 90 min)</li>
            </ul>
          </div>
          
          {teams.map((team) => (
            <div key={team.name} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: team.color,
                  border: '1px solid #d1d5db'
                }}
              ></div>
              
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {team.name}
              </div>
              
              <select 
                value={matchDayPitchAreaRequired[team.name] || getDefaultPitchAreaForTeam(team.name)} 
                onChange={(e) => updateMatchDayPitchAreaRequired(team.name, e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="Under 6 & 7">Under 6 & 7</option>
                <option value="Under 8 & 9">Under 8 & 9</option>
                <option value="Under 10-13">Under 10-13</option>
                <option value="Under 14+">Under 14+</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [currentPage, setCurrentPage] = useState('menu');
  const [teams, setTeams] = useState(defaultTeams);
  const [pitchOrientations, setPitchOrientations] = useState({
    'pitch1': 'portrait',
    'pitch2': 'portrait'
  });
  const [showGrassArea, setShowGrassArea] = useState({
    'pitch1': false,
    'pitch2': true
  });
  const [matchDayPitchAreaRequired, setMatchDayPitchAreaRequired] = useState(() => {
    const defaults = {};
    defaultTeams.forEach(team => {
      defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
    });
    return defaults;
  });

  const navigate = (page) => {
    setCurrentPage(page);
  };

  const goBackToMenu = () => {
    setCurrentPage('menu');
  };

  const addTeam = (newTeam) => {
    setTeams(prevTeams => [...prevTeams, newTeam]);
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [newTeam.name]: getDefaultPitchAreaForTeam(newTeam.name)
    }));
  };

  const removeTeam = (teamName) => {
    setTeams(prevTeams => prevTeams.filter(team => team.name !== teamName));
    setMatchDayPitchAreaRequired(prev => {
      const updated = { ...prev };
      delete updated[teamName];
      return updated;
    });
  };

  const updatePitchOrientation = (pitchId, orientation) => {
    setPitchOrientations(prev => ({
      ...prev,
      [pitchId]: orientation
    }));
  };

  const updateGrassAreaVisibility = (pitchId, visible) => {
    setShowGrassArea(prev => ({
      ...prev,
      [pitchId]: visible
    }));
  };

  const updateMatchDayPitchAreaRequired = (teamName, pitchAreaReq) => {
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [teamName]: pitchAreaReq
    }));
  };

  switch (currentPage) {
    case 'training':
      return <TrainingPitchAllocator onBack={goBackToMenu} teams={teams} pitchOrientations={pitchOrientations} showGrassArea={showGrassArea} />;
    case 'matchday':
      return <MatchDayPitchAllocator onBack={goBackToMenu} teams={teams} pitchOrientations={pitchOrientations} showGrassArea={showGrassArea} matchDayPitchAreaRequired={matchDayPitchAreaRequired} />;
    case 'settings':
      return <Settings onBack={goBackToMenu} teams={teams} addTeam={addTeam} removeTeam={removeTeam} pitchOrientations={pitchOrientations} updatePitchOrientation={updatePitchOrientation} showGrassArea={showGrassArea} updateGrassAreaVisibility={updateGrassAreaVisibility} matchDayPitchAreaRequired={matchDayPitchAreaRequired} updateMatchDayPitchAreaRequired={updateMatchDayPitchAreaRequired} />;
    default:
      return <Menu onNavigate={navigate} />;
  }
}