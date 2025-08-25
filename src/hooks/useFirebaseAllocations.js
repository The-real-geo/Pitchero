import { useState, useEffect } from 'react';
import { loadAllocations, saveAllocation, clearAllAllocations } from '../utils/firebase';

export const useFirebaseAllocations = (allocatorType) => {
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAllocationsForDate = async (date) => {
    if (!date) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await loadAllocations(allocatorType, date);
      
      // Convert Firebase data back to UI format
      const allocationsMap = {};
      data.forEach(allocation => {
        // Handle multi-slot allocations
        if (allocation.isMultiSlot && allocation.totalSlots > 1) {
          const slots = allocation.startTime ? getTimeSlots(allocation.startTime, allocation.totalSlots) : [allocation.startTime];
          
          slots.forEach((timeSlot, index) => {
            const key = `${allocation.date}-${timeSlot}-${allocation.pitch}-${allocation.section}`;
            allocationsMap[key] = {
              ...allocation,
              slotIndex: index
            };
          });
        } else {
          const key = `${allocation.date}-${allocation.startTime}-${allocation.pitch}-${allocation.section}`;
          allocationsMap[key] = allocation;
        }
      });
      
      setAllocations(allocationsMap);
    } catch (err) {
      setError(err.message);
      console.error("Error loading allocations:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveAllocationToFirestore = async (teamName, allocation, date) => {
    setLoading(true);
    setError(null);
    
    try {
      const allocationWithTeam = { ...allocation, teamName };
      await saveAllocation(allocatorType, allocationWithTeam, date);
      
      // Reload to get fresh data
      await loadAllocationsForDate(date);
    } catch (err) {
      setError(err.message);
      console.error("Error saving allocation:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearAllAllocationsForDate = async (date) => {
    setLoading(true);
    setError(null);
    
    try {
      await clearAllAllocations(allocatorType, date);
      setAllocations({});
    } catch (err) {
      setError(err.message);
      console.error("Error clearing allocations:", err);
    } finally {
      setLoading(false);
    }
  };

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
const getTimeSlots = (startTime, totalSlots) => {
  const timeSlots = [];
  const [hour, minute] = startTime.split(':').map(Number);
  
  for (let i = 0; i < totalSlots; i++) {
    const totalMinutes = hour * 60 + minute + (i * 30);
    const newHour = Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;
    timeSlots.push(`${newHour}:${newMinute.toString().padStart(2, '0')}`);
  }
  
  return timeSlots;
};