import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseAllocations } from '../hooks/useFirebaseAllocations';
import { sections, pitches, timeSlots, isLightColor } from '../utils/constants';

function TrainingPitchAllocator({ onBack, teams, pitchOrientations, showGrassArea }) {
  // 🔥 REPLACE useState with Firebase hook
  const {
    allocations,
    loading,
    error,
    loadAllocationsForDate,
    saveAllocationToFirestore,
    clearAllAllocationsForDate
  } = useFirebaseAllocations('trainingAllocations');

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [team, setTeam] = useState(teams[0].name);
  const [pitch, setPitch] = useState(pitches[0].id);
  const [section, setSection] = useState(sections[0]);
  const [slot, setSlot] = useState(timeSlots()[0]);
  const [duration, setDuration] = useState(30);

  // 🔥 LOAD DATA when date changes
  useEffect(() => {
    loadAllocationsForDate(date);
  }, [date, loadAllocationsForDate]);

  // 🔥 UPDATED addAllocation function
  const addAllocation = async () => {
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || loading) return;

    const slotsNeeded = duration / 30;
    const startSlotIndex = slots.indexOf(slot);

    // Create allocation object
    const allocation = {
      team: selectedTeam.name,
      colour: selectedTeam.color,
      duration: duration,
      isMultiSlot: slotsNeeded > 1,
      totalSlots: slotsNeeded,
      startTime: slot,
      endTime: slots[startSlotIndex + slotsNeeded - 1],
      pitch: pitch,
      section: section,
      date: date
    };

    // 🔥 SAVE to Firebase instead of local state
    await saveAllocationToFirestore(selectedTeam.name, allocation, date);
  };

  // 🔥 UPDATED clear function
  const clearAllAllocations = async () => {
    if (loading) return;
    await clearAllAllocationsForDate(date);
  };

  // ... rest of your existing JSX code
  // Just add loading and error displays:
  
  return (
    <div>
      {/* Add loading indicator */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Saving...
        </div>
      )}
      
      {/* Add error display */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px',
          margin: '16px',
          fontSize: '14px',
          color: '#dc2626'
        }}>
          Error: {error}
        </div>
      )}
      
      {/* Your existing JSX here */}
    </div>
  );
}

export default TrainingPitchAllocator;