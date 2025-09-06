// Mobile-optimized ShareView.jsx with satellite map and clickable pitches

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

// Function to get shared allocation data
const getSharedAllocation = async (shareId) => {
  try {
    // Try to get from localStorage first (for testing/demo)
    const localData = localStorage.getItem(`shared_allocation_${shareId}`);
    if (localData) {
      return JSON.parse(localData);
    }

    // If not in localStorage, try to fetch from API
    const response = await fetch(`/api/shares/${shareId}`);
    if (!response.ok) {
      throw new Error(`Share not found (${response.status})`);
    }
    
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching shared allocation:', error);
    
    // Fallback: Return mock data for demonstration
    if (shareId === 'demo' || process.env.NODE_ENV === 'development') {
      return {
        allocations: {
          '2025-09-06-09:00-pitch1-A': {
            team: 'Under 10',
            colour: '#00AA00',
            duration: 60,
            isMultiSlot: false
          },
          '2025-09-06-10:00-pitch1-B': {
            team: 'Under 12 YPL',
            colour: '#FFD700',
            duration: 60,
            isMultiSlot: false
          }
        },
        date: '2025-09-06',
        clubName: 'Demo Soccer Club',
        type: 'training',
        pitches: ['pitch1', 'pitch2'],
        pitchNames: {
          'pitch1': 'Main Training Pitch',
          'pitch2': 'Secondary Pitch'
        }
      };
    }
    
    throw new Error(error.message || 'Failed to load shared allocation');
  }
};

// Pitch layout positions (same as main app)
const pitchPositions = {
  pitch1: { top: '15%', left: '10%', width: '35%', height: '25%' },
  pitch2: { top: '15%', left: '55%', width: '35%', height: '25%' },
  pitch3: { top: '45%', left: '10%', width: '35%', height: '25%' },
  pitch4: { top: '45%', left: '55%', width: '35%', height: '25%' },
  pitch5: { top: '75%', left: '10%', width: '35%', height: '20%' },
  pitch6: { top: '75%', left: '55%', width: '35%', height: '20%' },
  pitch7: { top: '5%', left: '30%', width: '40%', height: '30%' },
  pitch8: { top: '40%', left: '30%', width: '40%', height: '30%' },
  pitch9: { top: '75%', left: '30%', width: '40%', height: '20%' },
  pitch10: { top: '35%', left: '20%', width: '60%', height: '35%' },
};

