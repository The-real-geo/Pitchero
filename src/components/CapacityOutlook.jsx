// src/components/capacityoutlook.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [capacityData, setCapacityData] = useState({});

  // Initialize to current week's Monday
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
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
                setClubName(clubData.name || 'Club');
                
                // Get pitches from satellite config
                if (clubData.satelliteConfig?.pitchBoundaries) {
                  const pitchList = clubData.satelliteConfig.pitchBoundaries.map((boundary, index) => ({
                    id: boundary.pitchNumber || `${index + 1}`,
                    name: `Pitch ${boundary.pitchNumber || index + 1}`
                  }));
                  setPitches(pitchList);
                }
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

  // Load allocations when club and week change
  useEffect(() => {
    if (!clubId || !currentWeekStart) return;

    const loadAllocations = async () => {
      setLoading(true);
      try {
        // Calculate week end (Sunday)
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Query allocations for the week
        const allocationsRef = collection(db, 'clubs', clubId, 'allocations');
        const q = query(
          allocationsRef,
          where('date', '>=', currentWeekStart.toISOString().split('T')[0]),
          where('date', '<=', weekEnd.toISOString().split('T')[0])
        );

        const snapshot = await getDocs(q);
        const allocs = {};
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const dateKey = data.date;
          if (!allocs[dateKey]) {
            allocs[dateKey] = {};
          }
          
          // Group by pitch and time period (AM/PM)
          const pitchId = data.pitchId || data.pitch;
          if (!allocs[dateKey][pitchId]) {
            allocs[dateKey][pitchId] = { am: [], pm: [] };
          }
          
          // Determine if AM or PM based on time
          const startTime = parseInt(data.startTime.split(':')[0]);
          const period = startTime < 12 ? 'am' : 'pm';
          allocs[dateKey][pitchId][period].push(data);
        });

        setAllocations(allocs);
        calculateCapacity(allocs);
      } catch (error) {
        console.error('Error loading allocations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllocations();
  }, [clubId, currentWeekStart]);

  // Calculate capacity percentages
  const calculateCapacity = (allocs) => {
    const capacity = {};
    
    // Define slot duration (e.g., 30 minutes per slot)
    const slotDuration = 0.5; // 30 minutes in hours
    
    // Calculate total available slots
    const amStartHour = 8;
    const amEndHour = 17;
    const pmStartHour = 17;
    const pmEndHour = 22; // Assuming evening activities end at 10pm
    
    const totalAMSlots = (amEndHour - amStartHour) / slotDuration; // 9 hours = 18 slots of 30 min
    const totalPMSlots = (pmEndHour - pmStartHour) / slotDuration; // 5 hours = 10 slots of 30 min

    // Generate dates for the week
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Calculate capacity for each pitch, date, and period
    pitches.forEach(pitch => {
      capacity[pitch.id] = {};
      
      dates.forEach(date => {
        capacity[pitch.id][date] = {
          am: 0,
          pm: 0
        };

        if (allocs[date] && allocs[date][`pitch${pitch.id}`]) {
          const pitchAllocs = allocs[date][`pitch${pitch.id}`];
          
          // Get all allocations for this pitch on this date
          const dayAllocs = [...(pitchAllocs.am || []), ...(pitchAllocs.pm || [])];
          
          let amSlotsUsed = 0;
          let pmSlotsUsed = 0;
          
          dayAllocs.forEach(alloc => {
            const startHour = parseFloat(alloc.startTime.split(':')[0]) + parseFloat(alloc.startTime.split(':')[1]) / 60;
            const endHour = parseFloat(alloc.endTime.split(':')[0]) + parseFloat(alloc.endTime.split(':')[1]) / 60;
            
            // Calculate slots used in AM period (8:00-17:00)
            if (startHour < amEndHour) {
              const amStart = Math.max(startHour, amStartHour);
              const amEnd = Math.min(endHour, amEndHour);
              if (amEnd > amStart) {
                amSlotsUsed += (amEnd - amStart) / slotDuration;
              }
            }
            
            // Calculate slots used in PM period (17:00-22:00)
            if (endHour > pmStartHour) {
              const pmStart = Math.max(startHour, pmStartHour);
              const pmEnd = Math.min(endHour, pmEndHour);
              if (pmEnd > pmStart) {
                pmSlotsUsed += (pmEnd - pmStart) / slotDuration;
              }
            }
          });
          
          // Calculate capacity percentages based on slots
          capacity[pitch.id][date].am = Math.min((amSlotsUsed / totalAMSlots) * 100, 100);
          capacity[pitch.id][date].pm = Math.min((pmSlotsUsed / totalPMSlots) * 100, 100);
        }
      });
    });

    setCapacityData(capacity);
  };

  // Get traffic light color based on capacity
  const getTrafficLightColor = (percentage) => {
    if (percentage >= 90) return '#ef4444'; // Red
    if (percentage >= 70) return '#f97316'; // Orange
    if (percentage >= 50) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // Format date for display
  const formatDateRange = () => {
    if (!currentWeekStart) return '';
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${currentWeekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}`;
  };

  // Get day abbreviations
  const getDayHeaders = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const headers = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      const dayNum = date.getDate();
      headers.push({
        day: days[i],
        date: dayNum,
        fullDate: date.toISOString().split('T')[0]
      });
    }
    
    return headers;
  };

  if (loading || !currentWeekStart) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div>Loading capacity data...</div>
      </div>
    );
  }

  const dayHeaders = getDayHeaders();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      gap: '0'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '250px',
        flexShrink: 0,
        backgroundColor: '#243665',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* User Info Section */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '12px'
          }}>
            {clubName || 'Loading...'}
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '4px'
          }}>
            {user?.email || 'Not logged in'}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            padding: '4px 8px',
            backgroundColor: userRole === 'admin' ? '#10b981' : '#6b7280',
            borderRadius: '4px',
            display: 'inline-block',
            marginTop: '4px'
          }}>
            {userRole === 'admin' ? 'Administrator' : userRole === 'viewer' ? 'Viewer' : 'User'}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }}></div>

        {/* Bottom navigation buttons */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => navigate('/club-pitch-map')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            🗺️ Pitch Map
          </button>

          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              marginTop: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            ⚙️ Settings
          </button>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#fca5a5',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              marginTop: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>
            Capacity Outlook
          </h1>

          {/* Week Navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <button
              onClick={goToPreviousWeek}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151'
              }}
            >
              <ChevronLeft size={16} />
              Previous 7 Days
            </button>

            <div style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '14px',
              color: '#1f2937'
            }}>
              {formatDateRange()}
            </div>

            <button
              onClick={goToNextWeek}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151'
              }}
            >
              Next 7 Days
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          display: 'flex',
          gap: '24px',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Capacity:</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#22c55e'
              }}></div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>≤50% (Available)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#eab308'
              }}></div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>50-70% (Moderate)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#f97316'
              }}></div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>70-90% (Busy)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#ef4444'
              }}></div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>90%+ (Full)</span>
            </div>
          </div>
        </div>

        {/* Capacity Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  backgroundColor: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Pitch
                </th>
                {dayHeaders.map(header => (
                  <th key={header.fullDate} colSpan="2" style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                    borderLeft: '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    <div>{header.day}</div>
                    <div style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280' }}>
                      {header.date}
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{
                  padding: '8px 12px',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#6b7280'
                }}></th>
                {dayHeaders.map(header => (
                  <React.Fragment key={`${header.fullDate}-periods`}>
                    <th style={{
                      padding: '8px',
                      textAlign: 'center',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      fontSize: '11px',
                      fontWeight: '500',
                      color: '#6b7280'
                    }}>
                      AM
                    </th>
                    <th style={{
                      padding: '8px',
                      textAlign: 'center',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      borderLeft: '1px solid #e5e7eb',
                      fontSize: '11px',
                      fontWeight: '500',
                      color: '#6b7280'
                    }}>
                      PM
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch, index) => (
                <tr key={pitch.id}>
                  <td style={{
                    padding: '12px',
                    borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>
                    {pitch.name}
                  </td>
                  {dayHeaders.map(header => {
                    const amCapacity = capacityData[pitch.id]?.[header.fullDate]?.am || 0;
                    const pmCapacity = capacityData[pitch.id]?.[header.fullDate]?.pm || 0;
                    
                    return (
                      <React.Fragment key={`${pitch.id}-${header.fullDate}`}>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: getTrafficLightColor(amCapacity),
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}>
                            <span style={{
                              fontSize: '10px',
                              color: 'white',
                              fontWeight: '600'
                            }}>
                              {Math.round(amCapacity)}%
                            </span>
                          </div>
                        </td>
                        <td style={{
                          padding: '8px',
                          textAlign: 'center',
                          borderBottom: index === pitches.length - 1 ? 'none' : '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: getTrafficLightColor(pmCapacity),
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}>
                            <span style={{
                              fontSize: '10px',
                              color: 'white',
                              fontWeight: '600'
                            }}>
                              {Math.round(pmCapacity)}%
                            </span>
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {pitches.length === 0 && (
            <div style={{
              padding: '48px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              No pitches configured. Please set up pitches in the satellite configuration.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default capacityoutlook;
