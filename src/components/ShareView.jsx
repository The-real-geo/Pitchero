// Mobile-optimized ShareView.jsx with enhanced pitch navigation

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedAllocation } from '../utils/firebase';

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

function ShareView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'all' for desktop

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
        
        // Enhanced debug logging
        console.log('=== SHARE DATA DEBUG ===');
        console.log('Full data:', data);
        console.log('Allocations object:', data?.allocations);
        console.log('Number of allocations:', Object.keys(data?.allocations || {}).length);
        
        // Extract all unique pitches from allocation keys
        let availablePitches = data?.pitches || [];
        let extractedDate = data?.date;
        
        if (data?.allocations && Object.keys(data.allocations).length > 0) {
          const pitchSet = new Set();
          const dateSet = new Set();
          const timeSet = new Set();
          
          // Extract ALL pitches - be very thorough
          Object.keys(data.allocations).forEach(key => {
            console.log('Processing key:', key);
            const parts = key.split('-');
            
            // Try multiple extraction strategies
            if (parts.length >= 3) {
              // Check each part to see if it could be a pitch
              parts.forEach((part, index) => {
                // Skip obvious date/time parts
                if (part.match(/^\d{4}/) || part.match(/^\d{2}:\d{2}$/)) {
                  if (part.match(/^\d{4}/)) dateSet.add(part);
                  if (part.match(/^\d{2}:\d{2}$/)) timeSet.add(part);
                } else if (index === 2 || index === 1) {
                  // Likely pitch position
                  let pitchId = part;
                  
                  // Handle different pitch formats
                  if (/^\d+$/.test(pitchId)) {
                    // Just a number like "1", "2", "6"
                    pitchId = `pitch${pitchId}`;
                  } else if (pitchId.startsWith('pitch')) {
                    // Already formatted
                    pitchId = pitchId;
                  } else if (pitchId.match(/pitch\d+/)) {
                    // Contains pitch number
                    pitchId = pitchId.match(/pitch\d+/)[0];
                  }
                  
                  if (pitchId && pitchId !== 'undefined' && !sections.includes(pitchId.toUpperCase())) {
                    pitchSet.add(pitchId);
                  }
                }
              });
            }
          });
          
          // Also check if pitches are explicitly defined in the data
          if (data.pitches && Array.isArray(data.pitches)) {
            data.pitches.forEach(p => pitchSet.add(p));
          }
          
          // Convert to sorted array
          availablePitches = Array.from(pitchSet).sort((a, b) => {
            // Sort numerically if possible
            const aNum = parseInt(a.replace(/\D/g, ''));
            const bNum = parseInt(b.replace(/\D/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            return a.localeCompare(b);
          });
          
          // If we found dates in the keys, use the first one
          if (dateSet.size > 0 && !extractedDate) {
            extractedDate = Array.from(dateSet)[0];
          }
          
          console.log('Extracted pitches:', availablePitches);
          console.log('Extracted dates:', Array.from(dateSet));
          console.log('Extracted times (sample):', Array.from(timeSet).slice(0, 10));
        }
        
        // If we still don't have pitches, try to detect from standard patterns
        if (availablePitches.length === 0 && data?.allocations) {
          // Try common pitch IDs
          const commonPitches = ['pitch1', 'pitch2', 'pitch3', 'pitch4', 'pitch5', 'pitch6'];
          commonPitches.forEach(pitchId => {
            const hasThisPitch = Object.keys(data.allocations).some(key => 
              key.includes(`-${pitchId}-`) || 
              key.includes(`-${pitchId.replace('pitch', '')}-`)
            );
            if (hasThisPitch) {
              availablePitches.push(pitchId);
            }
          });
        }
        
        // Update the shared data with extracted values
        const updatedData = {
          ...data,
          pitches: availablePitches,
          date: extractedDate || data?.date || new Date().toISOString().split('T')[0]
        };
        
        setSharedData(updatedData);
        
        // Set initial selected pitch
        if (availablePitches.length > 0) {
          setSelectedPitch(availablePitches[0]);
        }
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
  
  // Get pitches
  const pitches = sharedData?.pitches || [];
  const pitchNames = sharedData?.pitchNames || {};
  const showGrassArea = sharedData?.showGrassArea || {};
  
  // Build allocation map for flexible lookup
  const allocationMap = {};
  Object.entries(allocations).forEach(([key, value]) => {
    allocationMap[key] = value;
    allocationMap[key.toLowerCase()] = value;
    // Store without date if present
    const parts = key.split('-');
    if (parts[0].match(/^\d{4}/) || parts[0].match(/^\d{2}/)) {
      const keyWithoutDate = parts.slice(1).join('-');
      allocationMap[keyWithoutDate] = value;
      allocationMap[keyWithoutDate.toLowerCase()] = value;
    }
  });
  
  // Extract time range
  let start = sharedData?.timeRange?.start;
  let end = sharedData?.timeRange?.end;
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
  
  start = start || 9;
  end = end || 18;
  
  const timeSlots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += timeInterval) {
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Flexible allocation lookup
  const findAllocation = (timeSlot, pitchId, section) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchId}-${section}`,
      `${date}-${timeSlot}-${pitchNum}-${section}`,
      `${date}-${timeSlot}-pitch${pitchNum}-${section}`,
      `${timeSlot}-${pitchId}-${section}`,
      `${timeSlot}-${pitchNum}-${section}`,
      `${timeSlot}-pitch${pitchNum}-${section}`,
    ];
    
    for (const key of possibleKeys) {
      if (allocationMap[key]) {
        return allocationMap[key];
      }
      if (allocationMap[key.toLowerCase()]) {
        return allocationMap[key.toLowerCase()];
      }
    }
    
    // Last resort: partial match
    const searchPattern = `${timeSlot}-${pitchNum}-${section}`;
    for (const [key, value] of Object.entries(allocationMap)) {
      if (key.includes(searchPattern)) {
        return value;
      }
    }
    
    return null;
  };

  const hasAllocationsForTimeSlot = (timeSlot, pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    return Object.keys(allocations).some(key => {
      return key.includes(timeSlot) && (
        key.includes(`-${pitchId}-`) ||
        key.includes(`-${pitchNum}-`) ||
        key.includes(`-pitch${pitchNum}-`)
      );
    });
  };

  const getAllocationsCountForPitch = (pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    return Object.keys(allocations).filter(key => 
      key.includes(`-${pitchId}-`) ||
      key.includes(`-${pitchNum}-`) ||
      key.includes(`-pitch${pitchNum}-`)
    ).length;
  };

  const calculateUniqueAllocations = () => {
    const uniqueAllocations = new Set();
    Object.entries(allocations).forEach(([key, alloc]) => {
      if (!alloc.isMultiSlot || alloc.slotIndex === 0) {
        uniqueAllocations.add(key);
      }
    });
    return uniqueAllocations.size;
  };

  const uniqueAllocationCount = calculateUniqueAllocations();

  // Styles
  const containerStyle = {
    padding: isMobile ? '12px' : '24px',
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif'
  };

  const headerStyle = {
    backgroundColor: 'white',
    padding: isMobile ? '16px' : '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: isMobile ? '12px' : '24px'
  };

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

  const renderPitchGrid = (pitchId) => (
    <div style={{ padding: '4px' }}>
      {timeSlots.map((s) => {
        const hasAllocations = hasAllocationsForTimeSlot(s, pitchId);
        
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
                    const alloc = findAllocation(s, pitchId, sec);
                    
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
                
                {showGrassArea[pitchId] && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px',
                      height: '60px'
                    }}>
                      <div style={{
                        position: 'relative',
                        backgroundColor: '#dcfce7',
                        border: '2px solid white',
                        borderRadius: '4px',
                        padding: '4px'
                      }}>
                        {(() => {
                          const grassAlloc = findAllocation(s, pitchId, 'grass');
                          return (
                            <div style={{
                              height: '100%',
                              border: '2px solid rgba(255,255,255,0.5)',
                              borderRadius: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '9px' : '11px',
                              backgroundColor: grassAlloc ? (grassAlloc.colour || grassAlloc.color) + '90' : 'rgba(255,255,255,0.1)',
                              color: grassAlloc ? (isLightColor(grassAlloc.colour || grassAlloc.color) ? '#000' : '#fff') : '#374151'
                            }}>
                              <div style={{ fontWeight: 'bold' }}>GRASS</div>
                              {grassAlloc && <div>{grassAlloc.team}</div>}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }).filter(Boolean)}
    </div>
  );

  const getPitchDisplayName = (pitchId) => {
    if (pitchNames[pitchId]) {
      return pitchNames[pitchId];
    }
    
    if (pitchId.startsWith('pitch')) {
      const num = pitchId.replace('pitch', '');
      return `Pitch ${num}`;
    }
    
    if (/^\d+$/.test(pitchId)) {
      return `Pitch ${pitchId}`;
    }
    
    return pitchId;
  };

  const showDebugInfo = false; // Set to true for debugging

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: isMobile ? '100%' : '1400px', margin: '0 auto' }}>
        {showDebugInfo && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '11px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <strong>Debug:</strong>
            <div>Pitches Found: {pitches.join(', ')}</div>
            <div>Selected Pitch: {selectedPitch}</div>
            <div>Total Allocations: {Object.keys(allocations).length}</div>
            <details>
              <summary>Sample Keys</summary>
              <pre style={{ fontSize: '9px' }}>
                {Object.keys(allocations).slice(0, 5).join('\n')}
              </pre>
            </details>
          </div>
        )}

        {/* Header */}
        <div style={headerStyle}>
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!isMobile && pitches.length > 1 && (
                <button
                  onClick={() => setViewMode(viewMode === 'single' ? 'all' : 'single')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {viewMode === 'single' ? 'View All Pitches' : 'View Single Pitch'}
                </button>
              )}
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
              <strong>Total Allocations:</strong> {uniqueAllocationCount}
            </div>
            {pitches.length > 0 && (
              <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
                <strong>Pitches:</strong> {pitches.length}
              </div>
            )}
          </div>
        </div>

        {/* Pitch Navigation - Always visible when multiple pitches */}
        {pitches.length > 1 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Select Pitch:
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              overflowX: isMobile ? 'auto' : 'visible'
            }}>
              {pitches.map((pitchId) => {
                const allocCount = getAllocationsCountForPitch(pitchId);
                const displayName = getPitchDisplayName(pitchId);
                const isSelected = selectedPitch === pitchId;
                
                return (
                  <button
                    key={pitchId}
                    onClick={() => setSelectedPitch(pitchId)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: isSelected ? '#3b82f6' : '#f3f4f6',
                      color: isSelected ? 'white' : '#374151',
                      border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '100px',
                      boxShadow: isSelected ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{displayName}</div>
                    <div style={{
                      fontSize: '12px',
                      opacity: 0.8,
                      marginTop: '4px'
                    }}>
                      {allocCount} allocations
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Single Pitch Display (for single pitch or when only one exists) */}
        {pitches.length === 1 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0
              }}>
                {getPitchDisplayName(pitches[0])}
              </h2>
              <span style={{
                fontSize: '14px',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                padding: '4px 12px',
                borderRadius: '6px'
              }}>
                {getAllocationsCountForPitch(pitches[0])} allocations
              </span>
            </div>
            {renderPitchGrid(pitches[0])}
          </div>
        )}

        {/* Multiple Pitches Display */}
        {pitches.length > 1 && (
          <>
            {/* Desktop: Show based on view mode */}
            {!isMobile && viewMode === 'all' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: pitches.length <= 2 ? 'repeat(auto-fit, minmax(500px, 1fr))' : 
                                    pitches.length <= 4 ? 'repeat(2, 1fr)' : 
                                    'repeat(3, 1fr)',
                gap: '16px'
              }}>
                {pitches.map((pitchId) => {
                  const displayName = getPitchDisplayName(pitchId);
                  return (
                    <div key={pitchId} style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      border: selectedPitch === pitchId ? '2px solid #3b82f6' : '2px solid transparent'
                    }}>
                      <div style={{
                        backgroundColor: '#f3f4f6',
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedPitch(pitchId)}
                      >
                        <h2 style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#1f2937',
                          margin: 0
                        }}>
                          {displayName}
                        </h2>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          {getAllocationsCountForPitch(pitchId)} allocations
                        </span>
                      </div>
                      {renderPitchGrid(pitchId)}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop single view or Mobile view - Show selected pitch */
              selectedPitch && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#1f2937',
                      margin: 0
                    }}>
                      {getPitchDisplayName(selectedPitch)}
                    </h2>
                    <span style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      padding: '4px 12px',
                      borderRadius: '6px'
                    }}>
                      {getAllocationsCountForPitch(selectedPitch)} allocations
                    </span>
                  </div>
                  {renderPitchGrid(selectedPitch)}
                </div>
              )
            )}
          </>
        )}

        {/* No pitches found */}
        {pitches.length === 0 && Object.keys(allocations).length > 0 && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#92400e', marginBottom: '12px' }}>
              Unable to detect pitches
            </h3>
            <p style={{ color: '#78350f', marginBottom: '16px' }}>
              We found {Object.keys(allocations).length} allocations but couldn't identify the pitches.
            </p>
            <p style={{ fontSize: '12px', color: '#92400e' }}>
              Please regenerate the share link from the main application.
            </p>
          </div>
        )}

        {/* No allocations */}
        {Object.keys(allocations).length === 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>
              No allocations found
            </h3>
            <p>This share link doesn't contain any pitch allocations.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareView;
