// src/components/UnifiedPitchAllocator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Reused constants
const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

  // --- State (kept same names for drop-in compatibility) ---
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [pitchNames, setPitchNames] = useState({});
  const [showGrassArea, setShowGrassArea] = useState({});
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [deletingAllocation, setDeletingAllocation] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState(new Set());

  // Form
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allocationType, setAllocationType] = useState('training');
  const [team, setTeam] = useState('');
  const [section, setSection] = useState('A');
  const [sectionGroup, setSectionGroup] = useState('A');
  const [slot, setSlot] = useState('08:00');
  const [duration, setDuration] = useState(30);

  // UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState({});
  const [shareLink, setShareLink] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);

  const slots = useMemo(() => timeSlots(), []);

  // Normalized pitch id (keeps same format used in your DB keys)
  const normalizedPitchId = useMemo(() => {
    if (!pitchId) return '';
    const id = String(pitchId);
    if (!id.startsWith('pitch')) return `pitch${id}`;
    return id.replace('pitch-', 'pitch');
  }, [pitchId]);

  // Helpers (copied/cleaned)
  const isLightColor = (color) => {
    if (!color) return true;
    const hex = color.replace('#', '');
    if (hex.length < 6) return true;
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
  };

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

  const getDefaultPitchAreaForTeam = useCallback((teamName) => {
    if (!teamName) return 'Under 6 & 7';
    const ageMatch = teamName.match(/Under (\d+)/);
    if (!ageMatch) return 'Under 6 & 7';
    const age = parseInt(ageMatch[1], 10);
    if (age <= 7) return 'Under 6 & 7';
    if (age <= 9) return 'Under 8 & 9';
    if (age <= 13) return 'Under 10-13';
    return 'Under 14+';
  }, []);

  const getMatchDayDuration = useCallback((teamName) => {
    if (!teamName) return 60;
    const ageMatch = teamName.match(/Under (\d+)/);
    if (!ageMatch) return 60;
    const age = parseInt(ageMatch[1], 10);
    if (age <= 7) return 45;
    if (age <= 9) return 60;
    if (age <= 11) return 75;
    if (age <= 13) return 90;
    return 90;
  }, []);

  const getSectionOptions = useCallback((teamName) => {
    const isUnder6or7 = teamName && (teamName.includes('Under 6') || teamName.includes('Under 7'));
    const isUnder8or9 = teamName && (teamName.includes('Under 8') || teamName.includes('Under 9'));
    const isUnder10to13 = teamName && (
      teamName.includes('Under 10') || teamName.includes('Under 11') ||
      teamName.includes('Under 12') || teamName.includes('Under 13')
    );
    const isUnder14Plus = teamName && (
      teamName.includes('Under 14') || teamName.includes('Under 15') || teamName.includes('Under 16')
    );

    if (isUnder6or7) {
      const opts = sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
      if (showGrassArea[normalizedPitchId]) opts.push({ value: 'grass', label: 'Grass Area' });
      return opts;
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
    if (isUnder14Plus) return [{ value: 'ALL', label: 'All 8 Sections (Whole Pitch)' }];
    return sections.map(sec => ({ value: sec, label: `Section ${sec}` }));
  }, [showGrassArea, normalizedPitchId]);

  const getSectionsToAllocate = useCallback((teamName, selectedLayout) => {
    const pitchAreaReq = matchDayPitchAreaRequired[teamName] || getDefaultPitchAreaForTeam(teamName);
    switch (pitchAreaReq) {
      case 'Under 6 & 7':
        return [selectedLayout];
      case 'Under 8 & 9': {
        const under8Options = {
          'A+C': ['A', 'C'],
          'B+D': ['B', 'D'],
          'E+G': ['E', 'G'],
          'F+H': ['F', 'H']
        };
        return under8Options[selectedLayout] || ['A', 'C'];
      }
      case 'Under 10-13': {
        const under10Options = {
          'A+B+C+D': ['A', 'B', 'C', 'D'],
          'C+D+E+F': ['C', 'D', 'E', 'F'],
          'E+F+G+H': ['E', 'F', 'G', 'H']
        };
        return under10Options[selectedLayout] || ['A', 'B', 'C', 'D'];
      }
      case 'Under 14+':
        return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      default:
        return [selectedLayout];
    }
  }, [matchDayPitchAreaRequired, getDefaultPitchAreaForTeam]);

  // Count allocations
  const totalAllocations = useMemo(() => {
    const unique = new Set();
    Object.entries(allocations).forEach(([key, allocation]) => {
      if (!allocation) return;
      if (allocation.isMultiSlot) {
        unique.add(`${allocation.team}-${allocation.startTime}-${allocation.section}`);
      } else unique.add(key);
    });
    return unique.size;
  }, [allocations]);

  // --- Effects: auth & loading ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserRole(null);
        setClubInfo(null);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
          if (userData.clubId) {
            const clubDoc = await getDoc(doc(db, 'clubs', userData.clubId));
            if (clubDoc.exists()) {
              const clubData = clubDoc.data();
              const clubName = clubData.name || clubData.clubName || clubData.Name || `Club ${userData.clubId}`;
              setClubInfo({ clubId: userData.clubId, name: clubName });
            } else {
              setClubInfo({ clubId: userData.clubId, name: `Club ${userData.clubId}` });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching user/club data:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load settings when clubInfo ready
  useEffect(() => {
    if (!clubInfo?.clubId) return;
    const loadSettings = async () => {
      try {
        const settingsRef = doc(db, 'clubs', clubInfo.clubId, 'settings', 'general');
        const settingsDoc = await getDoc(settingsRef);
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.clubName) setClubInfo(prev => ({ ...prev, name: data.clubName }));
          if (data.teams) {
            setTeams(data.teams);
            if (data.teams.length > 0 && !team) setTeam(data.teams[0].name);
          }
          if (data.pitchNames) setPitchNames(data.pitchNames);
          if (data.showGrassArea) setShowGrassArea(data.showGrassArea);
        }
      } catch (err) {
        console.error('Error loading settings', err);
      }
    };
    loadSettings();
  }, [clubInfo?.clubId, team]);

  // Load allocations for the date / pitch
  const loadAllocations = useCallback(async () => {
    if (!clubInfo?.clubId || !date || !normalizedPitchId) return;
    try {
      const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
      const [trainingDoc, matchDoc] = await Promise.all([getDoc(trainingDocRef), getDoc(matchDocRef)]);
      const combined = {};
      if (trainingDoc.exists()) {
        const trainingData = trainingDoc.data();
        Object.entries(trainingData).forEach(([key, value]) => {
          if (key.includes(`-${normalizedPitchId}-`) && typeof value === 'object') {
            combined[key] = { ...value, type: 'training' };
          }
        });
      }
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        Object.entries(matchData).forEach(([key, value]) => {
          if (key.includes(`-${normalizedPitchId}-`) && typeof value === 'object') {
            combined[key] = { ...value, type: 'game' };
          }
        });
      }
      setAllocations(combined);
    } catch (err) {
      console.error('Error loading allocations', err);
      setAllocations({});
    }
  }, [date, normalizedPitchId, clubInfo?.clubId]);

  useEffect(() => { loadAllocations(); }, [loadAllocations]);

  useEffect(() => {
    const initial = {};
    slots.forEach(s => { initial[s] = true; });
    setExpandedSlots(initial);
  }, [slots]);

  // Logout
  const handleLogout = async () => {
    try {
      setMenuOpen(false);
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  // Conflict check
  const hasConflict = useMemo(() => {
    const slotsNeeded = duration / 15;
    const startIndex = slots.indexOf(slot);
    if (startIndex < 0 || startIndex + slotsNeeded > slots.length) return true;
    const sectionsToCheck = allocationType === 'training' ? [section] : getSectionsToAllocate(team, sectionGroup);
    for (let i = 0; i < slotsNeeded; i++) {
      const checkSlot = slots[startIndex + i];
      for (const sec of sectionsToCheck) {
        const key = `${date}-${checkSlot}-${normalizedPitchId}-${sec}`;
        if (allocations[key]) return true;
      }
    }
    return false;
  }, [allocations, date, slot, normalizedPitchId, section, sectionGroup, duration, slots, allocationType, team, getSectionsToAllocate]);

  // Add allocation (optimistic)
  const addAllocation = async () => {
    if (userRole !== 'admin') { alert('Only administrators can add allocations'); return; }
    const selectedTeam = teams.find(t => t.name === team);
    if (!selectedTeam || hasConflict || !clubInfo?.clubId) return;

    setSavingAllocation(true);
    try {
      const slotsNeeded = duration / 15;
      const startSlotIndex = slots.indexOf(slot);
      const actualDuration = allocationType === 'game' ? getMatchDayDuration(team) : duration;
      const sectionsToAllocate = allocationType === 'training' ? [section] : getSectionsToAllocate(team, sectionGroup);

      const newAllocations = {};
      for (let i = 0; i < slotsNeeded; i++) {
        const currentSlot = slots[startSlotIndex + i];
        for (const sec of sectionsToAllocate) {
          const key = `${date}-${currentSlot}-${normalizedPitchId}-${sec}`;
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
            section: sec,
            sectionGroup: allocationType === 'game' ? sectionGroup : null,
            date,
            type: allocationType,
            clubId: clubInfo.clubId,
            created: Date.now(),
            createdBy: user?.email || ''
          };
        }
      }

      // Optimistic update locally
      setAllocations(prev => ({ ...prev, ...newAllocations }));

      const collectionName = allocationType === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${date}`);
      const existingDoc = await getDoc(docRef);
      const existingData = existingDoc.exists() ? existingDoc.data() : {};

      // Merge and write (batch into chunks of 10 to be safe)
      const entries = Object.entries(newAllocations);
      if (entries.length > 10) {
        let current = { ...existingData };
        const chunkSize = 10;
        for (let i = 0; i < entries.length; i += chunkSize) {
          const chunk = entries.slice(i, i + chunkSize);
          const chunkObj = Object.fromEntries(chunk);
          current = { ...current, ...chunkObj };
          await setDoc(docRef, current);
        }
      } else {
        const updated = { ...existingData, ...newAllocations };
        await setDoc(docRef, updated);
      }
    } catch (err) {
      console.error('Error saving allocation', err);
      alert(`Failed to save allocation: ${err.message || err}`);
      await loadAllocations();
    } finally {
      setSavingAllocation(false);
    }
  };

  // Clear (single) allocation
  const clearAllocation = async (key) => {
    if (userRole !== 'admin') { alert('Only administrators can remove allocations'); return; }
    const allocation = allocations[key];
    if (!allocation || !clubInfo?.clubId) return;
    if (deletingKeys.has(key)) return;

    try {
      const keysToRemove = [];

      if (allocation.isMultiSlot) {
        const startIndex = slots.indexOf(allocation.startTime);
        for (let i = 0; i < allocation.totalSlots; i++) {
          const slotToRemove = slots[startIndex + i];
          if (allocation.type === 'game') {
            let sectionsToRemove = [];
            if (allocation.sectionGroup) {
              sectionsToRemove = getSectionsToAllocate(allocation.team, allocation.sectionGroup);
            } else {
              sections.forEach(sec => {
                const checkKey = `${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`;
                if (allocations[checkKey] && allocations[checkKey].team === allocation.team && allocations[checkKey].startTime === allocation.startTime) {
                  sectionsToRemove.push(sec);
                }
              });
            }
            sectionsToRemove.forEach(sec => keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${sec}`));
          } else {
            keysToRemove.push(`${allocation.date}-${slotToRemove}-${normalizedPitchId}-${allocation.section}`);
          }
        }
      } else {
        keysToRemove.push(key);
      }

      // Mark so UI shows removing
      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.add(k));
        return newSet;
      });

      // Optimistic UI
      setAllocations(prev => {
        const copy = { ...prev };
        keysToRemove.forEach(k => delete copy[k]);
        return copy;
      });

      const collectionName = allocation.type === 'training' ? 'trainingAllocations' : 'matchAllocations';
      const docRef = doc(db, collectionName, `${clubInfo.clubId}-${allocation.date}`);
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        const existingData = existingDoc.data();
        keysToRemove.forEach(k => delete existingData[k]);
        if (Object.keys(existingData).length > 0) {
          await setDoc(docRef, existingData);
        } else {
          await deleteDoc(docRef);
        }
      }

      // Clear deleting keys
      setDeletingKeys(prev => {
        const newSet = new Set(prev);
        keysToRemove.forEach(k => newSet.delete(k));
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting allocation', err);
      alert(`Failed to remove allocation: ${err.message || err}`);
      await loadAllocations();
      setDeletingKeys(new Set());
    }
  };

  // Clear all allocations for pitch on the date
  const clearAllAllocations = async () => {
    if (userRole !== 'admin') { alert('Only administrators can clear allocations'); return; }
    if (!window.confirm(`Are you sure you want to clear ALL allocations for ${new Date(date).toLocaleDateString()}?`)) return;
    setDeletingAllocation(true);
    try {
      setAllocations({});

      const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
      const [trainingDoc, matchDoc] = await Promise.all([getDoc(trainingDocRef), getDoc(matchDocRef)]);

      if (trainingDoc.exists()) {
        const trainingData = trainingDoc.data();
        const filtered = {};
        Object.entries(trainingData).forEach(([k, v]) => { if (!k.includes(`-${normalizedPitchId}-`)) filtered[k] = v; });
        if (Object.keys(filtered).length > 0) await setDoc(trainingDocRef, filtered); else await deleteDoc(trainingDocRef);
      }
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        const filtered = {};
        Object.entries(matchData).forEach(([k, v]) => { if (!k.includes(`-${normalizedPitchId}-`)) filtered[k] = v; });
        if (Object.keys(filtered).length > 0) await setDoc(matchDocRef, filtered); else await deleteDoc(matchDocRef);
      }

      alert('All allocations cleared successfully');
    } catch (err) {
      console.error('Error clearing allocations', err);
      alert(`Failed to clear allocations: ${err.message || err}`);
      await loadAllocations();
    } finally {
      setDeletingAllocation(false);
    }
  };

  // Export & Import
  const exportAllocations = () => {
    const exportData = {
      club: clubInfo?.name || '',
      date,
      pitch: pitchNames[normalizedPitchId] || `Pitch ${pitchId}`,
      allocations,
      exported: new Date().toISOString()
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const fileName = `allocations_${date}_pitch${pitchId}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', fileName);
    link.click();
  };

  const importAllocations = async () => {
    if (userRole !== 'admin') { alert('Only administrators can import allocations'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.allocations) { alert('Invalid import file'); return; }
        if (!window.confirm(`Import allocations from ${data.date}? This will merge with existing allocations.`)) return;

        const trainingAlloc = {};
        const matchAlloc = {};
        Object.entries(data.allocations).forEach(([k, v]) => {
          if (v.type === 'training') trainingAlloc[k] = v; else matchAlloc[k] = v;
        });

        if (Object.keys(trainingAlloc).length > 0) {
          const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
          const existing = await getDoc(trainingDocRef);
          const existingData = existing.exists() ? existing.data() : {};
          await setDoc(trainingDocRef, { ...existingData, ...trainingAlloc });
        }
        if (Object.keys(matchAlloc).length > 0) {
          const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
          const existing = await getDoc(matchDocRef);
          const existingData = existing.exists() ? existing.data() : {};
          await setDoc(matchDocRef, { ...existingData, ...matchAlloc });
        }

        setAllocations(prev => ({ ...prev, ...data.allocations }));
        alert('Imported successfully');
      } catch (err) {
        console.error('Import error', err);
        alert('Failed to import allocations. Check file format.');
      }
    };
    input.click();
  };

  // Team & type handlers
  const handleTeamChange = (newTeam) => {
    setTeam(newTeam);
    if (allocationType === 'game') {
      const options = getSectionOptions(newTeam);
      setSectionGroup(options[0]?.value || 'A');
      setDuration(getMatchDayDuration(newTeam));
    }
  };

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

  // Date navigation & slot toggles
  const changeDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const toggleSlotExpanded = (s) => setExpandedSlots(prev => ({ ...prev, [s]: !prev[s] }));
  const setAllSlotsExpanded = (expanded) => {
    const next = {};
    slots.forEach(s => next[s] = expanded);
    setExpandedSlots(next);
  };

  // Share all allocations for date
  const handleShare = async () => {
    try {
      const allPitchAllocations = {};
      const trainingDocRef = doc(db, 'trainingAllocations', `${clubInfo.clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubInfo.clubId}-${date}`);
      const [trainingDoc, matchDoc] = await Promise.all([getDoc(trainingDocRef), getDoc(matchDocRef)]);
      if (trainingDoc.exists()) {
        const trainingData = trainingDoc.data();
        Object.entries(trainingData).forEach(([k, v]) => { if (v && typeof v === 'object') allPitchAllocations[k] = { ...v, type: 'training' }; });
      }
      if (matchDoc.exists()) {
        const matchData = matchDoc.data();
        Object.entries(matchData).forEach(([k, v]) => { if (v && typeof v === 'object') allPitchAllocations[k] = { ...v, type: 'game' }; });
      }

      const pitchIds = new Set();
      Object.keys(allPitchAllocations).forEach(k => {
        const parts = k.split('-');
        if (parts.length >= 4) pitchIds.add(parts[2]);
      });

      const hasTraining = Object.values(allPitchAllocations).some(a => a.type === 'training');
      const hasGame = Object.values(allPitchAllocations).some(a => a.type === 'game');
      let allocationKind = 'mixed';
      if (hasTraining && !hasGame) allocationKind = 'training';
      if (hasGame && !hasTraining) allocationKind = 'match';

      const shareData = {
        allocations: allPitchAllocations,
        date,
        type: allocationKind,
        pitches: Array.from(pitchIds),
        pitchNames,
        showGrassArea,
        clubName: clubInfo?.name || 'Unknown Club',
        clubId: clubInfo?.clubId || '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        timeRange: { start: 8, end: 21.5 }
      };

      const shareId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const shareRef = doc(db, 'sharedAllocations', shareId);
      await setDoc(shareRef, shareData);

      const link = `${window.location.origin}/share/${shareId}`;
      setShareLink(link);
      setShowShareDialog(true);
    } catch (err) {
      console.error('Error creating share', err);
      alert('Failed to create share link.');
    }
  };

  const ShareDialog = () => {
    if (!showShareDialog) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001
      }}>
        <div style={{ backgroundColor: 'white', padding: 32, borderRadius: 12, maxWidth: 520, width: '90%' }}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>Share Pitch Allocation</h3>
          <p style={{ marginTop: 0, marginBottom: 12 }}>Your shareable link has been created. It will expire in 30 days.</p>
          <div style={{ backgroundColor: '#f3f4f6', padding: 12, borderRadius: 6, wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {shareLink}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => { navigator.clipboard.writeText(shareLink); alert('Link copied'); }} style={{ padding: '8px 14px' }}>Copy</button>
            <button onClick={() => window.open(shareLink, '_blank')} style={{ padding: '8px 14px' }}>Open</button>
            <button onClick={() => { setShowShareDialog(false); setShareLink(''); }} style={{ padding: '8px 14px' }}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  // Render single pitch visual block for a time slot
  const renderPitchSection = (timeSlot) => {
    return (
      <div style={{
        position: 'relative',
        backgroundColor: '#dcfce7',
        border: '4px solid white',
        borderRadius: 8,
        padding: 16,
        width: 280,
        height: 400
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#bbf7d0', borderRadius: 8, overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 2, left: 2, right: 2, bottom: 2,
            border: '2px solid white', borderRadius: 4
          }} />
          <div style={{
            position: 'absolute', left: 2, right: 2, top: '50%', height: 2, transform: 'translateY(-50%)', backgroundColor: 'white'
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: 80, height: 80, border: '2px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)'
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, backgroundColor: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)'
          }} />

          {/* penalty & goal boxes */}
          <div style={{ position: 'absolute', top: 2, left: '25%', right: '25%', height: 60, border: '2px solid white', borderTop: 'none' }} />
          <div style={{ position: 'absolute', bottom: 2, left: '25%', right: '25%', height: 60, border: '2px solid white', borderBottom: 'none' }} />
          <div style={{ position: 'absolute', top: 2, left: '37.5%', right: '37.5%', height: 25, border: '2px solid white', borderTop: 'none' }} />
          <div style={{ position: 'absolute', bottom: 2, left: '37.5%', right: '37.5%', height: 25, border: '2px solid white', borderBottom: 'none' }} />

          {/* corners */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, border: '2px solid white', borderRadius: '0 0 20px 0', borderTop: 'none', borderLeft: 'none' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, border: '2px solid white', borderRadius: '0 0 0 20px', borderTop: 'none', borderRight: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, border: '2px solid white', borderRadius: '0 20px 0 0', borderBottom: 'none', borderLeft: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, border: '2px solid white', borderRadius: '20px 0 0 0', borderBottom: 'none', borderRight: 'none' }} />
        </div>

        <div style={{
          position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(4, 1fr)', gap: 4, height: '100%', zIndex: 10
        }}>
          {sections.map(sec => {
            const key = `${date}-${timeSlot}-${normalizedPitchId}-${sec}`;
            const allocation = allocations[key];
            const isDeleting = deletingKeys.has(key);
            const bg = allocation ? (allocation.colour || allocation.color || '#ddd') + '90' : 'rgba(255,255,255,0.1)';
            const borderColor = allocation ? (allocation.colour || allocation.color || '#ddd') : 'rgba(255,255,255,0.5)';
            return (
              <div
                key={sec}
                style={{
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 500,
                  position: 'relative',
                  padding: 4,
                  textAlign: 'center',
                  cursor: allocation && userRole === 'admin' && !isDeleting ? 'pointer' : 'default',
                  backgroundColor: bg,
                  borderColor,
                  color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151',
                  opacity: isDeleting ? 0.5 : 1,
                  pointerEvents: isDeleting ? 'none' : 'auto'
                }}
                onClick={() => allocation && userRole === 'admin' && !isDeleting && clearAllocation(key)}
                title={allocation ? `${allocation.team} (${allocation.duration}min) - Click to remove` : `Section ${sec} - Available`}
              >
                {allocation && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2, width: 14, height: 14,
                    backgroundColor: allocation.type === 'training' ? '#3b82f6' : '#ef4444',
                    color: 'white', fontSize: 8, fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, zIndex: 20
                  }}>{allocation.type === 'training' ? 'T' : 'M'}</div>
                )}
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4, fontWeight: 'bold' }}>{sec}</div>
                <div style={{ textAlign: 'center', padding: '0 4px', fontSize: 12, lineHeight: 1.2 }}>
                  {allocation ? (isDeleting ? 'Removing...' : allocation.team) : ''}
                </div>
                {allocation && allocation.isMultiSlot && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{allocation.duration}min</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const currentPitchName = pitchNames[normalizedPitchId] || `Pitch ${pitchId}`;
  const isAdmin = userRole === 'admin';

  // -------------------
  // Main render (centered wrapper)
  // -------------------
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      display: 'grid',
      justifyItems: 'center',
      alignContent: 'start', // change to 'center' if you want vertical centering
      padding: 24
    }}>
      <div style={{ width: 'min(1400px, 100%)', marginInline: 'auto', flex: '0 0 auto' }}>
        {/* Header */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '16px 24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937', margin: 0 }}>{clubInfo?.name || 'Loading...'}</h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0 0' }}>
                <span style={{ padding: '2px 8px', backgroundColor: totalAllocations > 0 ? '#10b981' : '#6b7280', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {totalAllocations} allocation{totalAllocations !== 1 ? 's' : ''}
                </span>
                <span style={{ marginLeft: 8 }}>on {currentPitchName}</span>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => navigate('/club-pitch-map')} style={{ padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Back to Overview</button>
              <button onClick={() => navigate('/')} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Back to Main Menu</button>

              <div style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: 10, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 2, backgroundColor: '#374151', marginBottom: 3 }} />
                  <div style={{ width: 16, height: 2, backgroundColor: '#374151', marginBottom: 3 }} />
                  <div style={{ width: 16, height: 2, backgroundColor: '#374151' }} />
                </button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: 50, right: 0, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 1000 }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>🏟️ {clubInfo?.name || 'Club'}</div>
                      <div style={{ fontSize: 13, color: '#374151' }}>{user?.email}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Role: {userRole === 'admin' ? 'Administrator' : 'Member'}</div>
                    </div>

                    {isAdmin && (
                      <div style={{ padding: 8 }}>
                        <button onClick={() => { exportAllocations(); setMenuOpen(false); }} style={{ width: '100%', padding: 12, backgroundColor: 'white', border: 'none', textAlign: 'left', cursor: 'pointer' }}>📤 Export</button>
                        <button onClick={() => { importAllocations(); setMenuOpen(false); }} style={{ width: '100%', padding: 12, backgroundColor: 'white', border: 'none', textAlign: 'left', cursor: 'pointer' }}>📥 Import</button>
                      </div>
                    )}

                    {user && (
                      <>
                        <div style={{ borderTop: '1px solid #e5e7eb' }} />
                        <button onClick={handleLogout} style={{ width: '100%', padding: 12, backgroundColor: 'white', border: 'none', textAlign: 'left', color: '#dc2626', cursor: 'pointer' }}>🚪 Logout</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Date navigation */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: '16px 24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => changeDate(-1)} style={{ padding: '10px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 10, cursor: 'pointer' }}>Previous Day</button>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                <span style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
              </div>
              <button onClick={() => changeDate(1)} style={{ padding: '10px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>Next Day</button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleShare} disabled={Object.keys(allocations).length === 0 || savingAllocation} style={{ padding: '10px 16px', backgroundColor: (Object.keys(allocations).length === 0 || savingAllocation) ? '#9ca3af' : '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Share</button>
              {isAdmin && <button onClick={clearAllAllocations} disabled={deletingAllocation} style={{ padding: '10px 16px', backgroundColor: deletingAllocation ? '#9ca3af' : '#fee2e2', color: deletingAllocation ? 'white' : '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{deletingAllocation ? 'Clearing...' : 'Clear All'}</button>}
            </div>
          </div>
        </div>

        {/* Add allocation (admin only) */}
        {isAdmin && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 20 }}>Add New Allocation</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Start Time</label>
                <select value={slot} onChange={(e) => setSlot(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Type</label>
                <select value={allocationType} onChange={(e) => handleAllocationTypeChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="training">Training</option>
                  <option value="game">Game</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Team</label>
                <select value={team} onChange={(e) => handleTeamChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="">Select a team</option>
                  {teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Duration</label>
                <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10))} disabled={allocationType === 'game'} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, backgroundColor: allocationType === 'game' ? '#f9fafb' : 'white' }}>
                  {durationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>{allocationType === 'training' ? 'Section' : 'Layout'}</label>
                {allocationType === 'training' ? (
                  <select value={section} onChange={(e) => setSection(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    {showGrassArea[normalizedPitchId] && <option value="grass">Grass Area</option>}
                  </select>
                ) : (
                  <select value={sectionGroup} onChange={(e) => setSectionGroup(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    {team && getSectionOptions(team).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={addAllocation} disabled={hasConflict || !team || savingAllocation} style={{ padding: '12px 24px', backgroundColor: hasConflict || !team ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: hasConflict || !team || savingAllocation ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 600 }}>
                {savingAllocation ? 'Saving...' : hasConflict ? 'Time Conflict' : `Add ${allocationType === 'training' ? 'Training' : 'Game'}`}
              </button>
              {hasConflict && <p style={{ color: '#ef4444', marginTop: 8 }}>This time slot conflicts with an existing allocation</p>}
            </div>
          </div>
        )}

        {/* Time slots & pitch visuals */}
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{currentPitchName} - {new Date(date).toLocaleDateString()}</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setAllSlotsExpanded(true)} style={{ padding: '8px 16px' }}>Expand All</button>
              <button onClick={() => setAllSlotsExpanded(false)} style={{ padding: '8px 16px' }}>Collapse All</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slots.map(timeSlot => {
              const slotAlloc = Object.entries(allocations).filter(([k]) => k.includes(`-${timeSlot}-`));
              const hasAlloc = slotAlloc.length > 0;
              return (
                <div key={timeSlot} style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div onClick={() => toggleSlotExpanded(timeSlot)} style={{ padding: '12px 16px', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        backgroundColor: hasAlloc ? '#dbeafe' : '#f3f4f6',
                        color: hasAlloc ? '#1e40af' : '#6b7280',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontWeight: 500
                      }}>{timeSlot}</span>
                      {hasAlloc ? <span style={{ color: '#6b7280' }}>{[...new Set(slotAlloc.map(([, a]) => a.team))].join(', ')}</span> : <span style={{ color: '#9ca3af' }}>Available</span>}
                    </div>
                    <div style={{ transform: expandedSlots[timeSlot] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                  </div>

                  {expandedSlots[timeSlot] && (
                    <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      {renderPitchSection(timeSlot)}

                      {showGrassArea[normalizedPitchId] ? (
                        <div style={{ width: 280, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, height: 104 }}>
                          <div style={{ position: 'relative', backgroundColor: '#dcfce7', border: '4px solid white', borderRadius: 8, padding: 8 }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#bbf7d0', borderRadius: 8 }} />
                            <div style={{ position: 'relative', zIndex: 10, height: '100%' }}>
                              {(() => {
                                const key = `${date}-${timeSlot}-${normalizedPitchId}-grass`;
                                const allocation = allocations[key];
                                const isDeleting = deletingKeys.has(key);
                                return (
                                  <div onClick={() => allocation && userRole === 'admin' && !isDeleting && clearAllocation(key)} title={allocation ? `${allocation.team} (${allocation.duration}min)` : 'Grass Area - Available'} style={{
                                    height: '100%', border: '2px solid white', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, backgroundColor: allocation ? (allocation.colour || allocation.color || '#ddd') + '90' : 'rgba(255,255,255,0.1)', borderColor: allocation ? (allocation.colour || allocation.color || '#ddd') : 'rgba(255,255,255,0.5)', color: allocation ? (isLightColor(allocation.colour || allocation.color) ? '#000' : '#fff') : '#374151', opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? 'none' : 'auto', position: 'relative'
                                  }}>
                                    {allocation && <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, backgroundColor: allocation.type === 'training' ? '#3b82f6' : '#ef4444', color: 'white', fontSize: 8, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2 }}>{allocation.type === 'training' ? 'T' : 'M'}</div>}
                                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4, fontWeight: 'bold' }}>GRASS</div>
                                    <div style={{ textAlign: 'center', padding: '0 4px', fontSize: 12 }}>{allocation ? (isDeleting ? 'Removing...' : allocation.team) : ''}</div>
                                    {allocation && allocation.isMultiSlot && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{allocation.duration}min</div>}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div />
                        </div>
                      ) : <div style={{ height: 104, width: 280 }} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Share dialog */}
        <ShareDialog />
      </div>
    </div>
  );
};

export default UnifiedPitchAllocator;
