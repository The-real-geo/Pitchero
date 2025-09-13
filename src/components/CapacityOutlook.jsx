// src/components/CapacityOutlook.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CapacityOutlook = () => {
  const navigate = useNavigate();
  
  // State
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubName, setClubName] = useState('');
  const [pitches, setPitches] = useState([]);
  const [pitchNames, setPitchNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [capacityData, setCapacityData] = useState({});

  // ---------- utils ----------
  const normalizePitchId = (pitchId) => {
    if (!pitchId) return '';
    const id = String(pitchId);
    if (!id.startsWith('pitch')) return `pitch${id}`;
    return id.replace('pitch-', 'pitch');
  };

  // local YYYY-MM-DD (avoids UTC shift from toISOString)
  const toLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getPitchDisplayName = (pitchNumber, pitchNamesData) => {
    const normalizedId = normalizePitchId(pitchNumber);
    const possibleKeys = [
      normalizedId,
      `pitch${pitchNumber}`,
      `pitch-${pitchNumber}`,
      `Pitch ${pitchNumber}`,
      `Pitch-${pitchNumber}`,
      pitchNumber.toString(),
    ];
    for (const key of possibleKeys) {
      if (pitchNamesData && pitchNamesData[key]) return pitchNamesData[key];
    }
    return `Pitch ${pitchNumber}`;
  };

  // Initialize to current week's Monday (local)
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Load user and club data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role || 'user');
            if (userData.clubId) {
              setClubId(userData.clubId);

              // Fetch club data
              const clubDoc = await getDoc(doc(db, 'clubs', userData.clubId));
              if (clubDoc.exists()) {
                const clubData = clubDoc.data();
                const name =
                  clubData.name ||
                  clubData.Name ||
                  clubData.clubName ||
                  clubData.ClubName ||
                  `Club ${userData.clubId}`;
                setClubName(name);

                // Pitches from satellite config
                if (clubData.satelliteConfig?.pitchBoundaries) {
                  const pitchList = clubData.satelliteConfig.pitchBoundaries.map((boundary, index) => ({
                    id: boundary.pitchNumber || `${index + 1}`,
                    name: `Pitch ${boundary.pitchNumber || index + 1}`,
                  }));
                  setPitches(pitchList);
                }
              }

              // Load settings including pitch names
              try {
                const settingsRef = doc(db, 'clubs', userData.clubId, 'settings', 'general');
                const settingsDoc = await getDoc(settingsRef);
                if (settingsDoc.exists()) {
                  const settingsData = settingsDoc.data();
                  console.log('Loaded settings with pitch names:', settingsData.pitchNames);
                  if (settingsData.pitchNames) setPitchNames(settingsData.pitchNames);
                  if (settingsData.clubName) setClubName(settingsData.clubName);
                }
              } catch (error) {
                console.error('Error loading settings:', error);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Parse the allocation key robustly from the end (handles dates with hyphens)
  const parseAllocationKey = (key) => {
    const parts = String(key).split('-');
    const [timeToken, pitchToken, section] = parts.slice(-3);
    return { timeToken, pitchToken, section };
  };

  // Calculate capacity for a specific pitch and date
  const calculatePitchCapacity = async (clubId, date, pitchNumber, isAM = true) => {
    const normalizedPitchId = normalizePitchId(pitchNumber);

    try {
      const trainingDocRef = doc(db, 'trainingAllocations', `${clubId}-${date}`);
      const matchDocRef = doc(db, 'matchAllocations', `${clubId}-${date}`);
      const [trainingDoc, matchDoc] = await Promise.all([
        getDoc(trainingDocRef),
        getDoc(matchDocRef),
      ]);

      let allocationsCount = 0;

      // time windows
      const amSlots = [];
      const pmSlots = [];
      for (let h = 8; h < 17; h++) {
        for (let m = 0; m < 60; m += 15) {
          amSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      }
      for (let h = 17; h <= 21; h++) {
        for (let m = 0; m < 60; m += 15) {
          if (h === 21 && m > 30) break; // 21:45 excluded
          pmSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      }
      const relevantSlots = isAM ? amSlots : pmSlots;
      const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const totalSlots = relevantSlots.length * sections.length;

      const countFromDoc = (snap) => {
        if (!snap.exists()) return 0;
        const data = snap.data();
        let count = 0;
        for (const key of Object.keys(data)) {
          const value = data[key];
          if (typeof value !== 'object') continue; // why: ignore placeholders/flags
          const { timeToken, pitchToken } = parseAllocationKey(key);
          const normalizedKeyPitch = normalizePitchId(pitchToken);
          if (normalizedKeyPitch !== normalizedPitchId) continue; // accept pitch-1 or pitch1
          if (relevantSlots.includes(timeToken)) count++;
        }
        return count;
      };

      allocationsCount += countFromDoc(trainingDoc);
      allocationsCount += countFromDoc(matchDoc);

      const usedPercentage = totalSlots > 0 ? Math.round((allocationsCount / totalSlots) * 100) : 0;
      console.log(
        `Pitch ${pitchNumber} on ${date} (${isAM ? 'AM' : 'PM'}): ${allocationsCount}/${totalSlots} slots = ${usedPercentage}%`
      );
      return usedPercentage;
    } catch (error) {
      console.error('Error calculating capacity:', error);
      return 0;
    }
  };

  // Load allocations when club and week change
  useEffect(() => {
    if (!clubId || !currentWeekStart || pitches.length === 0) return;

    const loadCapacityData = async () => {
      setLoading(true);
      try {
        const newCapacityData = {};

        // Generate local dates for the week (Mon..Sun)
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() + i);
          dates.push(toLocalYMD(d)); // why: avoid UTC day-1 shift
        }

        // Calculate capacity for each pitch and date
        for (const pitch of pitches) {
          newCapacityData[pitch.id] = {};
          for (const date of dates) {
            const amCapacity = await calculatePitchCapacity(clubId, date, pitch.id, true);
            const pmCapacity = await calculatePitchCapacity(clubId, date, pitch.id, false);
            newCapacityData[pitch.id][date] = { am: amCapacity, pm: pmCapacity };
          }
        }

        console.log('Final capacity data:', newCapacityData);
        setCapacityData(newCapacityData);
      } catch (error) {
        console.error('Error loading capacity data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCapacityData();
  }, [clubId, currentWeekStart, pitches]);

  const getTrafficLightColor = (percentage) => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 70) return '#f97316';
    if (percentage >= 50) return '#eab308';
    return '#22c55e';
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const formatDateRange = () => {
    if (!currentWeekStart) return '';
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${currentWeekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
  };

  const getDayHeaders = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const headers = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      headers.push({ day: days[i], date: d.getDate(), fullDate: toLocalYMD(d) });
    }
    return headers;
  };

  if (loading || !currentWeekStart) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f9fafb' }}>
        <div>Loading capacity data...</div>
      </div>
    );
  }

  const dayHeaders = getDayHeaders();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, sans-serif', display: 'flex', gap: '0' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', flexShrink: 0, backgroundColor: '#243665', height: '100vh', position: 'sticky', top: 0, left: 0, display: 'flex', flexDirection: 'column' }}>
        {/* User Info Section */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>
            {clubName || 'Loading...'}
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>
            {user?.email || 'Not logged in'}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', padding: '4px 8px', backgroundColor: userRole === 'admin' ? '#10b981' : '#6b7280', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
            {userRole === 'admin' ? 'Administrator' : userRole === 'viewer' ? 'Viewer' : 'User'}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom navigation buttons */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => navigate('/club-pitch-map')}
            style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '14px', color: 'white', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          >
            🗺️ Pitch Map
          </button>

          <button
            onClick={() => navigate('/settings')}
            style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '14px', color: 'white', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease', marginTop: '8px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          >
            ⚙️ Settings
          </button>

          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '14px', color: '#fca5a5', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease', marginTop: '8px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '12px 24px 24px', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Capacity Outlook</h1>
        </div>

        {/* Week Bar */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
              {formatDateRange()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={goToPreviousWeek}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
            >
              <ChevronLeft size={16} />
              Previous 7 Days
            </button>
            <button
              onClick={goToNextWeek}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
            >
              Next 7 Days
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Capacity:</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>≤50% (Available)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#eab308' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>50-70% (Moderate)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#f97316' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>70-90% (Busy)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>90%+ (Full)</span>
            </div>
          </div>
        </div>

        {/* Capacity Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Pitch
                </th>
                {dayHeaders.map((header) => (
                  <th key={header.fullDate} colSpan="2" style={{ padding: '12px 8px', textAlign: 'center', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    <div>{header.day}</div>
                    <div style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280' }}>{header.date}</div>
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{ padding: '8px 12px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}></th>
                {dayHeaders.map((header) => (
                  <React.Fragment key={`${header.fullDate}-periods`}>
                    <th style={{ padding: '8px', textAlign: 'center', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', fontSize: '11px', fontWeight: '500', color: '#6b7280' }}>AM</th>
                    <th style={{ padding: '8px', textAlign: 'center', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', fontSize: '11px', fontWeight: '500', color: '#6b7280' }}>PM</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch, index) => {
                const displayName = getPitchDisplayName(pitch.id, pitchNames);
                return (
                  <tr key={pitch.id}>
                    <td style={{ padding: '12px', borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                      {displayName}
                    </td>
                    {dayHeaders.map((header) => {
                      const amCapacity = capacityData[pitch.id]?.[header.fullDate]?.am || 0;
                      const pmCapacity = capacityData[pitch.id]?.[header.fullDate]?.pm || 0;
                      return (
                        <React.Fragment key={`${pitch.id}-${header.fullDate}`}>
                          <td
                            style={{ padding: '8px', textAlign: 'center', borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', cursor: 'pointer' }}
                            onClick={() => {
                              navigate(`/allocator/${pitch.id}?date=${header.fullDate}`);
                            }}
                            title={`Click to view allocations for ${displayName} on ${header.fullDate}`}
                          >
                            <div
                              style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: getTrafficLightColor(amCapacity), margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s ease' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <span style={{ fontSize: '10px', color: 'white', fontWeight: '600' }}>{Math.round(amCapacity)}%</span>
                            </div>
                          </td>
                          <td
                            style={{ padding: '8px', textAlign: 'center', borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb', borderLeft: '1px solid #e5e7eb', cursor: 'pointer' }}
                            onClick={() => {
                              // keep date consistent with AM
                              navigate(`/allocator/${pitch.id}?date=${header.fullDate}`);
                            }}
                            title={`Click to view allocations for ${displayName} on ${header.fullDate}`}
                          >
                            <div
                              style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: getTrafficLightColor(pmCapacity), margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s ease' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              <span style={{ fontSize: '10px', color: 'white', fontWeight: '600' }}>{Math.round(pmCapacity)}%</span>
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pitches.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              No pitches configured. Please set up pitches in the satellite configuration.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CapacityOutlook;
