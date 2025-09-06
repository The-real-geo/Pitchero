// Mobile-optimized ShareView.jsx with responsive design and multi-pitch support

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
        
        // Debug logging
        console.log('Loaded share data:', data);
        console.log('Allocations:', data?.allocations);
        console.log('Sample allocation keys:', Object.keys(data?.allocations || {}).slice(0, 5));
        
        // Extract pitches from allocations if not provided
        let availablePitches = data?.pitches || [];
        
        if (availablePitches.length === 0 && data?.allocations) {
          // Extract unique pitch IDs from allocation keys
          const pitchSet = new Set();
          const pitchPattern = /^[^-]+-[^-]+-([^-]+)-[^-]+$/; // date-time-pitch-section pattern
          
          Object.keys(data.allocations).forEach(key => {
            // Try different patterns to extract pitch ID
            const parts = key.split('-');
            
            // Log first few keys for debugging
            if (pitchSet.size === 0) {
              console.log('Sample key:', key, 'Parts:', parts);
            }
            
            // Common patterns:
            // 1. date-time-pitch-section (4 parts)
            // 2. date-time-pitchId-section (4 parts where pitchId might be like "pitch1" or "pitch06")
            
            if (parts.length >= 4) {
              // The pitch ID is typically the third part (index 2)
              let pitchId = parts[2];
              
              // Clean up the pitch ID if needed
              if (pitchId && pitchId !== 'undefined' && pitchId !== '') {
                // If it's just a number like "06", prepend "pitch"
                if (/^\d+$/.test(pitchId)) {
                  pitchId = `pitch${pitchId}`;
                }
                pitchSet.add(pitchId);
              }
            }
          });
          
          availablePitches = Array.from(pitchSet).sort();
          console.log('Extracted pitches:', availablePitches);
        }
        
        // Update the shared data with extracted pitches
        const updatedData = {
          ...data,
          pitches: availablePitches
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
  
  // Get pitches - now properly extracted
  const pitches = sharedData?.pitches || [];
  const pitchNames = sharedData?.pitchNames || {};
  const showGrassArea = sharedData?.showGrassArea || {};
  
  // Extract time range and interval from actual allocations
  let start = sharedData?.timeRange?.start;
  let end = sharedData?.timeRange?.end;
  let timeInterval = 30; // Default to 30 minutes
  
  // Detect actual time slots used in allocations
  const actualTimeSlots = new Set();
  
  if (Object.keys(allocations).length > 0) {
    Object.keys(allocations).forEach(key => {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const timeStr = parts[1];
        if (timeStr && timeStr.includes(':')) {
          actualTimeSlots.add(timeStr);
        }
      }
    });
    
    // Convert to sorted array
    const sortedTimes = Array.from(actualTimeSlots).sort();
    console.log('Actual time slots found:', sortedTimes);
    
    if (sortedTimes.length > 0) {
      // Determine start and end times
      const firstTime = sortedTimes[0];
      const lastTime = sortedTimes[sortedTimes.length - 1];
      
      start = parseInt(firstTime.split(':')[0]) || 9;
      const lastHour = parseInt(lastTime.split(':')[0]) || 17;
      end = Math.min(lastHour + 2, 21); // Add buffer, max 21:00
      
      // Detect interval (15 or 30 minutes)
      if (sortedTimes.length > 1) {
        // Check if we have :15 or :45 minutes
        const has15MinIntervals = sortedTimes.some(t => t.endsWith(':15') || t.endsWith(':45'));
        if (has15MinIntervals) {
          timeInterval = 15;
        }
      }
    }
  }
  
  // Use defaults if still not set
  start = start || 9;
  end = end || 18;
  
  // Generate time slots based on detected interval
  const timeSlots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += timeInterval) {
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // More flexible allocation matching
  const hasAllocationsForTimeSlot = (timeSlot, pitchId) => {
    // Check both the exact pitch ID and possible variations
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchId}`,  // Base pattern
      `${date}-${timeSlot}-${pitchId.replace('pitch', '')}`, // Without 'pitch' prefix
      `${date}-${timeSlot}-pitch${pitchId}`, // With 'pitch' prefix
    ];
    
    return Object.keys(allocations).some(key => {
      // Check if key starts with any of our patterns
      return possibleKeys.some(pattern => key.startsWith(pattern + '-'));
    });
  };

  // Get allocation for a specific slot and section
  const getAllocation = (timeSlot, pitchId, section) => {
    // Try different key formats
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchId}-${section}`,
      `${date}-${timeSlot}-${pitchId.replace('pitch', '')}-${section}`,
      `${date}-${timeSlot}-pitch${pitchId}-${section}`,
    ];
    
    for (const key of possibleKeys) {
      if (allocations[key]) {
        return allocations[key];
      }
    }
    return null;
  };

  // Count allocations per pitch for display
  const getAllocationsCountForPitch = (pitchId) => {
    const patterns = [
      `-${pitchId}-`,
      `-${pitchId.replace('pitch', '')}-`,
      `-pitch${pitchId}-`
    ];
    
    return Object.keys(allocations).filter(key => 
      patterns.some(pattern => key.includes(pattern))
    ).length;
  };

  // Calculate total unique allocations (not counting multi-slot duplicates)
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

  // Responsive styles
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
        
        // Only show time slots that actually have allocations
        if (!hasAllocations && actualTimeSlots.size > 0) {
          return null; // Skip empty slots if we have detected actual slots
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
            
            {hasAllocations && (
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
                    const alloc = getAllocation(s, pitchId, sec);
                    
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
                
                {/* Grass area if enabled */}
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
                          const grassAlloc = getAllocation(s, pitchId, 'grass');
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
      }).filter(Boolean)} {/* Remove null entries */}
    </div>
  );

  // Get proper pitch display name
  const getPitchDisplayName = (pitchId) => {
    if (pitchNames[pitchId]) {
      return pitchNames[pitchId];
    }
    
    // Handle various formats
    if (pitchId.startsWith('pitch')) {
      const num = pitchId.replace('pitch', '');
      return `Pitch ${num}`;
    }
    
    // If it's just a number
    if (/^\d+$/.test(pitchId)) {
      return `Pitch ${pitchId}`;
    }
    
    return pitchId;
  };

  // Debug info for development
  const showDebugInfo = true; // Set to false for production

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: isMobile ? '100%' : '1400px', margin: '0 auto' }}>
        {/* Debug Information */}
        {showDebugInfo && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px'
          }}>
            <strong>Debug Info:</strong>
            <div>Share ID: {shareId}</div>
            <div>Total Allocation Keys: {Object.keys(allocations).length}</div>
            <div>Unique Allocations: {uniqueAllocationCount}</div>
            <div>Pitches Found: {pitches.join(', ') || 'None'}</div>
            <div>Date: {date}</div>
            <div>Time Range: {start}:00 - {end}:00 (interval: {timeInterval}min)</div>
            <div>Actual Time Slots: {Array.from(actualTimeSlots).sort().slice(0, 5).join(', ')}...</div>
            <details>
              <summary>Sample Allocation Keys (first 10)</summary>
              <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                {JSON.stringify(Object.keys(allocations).slice(0, 10), null, 2)}
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
              <strong>Total Allocations:</strong> {uniqueAllocationCount}
            </div>
            {pitches.length > 0 && (
              <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
                <strong>Pitches:</strong> {pitches.length}
              </div>
            )}
            {sharedData?.expiresAt && (
              <div>
                <strong>Expires:</strong> {new Date(sharedData.expiresAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Pitch selector */}
        {isMobile && pitches.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              minWidth: 'min-content'
            }}>
              {pitches.map((pitchId) => {
                const allocCount = getAllocationsCountForPitch(pitchId);
                const displayName = getPitchDisplayName(pitchId);
                return (
                  <button
                    key={pitchId}
                    onClick={() => setSelectedPitch(pitchId)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: selectedPitch === pitchId ? '#3b82f6' : '#f3f4f6',
                      color: selectedPitch === pitchId ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: selectedPitch === pitchId ? 'bold' : 'normal',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '80px'
                    }}
                  >
                    <div>{displayName}</div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.8,
                      marginTop: '2px'
                    }}>
                      {allocCount} slots
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop: Grid of pitches, Mobile: Single selected pitch */}
        {isMobile ? (
          // Mobile: Show selected pitch
          selectedPitch && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '12px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{
                  fontSize: '14px',
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
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {getAllocationsCountForPitch(selectedPitch)} allocations
                </span>
              </div>
              {renderPitchGrid(selectedPitch)}
            </div>
          )
        ) : (
          // Desktop: Grid layout for multiple pitches
          pitches.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: pitches.length <= 2 ? 'repeat(auto-fit, minmax(600px, 1fr))' : 
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
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: '#f3f4f6',
                      padding: '12px',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h2 style={{
                        fontSize: '14px',
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
          ) : null
        )}

        {/* No allocations message */}
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
            <p style={{ marginBottom: '8px' }}>
              This share link doesn't contain any pitch allocations.
            </p>
            <p style={{ fontSize: '14px' }}>
              Share ID: {shareId}
            </p>
          </div>
        )}

        {/* Show message if allocations exist but no pitches could be extracted */}
        {Object.keys(allocations).length > 0 && pitches.length === 0 && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#92400e', marginBottom: '12px' }}>
              Data Structure Issue
            </h3>
            <p style={{ color: '#78350f', marginBottom: '16px' }}>
              We found {Object.keys(allocations).length} allocation entries but couldn't determine the pitch layout.
            </p>
            <p style={{ fontSize: '12px', color: '#92400e' }}>
              Please regenerate the share link from the main application.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShareView;
