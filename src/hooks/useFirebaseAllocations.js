// src/hooks/useFirebaseAllocations.js
import { useState, useCallback, useEffect } from 'react';
import { loadAllocations, saveAllocation, clearAllAllocations, auth } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useFirebaseAllocations = (allocatorType) => {
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const loadAllocationsForDate = useCallback(async (date) => {
    if (!date || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading ${allocatorType} for ${date}`);
      const data = await loadAllocations(allocatorType, date);
      
      // Convert Firebase data back to UI format
      const allocationsMap = {};
      data.forEach(allocation => {
        if (allocation.isMultiSlot && allocation.totalSlots > 1) {
          const slots = getTimeSlots(allocation.startTime, allocation.totalSlots, allocatorType);
          slots.forEach((timeSlot, index) => {
            const key = `${allocation.date}-${timeSlot}-${allocation.pitch}-${allocation.section}`;
            allocationsMap[key] = { ...allocation, slotIndex: index };
          });
        } else {
          const key = `${allocation.date}-${allocation.startTime}-${allocation.pitch}-${allocation.section}`;
          allocationsMap[key] = allocation;
        }
      });
      
      console.log(`Loaded ${Object.keys(allocationsMap).length} allocation slots`);
      setAllocations(allocationsMap);
    } catch (err) {
      console.error(`Error loading ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, user]);

  const saveAllocationToFirestore = useCallback(async (teamName, allocation, date) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Saving ${allocatorType} for ${teamName}`);
      const allocationWithTeam = { ...allocation, teamName };
      await saveAllocation(allocatorType, allocationWithTeam, date);
      await loadAllocationsForDate(date); // reload after saving
      console.log(`Saved and reloaded ${allocatorType}`);
    } catch (err) {
      console.error(`Error saving ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, loadAllocationsForDate, user]);

  const clearAllAllocationsForDate = useCallback(async (date) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Clearing all ${allocatorType} for ${date}`);
      await clearAllAllocations(allocatorType, date);
      setAllocations({});
      console.log(`Cleared all ${allocatorType} for ${date}`);
    } catch (err) {
      console.error(`Error clearing ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, user]);

  return {
    allocations,
    loading,
    error,
    loadAllocationsForDate,
    saveAllocationToFirestore,
    clearAllAllocationsForDate
  };
};

// Helper function to get time slots for multi-slot allocations
const getTimeSlots = (startTime, totalSlots, allocatorType) => {
  const timeSlots = [];
  const [hour, minute] = startTime.split(':').map(Number);
  const incrementMinutes = allocatorType === 'trainingAllocations' ? 30 : 15;
  
  for (let i = 0; i < totalSlots; i++) {
    const totalMinutes = hour * 60 + minute + (i * incrementMinutes);
    const newHour = Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;
    timeSlots.push(`${newHour}:${newMinute.toString().padStart(2, '0')}`);
  }
  
  return timeSlots;
};