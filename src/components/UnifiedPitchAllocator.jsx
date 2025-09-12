// FULL UnifiedPitchAllocator.jsx with fixes applied
// Updated: replaced `displaySlots` with `slots` in setAllSlotsExpanded

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth,db } from '../utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useParams, useNavigate } from 'react-router-dom';

// Utility for time slots
const timeSlots = () => {
  const slots = [];
  for (let hour = 7; hour <= 21; hour++) {
    slots.push(`${hour}:00`);
    slots.push(`${hour}:15`);
    slots.push(`${hour}:30`);
    slots.push(`${hour}:45`);
  }
  return slots;
};

export default function UnifiedPitchAllocator({
  allocations,
  setAllocations,
  allPitchAllocations,
  setAllPitchAllocations,
  pitchId,
  normalizedPitchId,
  sections,
  userRole,
  clubInfo,
  date,
  pitchNames,
}) {
  const slots = useMemo(() => timeSlots(), []);

  const [expandedSlots, setExpandedSlots] = useState({});
  const [deletingKeys, setDeletingKeys] = useState(new Set());
  const [deletingAllocation, setDeletingAllocation] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // Expand/Collapse all slots FIXED
  const setAllSlotsExpanded = (expanded) => {
    const newExpanded = {};
    slots.forEach((slot) => {
      newExpanded[slot] = expanded;
    });
    setExpandedSlots(newExpanded);
  };

  // Filtered allocations
  const filteredAllocations = useMemo(() => {
    if (filterType === "all") return allocations;
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
        const uniqueKey = `${allocation.team}-${allocation.startTime}-${allocation.section}`;
        uniqueAllocations.add(uniqueKey);
      } else {
        uniqueAllocations.add(key);
      }
    });
    return uniqueAllocations.size;
  }, [filteredAllocations]);

  // Sidebar helpers
  const getAllocationsCountForPitch = useCallback(
    (pitchId) => {
      let count = 0;
      Object.keys(allPitchAllocations).forEach((key) => {
        if (key.includes(`-${pitchId}-`)) {
          count++;
        }
      });
      return count;
    },
    [allPitchAllocations]
  );

  const getPitchDisplayName = useCallback((pitchNumber, names) => {
    const possibleKeys = [
      `pitch-${pitchNumber}`,
      `pitch${pitchNumber}`,
      `Pitch ${pitchNumber}`,
      `Pitch-${pitchNumber}`,
      pitchNumber.toString(),
    ];
    for (const key of possibleKeys) {
      if (names && names[key]) {
        return names[key];
      }
    }
    return `Pitch ${pitchNumber}`;
  }, []);

  const currentPitchName = useMemo(() => {
    const possibleKeys = [
      normalizedPitchId,
      pitchId,
      `pitch${pitchId}`,
      `pitch-${pitchId}`,
    ];
    for (const key of possibleKeys) {
      if (pitchNames[key]) {
        return pitchNames[key];
      }
    }
    return `Pitch ${pitchId}`;
  }, [pitchNames, normalizedPitchId, pitchId]);

  // Helpers
  const isLightColor = (color) => {
    if (!color) return true;
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  // Clear allocation
  const clearAllocation = async (key) => {
    if (userRole !== "admin") {
      alert("Only administrators can remove allocations");
      return;
    }
    const allocation = allocations[key];
    if (!allocation || !clubInfo?.clubId) return;
    if (deletingKeys.has(key)) return;

    try {
      const keysToRemove = [];
      if (allocation.isMultiSlot) {
        const startSlotIndex = slots.indexOf(allocation.startTime);
        for (let i = 0; i < allocation.totalSlots; i++) {
          const slotToRemove = slots[startSlotIndex + i];
          if (allocation.type === "game") {
            let sectionsToRemove;
            if (allocation.sectionGroup) {
              sectionsToRemove = allocation.sectionGroup;
            } else {
              sectionsToRemove = [];
              sections.forEach((sec) => {
                const checkKey = `${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`;
                if (
                  allocations[checkKey] &&
                  allocations[checkKey].team === allocation.team &&
                  allocations[checkKey].startTime === allocation.startTime
                ) {
                  sectionsToRemove.push(sec);
                }
              });
            }
            sectionsToRemove.forEach((sec) => {
              keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`);
            });
          } else {
            keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${allocation.section}`);
          }
        }
      } else {
        keysToRemove.push(key);
      }

      setDeletingKeys((prev) => new Set(prev).add(key));
      setAllocations((prev) => {
        const updated = { ...prev };
        keysToRemove.forEach((k) => delete updated[k]);
        return updated;
      });
      setAllPitchAllocations((prev) => {
        const updated = { ...prev };
        keysToRemove.forEach((k) => delete updated[k]);
        return updated;
      });

      const collectionName = allocation.type === "training" ? "trainingAllocations" : "matchAllocations";
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${allocation.date}`);
      const existingDoc = await getDoc(docRef);

      if (existingDoc.exists()) {
        const existingData = existingDoc.data();
        keysToRemove.forEach((k) => delete existingData[k]);
        if (Object.keys(existingData).length > 0) {
          await setDoc(docRef, existingData);
        } else {
          await deleteDoc(docRef);
        }
      }
      setDeletingKeys((prev) => {
        const newSet = new Set(prev);
        keysToRemove.forEach((k) => newSet.delete(k));
        return newSet;
      });
    } catch (err) {
      console.error("Error deleting allocation:", err);
      alert(`Failed to remove allocation: ${err.message}`);
    }
  };

  // Clear all allocations for the day
  const clearAllAllocations = async () => {
    if (userRole !== "admin") {
      alert("Only administrators can clear allocations");
      return;
    }
    if (!window.confirm(`Clear ALL allocations for ${new Date(date).toLocaleDateString()}?`)) return;

    setDeletingAllocation(true);
    try {
      setAllocations({});
      const trainingDocRef = doc(db, "trainingAllocations", `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, "matchAllocations", `${clubInfo.clubId}-${date}`);
      const [trainingDoc, matchDoc] = await Promise.all([getDoc(trainingDocRef), getDoc(matchDocRef)]);
      if (trainingDoc.exists()) await deleteDoc(trainingDocRef);
      if (matchDoc.exists()) await deleteDoc(matchDocRef);
    } catch (err) {
      console.error("Error clearing all allocations:", err);
      alert(`Failed to clear allocations: ${err.message}`);
    } finally {
      setDeletingAllocation(false);
    }
  };

  // --- RENDER START (simplified placeholder for your UI) ---
  return (
    <div className="p-4">
      <h2 className="font-bold text-lg mb-2">{currentPitchName} Allocations</h2>
      <p>Total allocations: {totalAllocations}</p>
      <button
        className="bg-red-500 text-white px-3 py-1 rounded"
        onClick={clearAllAllocations}
        disabled={deletingAllocation}
      >
        Clear All
      </button>
    </div>
  );
}
