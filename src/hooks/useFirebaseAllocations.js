// src/hooks/useFirebaseAllocations.js
import { useState, useCallback, useEffect } from 'react';
import { 
  loadAllocations, 
  saveAllocation, 
  clearAllAllocations, 
  deleteAllocation, 
  auth, 
  getUserProfile, 
  getClubInfo 
} from '../utils/firebase';
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
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
          
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
      // Pass clubId explicitly to ensure consistent club context
      const data = await loadAllocations(allocatorType, date, userProfile.clubId);
      
      // Convert Firebase data back to UI format
      // IMPORTANT: Each Firebase document represents a single allocation entry
      // We should NOT expand multi-slot allocations here as they are already stored as separate documents
      const allocationsMap = {};
      
      data.forEach(allocation => {
        // Each allocation from Firebase is a unique entry with its own document ID
        // Build the key based on the allocation's actual time slot (not just startTime)
        const timeSlot = allocation.timeSlot || allocation.startTime;
        const key = `${allocation.date}-${timeSlot}-${allocation.pitch}-${allocation.section}`;
        
        // Preserve the document ID for each allocation
        allocationsMap[key] = {
          ...allocation,
          id: allocation.id // Ensure the Firebase document ID is preserved
        };
      });
      
      console.log(`Loaded ${Object.keys(allocationsMap).length} allocation entries with ${data.length} document IDs`);
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
      // Pass clubId explicitly to ensure consistent club context
      await saveAllocation(allocatorType, allocationWithTeam, date, userProfile.clubId);
      
      await loadAllocationsForDate(date);
      console.log(`Saved and reloaded ${allocatorType} for club`);
    } catch (err) {
      console.error(`Error saving ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, loadAllocationsForDate, user, userProfile, clubInfo]);

  // Delete allocation using Firestore docId with explicit clubId
  const deleteAllocationFromFirestore = useCallback(async (docId, date) => {
    if (!user || !userProfile?.clubId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Deleting ${allocatorType} allocation: ${docId} (Club: ${clubInfo?.name || userProfile.clubId})`);
      // Pass clubId explicitly to ensure consistent club context
      await deleteAllocation(allocatorType, docId, date, userProfile.clubId);
      
      await loadAllocationsForDate(date);
      console.log(`Deleted and reloaded ${allocatorType} allocation for club`);
    } catch (err) {
      console.error(`Error deleting ${allocatorType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, loadAllocationsForDate, user, userProfile, clubInfo]);

  // New function to delete all allocations with a specific bookingId
  const deleteAllocationsByBookingId = useCallback(async (bookingId, date) => {
    if (!user || !userProfile?.clubId || !bookingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Deleting all allocations with bookingId: ${bookingId}`);
      
      // Find all allocations with this bookingId
      const toDelete = [];
      Object.entries(allocations).forEach(([key, allocation]) => {
        if (allocation.bookingId === bookingId && allocation.id) {
          toDelete.push(allocation.id);
        }
      });
      
      // If no bookingId match, fallback to matching by team/date/time/pitch
      if (toDelete.length === 0) {
        const sampleAllocation = Object.values(allocations).find(a => a.bookingId === bookingId) || 
                                Object.values(allocations)[0];
        
        if (sampleAllocation) {
          Object.entries(allocations).forEach(([key, allocation]) => {
            if (allocation.team === sampleAllocation.team &&
                allocation.date === sampleAllocation.date &&
                allocation.startTime === sampleAllocation.startTime &&
                allocation.pitch === sampleAllocation.pitch &&
                allocation.id) {
              toDelete.push(allocation.id);
            }
          });
        }
      }
      
      // Remove duplicates
      const uniqueIds = [...new Set(toDelete)];
      
      console.log(`Deleting ${uniqueIds.length} documents for booking ${bookingId}`);
      
      // Delete all documents in parallel
      await Promise.all(
        uniqueIds.map(id => deleteAllocation(allocatorType, id, date, userProfile.clubId))
      );
      
      // Reload allocations
      await loadAllocationsForDate(date);
      console.log(`Deleted entire booking and reloaded allocations`);
      
    } catch (err) {
      console.error(`Error deleting booking:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allocatorType, allocations, user, userProfile, loadAllocationsForDate]);

  const clearAllAllocationsForDate = useCallback(async (date) => {
    if (!user || !userProfile?.clubId) return;
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Clearing all ${allocatorType} for ${date} (Club: ${clubInfo?.name || userProfile.clubId})`);
      // Pass clubId explicitly to ensure consistent club context
      await clearAllAllocations(allocatorType, date, userProfile.clubId);
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
    deleteAllocationFromFirestore,
    deleteAllocationsByBookingId  // Export new function
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