function ShareView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'pitch'

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const data = await getSharedAllocation(shareId);
        
        console.log('=== SHARE DATA DEBUG ===');
        console.log('Full data:', data);
        
        // Extract pitches from allocation keys
        let availablePitches = [];
        let extractedDate = data?.date;
        
        if (data?.allocations && Object.keys(data.allocations).length > 0) {
          const pitchSet = new Set();
          const dateSet = new Set();
          const timeSet = new Set();
          
          Object.keys(data.allocations).forEach(key => {
            const parts = key.split('-');
            
            parts.forEach((part, index) => {
              if (part.match(/^\d{4}/) && part.length >= 8) {
                dateSet.add(part);
              } else if (part.match(/^\d{2}:\d{2}$/)) {
                timeSet.add(part);
              } else if (index > 0 && !sections.includes(part.toUpperCase())) {
                // Check if this could be a pitch
                let pitchId = part;
                if (/^\d+$/.test(pitchId)) {
                  pitchId = `pitch${pitchId}`;
                  pitchSet.add(pitchId);
                } else if (pitchId.startsWith('pitch')) {
                  pitchSet.add(pitchId);
                }
              }
            });
          });
          
          if (data.pitches && Array.isArray(data.pitches)) {
            data.pitches.forEach(p => {
              let normalizedPitch = p;
              if (/^\d+$/.test(p)) {
                normalizedPitch = `pitch${p}`;
              }
              pitchSet.add(normalizedPitch);
            });
          }
          
          availablePitches = Array.from(pitchSet).sort((a, b) => {
            const aNum = parseInt(a.replace(/\D/g, ''));
            const bNum = parseInt(b.replace(/\D/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            return a.localeCompare(b);
          });
          
          if (dateSet.size > 0 && !extractedDate) {
            extractedDate = Array.from(dateSet)[0];
          }
        }
        
        const updatedData = {
          ...data,
          pitches: availablePitches,
          date: extractedDate || data?.date || new Date().toISOString().split('T')[0]
        };
        
        setSharedData(updatedData);
        
      } catch (err) {
        console.error('Error loading shared data:', err);
        setError(err.message || 'Failed to load shared allocation');
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedData();
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ 
        padding: '16px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', color: '#374151', marginBottom: '8px' }}>
            Loading allocation...
          </h2>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '14px' : '16px' }}>
            Please wait while we fetch the shared data
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2'
      }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', color: '#dc2626', marginBottom: '8px' }}>
            Error Loading Share
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '24px', fontSize: isMobile ? '14px' : '16px' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 24px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const allocations = sharedData?.allocations || {};
  const date = sharedData?.date || new Date().toISOString().split('T')[0];
  const clubName = sharedData?.clubName || 'Soccer Club';
  const allocationType = sharedData?.type === 'match' ? 'Match Day' : sharedData?.type === 'training' ? 'Training' : 'Pitch';
  const pitches = sharedData?.pitches || [];
  const pitchNames = sharedData?.pitchNames || {};
  const satelliteImage = sharedData?.satelliteImage;
  
  // Extract time range
  let start = 9;
  let end = 18;
  let timeInterval = 30;
  
  const actualTimeSlots = new Set();
  
  if (Object.keys(allocations).length > 0) {
    Object.keys(allocations).forEach(key => {
      const parts = key.split('-');
      parts.forEach(part => {
        if (part && part.match(/^\d{2}:\d{2}$/)) {
          actualTimeSlots.add(part);
        }
      });
    });
    
    const sortedTimes = Array.from(actualTimeSlots).sort();
    
    if (sortedTimes.length > 0) {
      const firstTime = sortedTimes[0];
      const lastTime = sortedTimes[sortedTimes.length - 1];
      
      start = parseInt(firstTime.split(':')[0]) || 9;
      const lastHour = parseInt(lastTime.split(':')[0]) || 17;
      end = Math.min(lastHour + 2, 21);
      
      if (sortedTimes.length > 1) {
        const has15MinIntervals = sortedTimes.some(t => t.endsWith(':15') || t.endsWith(':45'));
        if (has15MinIntervals) {
          timeInterval = 15;
        }
      }
    }
  }
  
  const timeSlots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += timeInterval) {
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Allocation lookup
  const findAllocation = (timeSlot, pitchId, section) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchNum}-${section}`,
      `${date}-${timeSlot}-pitch${pitchNum}-${section}`,
      `${timeSlot}-${pitchNum}-${section}`,
      `${timeSlot}-pitch${pitchNum}-${section}`,
    ];
    
    for (const key of possibleKeys) {
      if (allocations[key]) {
        return allocations[key];
      }
    }
    
    return null;
  };

  const hasAllocationsForTimeSlot = (timeSlot, pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchNum}`,
      `${date}-${timeSlot}-pitch${pitchNum}`,
      `${timeSlot}-${pitchNum}`,
      `${timeSlot}-pitch${pitchNum}`,
    ];
    
    return Object.keys(allocations).some(key => {
      return possibleKeys.some(pattern => key.startsWith(pattern + '-'));
    });
  };

  const getAllocationsCountForPitch = (pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    let count = 0;
    Object.keys(allocations).forEach(key => {
      const parts = key.split('-');
      for (let i = 0; i < parts.length - 1; i++) {
        if ((parts[i] === pitchNum || parts[i] === `pitch${pitchNum}`) && 
            sections.includes(parts[i + 1].toUpperCase())) {
          count++;
          break;
        }
      }
    });
    
    return count;
  };

  const getPitchDisplayName = (pitchId) => {
    if (pitchNames[pitchId]) {
      return pitchNames[pitchId];
    }
    
    if (pitchId.startsWith('pitch')) {
      const num = pitchId.replace('pitch', '');
      return `Pitch ${num}`;
    }
    
    return pitchId;
  };

  // Render satellite map view
  const renderMapView = () => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: isMobile ? '12px' : '20px',
      marginTop: '16px'
    }}>
      <h2 style={{
        fontSize: isMobile ? '16px' : '20px',
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: '12px',
        textAlign: 'center'
      }}>
        Select Your Pitch
      </h2>
      
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Satellite/Map Background */}
        {satelliteImage ? (
          <img 
            src={satelliteImage} 
            alt="Field Map"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            paddingTop: '60%', // Aspect ratio
            backgroundColor: '#10b981',
            backgroundImage: 'linear-gradient(0deg, #10b981 0%, #059669 100%)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              opacity: 0.5
            }}>
              Field Overview
            </div>
          </div>
        )}
        
        {/* Clickable Pitch Overlays */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}>
          {pitches.map(pitchId => {
            const position = pitchPositions[pitchId] || {
              top: '50%',
              left: '50%',
              width: '30%',
              height: '20%'
            };
            
            const allocCount = getAllocationsCountForPitch(pitchId);
            const hasAllocations = allocCount > 0;
            
            return (
              <button
                key={pitchId}
                onClick={() => {
                  setSelectedPitch(pitchId);
                  setViewMode('pitch');
                }}
                style={{
                  position: 'absolute',
                  top: position.top,
                  left: position.left,
                  width: position.width,
                  height: position.height,
                  backgroundColor: hasAllocations ? 'rgba(59, 130, 246, 0.3)' : 'rgba(229, 231, 235, 0.3)',
                  border: hasAllocations ? '3px solid #3b82f6' : '2px solid #9ca3af',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  transition: 'all 0.2s',
                  minHeight: '60px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = hasAllocations ? 
                    'rgba(59, 130, 246, 0.5)' : 'rgba(229, 231, 235, 0.5)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = hasAllocations ? 
                    'rgba(59, 130, 246, 0.3)' : 'rgba(229, 231, 235, 0.3)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{
                  backgroundColor: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}>
                  <div style={{
                    fontSize: isMobile ? '12px' : '14px',
                    fontWeight: 'bold',
                    color: hasAllocations ? '#1e40af' : '#6b7280'
                  }}>
                    {getPitchDisplayName(pitchId)}
                  </div>
                  {hasAllocations && (
                    <div style={{
                      fontSize: isMobile ? '10px' : '12px',
                      color: '#6b7280',
                      marginTop: '2px'
                    }}>
                      {allocCount} slots
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <p style={{
          fontSize: isMobile ? '12px' : '14px',
          color: '#6b7280',
          textAlign: 'center',
          margin: 0
        }}>
          Tap on your pitch to view allocations
        </p>
      </div>
    </div>
  );

  // Render pitch allocations view
  const renderPitchView = () => {
    if (!selectedPitch) return null;
    
    const pitchGridStyle = {
      position: 'relative',
      backgroundColor: '#dcfce7',
      border: '4px solid white',
      borderRadius: '8px',
      padding: isMobile ? '8px' : '16px',
      width: isMobile ? '100%' : '280px',
      maxWidth: isMobile ? '320px' : '280px',
      height: isMobile ? '280px' : '400px',
      margin: '0 auto'
    };
    
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginTop: '16px'
      }}>
        {/* Header with Back Button */}
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={() => {
              setViewMode('map');
              setSelectedPitch(null);
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← Back to Map
          </button>
          
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>
            {getPitchDisplayName(selectedPitch)}
          </h2>
          
          <span style={{
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {getAllocationsCountForPitch(selectedPitch)} slots
          </span>
        </div>
        
        {/* Allocations Grid */}
        <div style={{ padding: '4px' }}>
          {timeSlots.map((s) => {
            const hasAllocations = hasAllocationsForTimeSlot(s, selectedPitch);
            
            if (!hasAllocations && actualTimeSlots.size > 0 && !actualTimeSlots.has(s)) {
              return null;
            }
            
            return (
              <div key={s} style={{ marginBottom: isMobile ? '12px' : '8px' }}>
                <h3 style={{
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '4px',
                  textAlign: 'center'
                }}>
                  <span style={{
                    backgroundColor: hasAllocations ? '#dbeafe' : '#e5e7eb',
                    color: hasAllocations ? '#1e40af' : '#9ca3af',
                    padding: isMobile ? '2px 6px' : '4px 8px',
                    borderRadius: '9999px',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: hasAllocations ? '500' : '400',
                    opacity: hasAllocations ? 1 : 0.6
                  }}>
                    {s}
                  </span>
                </h3>
                
                {(hasAllocations || actualTimeSlots.has(s)) && (
                  <div style={pitchGridStyle}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#bbf7d0',
                      borderRadius: '8px'
                    }}></div>
                    
                    <div style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: 'repeat(4, 1fr)',
                      gap: isMobile ? '2px' : '4px',
                      height: '100%',
                      zIndex: 10
                    }}>
                      {sections.map((sec) => {
                        const alloc = findAllocation(s, selectedPitch, sec);
                        
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
                              fontSize: isMobile ? '10px' : '12px',
                              fontWeight: '500',
                              padding: '2px',
                              textAlign: 'center',
                              backgroundColor: alloc ? (alloc.colour || alloc.color) + '90' : 'rgba(255,255,255,0.1)',
                              borderColor: alloc ? (alloc.colour || alloc.color) : 'rgba(255,255,255,0.5)',
                              color: alloc ? (isLightColor(alloc.colour || alloc.color) ? '#000' : '#fff') : '#374151'
                            }}
                          >
                            <div style={{
                              fontSize: isMobile ? '10px' : '12px',
                              opacity: 0.75,
                              marginBottom: isMobile ? '2px' : '4px',
                              fontWeight: 'bold'
                            }}>{sec}</div>
                            <div style={{
                              textAlign: 'center',
                              padding: '0 2px',
                              fontSize: isMobile ? '10px' : '12px',
                              lineHeight: 1.2,
                              wordBreak: 'break-word'
                            }}>
                              {alloc ? alloc.team : ''}
                            </div>
                            {alloc && alloc.isMultiSlot && (
                              <div style={{
                                fontSize: isMobile ? '9px' : '12px',
                                opacity: 0.6,
                                marginTop: '2px'
                              }}>
                                {alloc.duration}min
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: isMobile ? '12px' : '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: isMobile ? '100%' : '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: isMobile ? '12px' : '24px'
        }}>
          <div style={{
            display: isMobile ? 'block' : 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h1 style={{
              fontSize: isMobile ? '20px' : '28px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0,
              marginBottom: isMobile ? '12px' : 0
            }}>
              {clubName} - {allocationType} Allocations
            </h1>
            {!isMobile && (
              <button
                onClick={() => window.print()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🖨️ Print
              </button>
            )}
          </div>
          
          <div style={{
            display: isMobile ? 'block' : 'flex',
            gap: '24px',
            fontSize: isMobile ? '12px' : '14px',
            color: '#6b7280'
          }}>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Date:</strong> {new Date(date).toLocaleDateString('en-US', {
                weekday: isMobile ? 'short' : 'long',
                month: isMobile ? 'short' : 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Time Range:</strong> {start}:00 - {end}:00
            </div>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Total Allocations:</strong> {Object.keys(allocations).length}
            </div>
            {pitches.length > 0 && (
              <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
                <strong>Active Pitches:</strong> {pitches.length}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {viewMode === 'map' ? renderMapView() : renderPitchView()}
      </div>
    </div>
  );
}

export default ShareView;
