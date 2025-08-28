// src/hooks/useFirebaseAllocations.js
import { useState, useCallback, useEffect } from 'react';
import { loadAllocations, saveAllocation, clearAllAllocations, deleteAllocation, auth, getUserProfile, getClubInfo } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useFirebaseAllocations = (allocatorType) => {
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);

  // Monitor auth state and load user profile/club info
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Get user profile with club association
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
          
          // Get club information
          if (profile?.clubId) {
            const club = await getClubInfo(profile.clubId);
            setClubInfo(club);
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
          setError("Failed to load user profile");
        }
      } else {
        setUserProfile(null);
        setClubInfo(null);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const loadAllocationsForDate = useCallback(async (date) => {
    if (!date || !user || !userProfile?.clubId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Loading ${allocatorType} for ${date} (Club: ${clubInfo?.name || userProfile.clubId})`);
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
      
      console.log(`Loaded ${Object.keys(allocationsMap).length} allocation slots for club`);
      setAllocations(allocationsMap);
    } catch (err) {
      console.error(`Error loading ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, user, userProfile, clubInfo]);

  const saveAllocationToFirestore = useCallback(async (teamName, allocation, date) => {
    if (!user || !userProfile?.clubId) return;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Saving ${allocatorType} for ${teamName} (Club: ${clubInfo?.name || userProfile.clubId})`);
      const allocationWithTeam = { ...allocation, teamName };
      await saveAllocation(allocatorType, allocationWithTeam, date);
      console.log(`Saved ${allocatorType} for club`);
    } catch (err) {
      console.error(`Error saving ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, user, userProfile, clubInfo]);

  const deleteAllocationFromFirestore = useCallback(async (allocationKey, date) => {
    if (!user || !userProfile?.clubId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Deleting ${allocatorType} allocation: ${allocationKey} (Club: ${clubInfo?.name || userProfile.clubId})`);
      await deleteAllocation(allocatorType, allocationKey, date);
      
      // Remove from local state
      const updatedAllocations = { ...allocations };
      delete updatedAllocations[allocationKey];
      setAllocations(updatedAllocations);
      
      console.log(`Deleted ${allocatorType} allocation for club`);
    } catch (err) {
      console.error(`Error deleting ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, allocations, user, userProfile, clubInfo]);

  const clearAllAllocationsForDate = useCallback(async (date) => {
    if (!user || !userProfile?.clubId) return;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Clearing all ${allocatorType} for ${date} (Club: ${clubInfo?.name || userProfile.clubId})`);
      await clearAllAllocations(allocatorType, date);
      setAllocations({});
      console.log(`Cleared all ${allocatorType} for club`);
    } catch (err) {
      console.error(`Error clearing ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, user, userProfile, clubInfo]);

  return {
    allocations,
    loading,
    error,
    user,
    userProfile,
    clubInfo,
    loadAllocationsForDate,
    saveAllocationToFirestore,
    clearAllAllocationsForDate,
    deleteAllocationFromFirestore
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