// Create this as a new file: src/components/ShareView.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedAllocation } from '../utils/firebase';

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];
const pitches = [
  { id: "pitch2", name: "Pitch 2 - Grass", hasGrassArea: true },
  { id: "pitch1", name: "Pitch 1 - Astro", hasGrassArea: false }
];

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
  const [expandedSlots, setExpandedSlots] = useState(new Set());

  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const data = await getSharedAllocation(shareId);
        setSharedData(data);
        
        // Auto-expand slots that have allocations
        if (data && data.allocations) {
          const slotsWithAllocations = new Set();
          Object.keys(data.allocations).forEach(key => {
            const parts = key.split('-');
            if (parts.length >= 2) {
              const timeSlot = parts[1];
              slotsWithAllocations.add(timeSlot);
            }
          });
          setExpandedSlots(slotsWithAllocations);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedData();
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ 
        padding: '24px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#374151', marginBottom: '8px' }}>
            Loading allocation...
          </h2>
          <p style={{ color: '#6b7280' }}>Please wait while we fetch the shared data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '24px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', color: '#dc2626', marginBottom: '8px' }}>
            Error Loading Share
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '24px' }}>{error}</p>
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
  const clubName = sharedData?.clubName || 'Unknown Club';
  const allocationType = sharedData?.type === 'match' ? 'Match Day' : 'Training';
  
  // Generate time slots based on allocation type
  const timeSlots = [];
  const start = sharedData?.type === 'match' ? 8 : 17;
  const end = 21;
  
  if (sharedData?.type === 'match') {
    for (let h = start; h < end; h++) {
      for (let m = 0; m < 60; m += 15) {
        const minutes = m.toString().padStart(2, '0');
        timeSlots.push(`${h}:${minutes}`);
      }
    }
    timeSlots.push(`${end}:00`);
  } else {
    for (let h = start; h < end; h++) {
      timeSlots.push(`${h}:00`, `${h}:30`);
    }
  }

  const hasAllocationsForTimeSlot = (timeSlot) => {
    return Object.keys(allocations).some(key => key.includes(`-${timeSlot}-`));
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: sharedData?.type === 'match' ? '#059669' : '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>
              {allocationType} Pitch Allocation - {clubName}
            </h1>
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
          </div>
          
          <div style={{
            display: 'flex',
            gap: '24px',
            fontSize: '14px',
            color: '#6b7280'
          }}>
            <div>
              <strong>Date:</strong> {new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div>
              <strong>Shared on:</strong> {new Date(sharedData.createdAt).toLocaleDateString()}
            </div>
            <div>
              <strong>Expires:</strong> {new Date(sharedData.expiresAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Notice */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #60a5fa',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '14px',
          color: '#1e40af'
        }}>
          <strong>ℹ️ Read-Only View:</strong> This is a shared view of the pitch allocation. 
          Changes cannot be made from this page. This link will expire on {new Date(sharedData.expiresAt).toLocaleDateString()}.
        </div>

        {/* Pitch Layouts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px'
        }}>
          {pitches.map((p) => (
            <div key={p.id} style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '8px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  margin: 0
                }}>{p.name}</h2>
              </div>
              
              <div style={{ padding: '4px' }}>
                {timeSlots.map((s) => {
                  const hasAllocations = hasAllocationsForTimeSlot(s);
                  const isExpanded = expandedSlots.has(s);
                  
                  if (!hasAllocations) return null;
                  
                  return (
                    <div key={s} style={{ marginBottom: '8px' }}>
                      <h3 style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '4px',
                        textAlign: 'center'
                      }}>
                        <span style={{
                          backgroundColor: sharedData?.type === 'match' ? '#fed7aa' : '#dbeafe',
                          color: sharedData?.type === 'match' ? '#9a3412' : '#1e40af',
                          padding: '4px 8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {s}
                        </span>
                      </h3>
                      
                      {isExpanded && (
                        <div style={{
                          position: 'relative',
                          backgroundColor: '#dcfce7',
                          border: '4px solid white',
                          borderRadius: '8px',
                          padding: '16px',
                          width: '280px',
                          height: '400px',
                          margin: '0 auto'
                        }}>
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
                            gap: '4px',
                            height: '100%',
                            zIndex: 10
                          }}>
                            {sections.map((sec) => {
                              const key = `${date}-${s}-${p.id}-${sec}`;
                              const alloc = allocations[key];
                              
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
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    padding: '2px',
                                    textAlign: 'center',
                                    backgroundColor: alloc ? alloc.colour + '90' : 'rgba(255,255,255,0.1)',
                                    borderColor: alloc ? alloc.colour : 'rgba(255,255,255,0.5)',
                                    color: alloc ? (isLightColor(alloc.colour) ? '#000' : '#fff') : '#374151'
                                  }}
                                >
                                  <div style={{
                                    fontSize: '12px',
                                    opacity: 0.75,
                                    marginBottom: '4px',
                                    fontWeight: 'bold'
                                  }}>{sec}</div>
                                  <div style={{
                                    textAlign: 'center',
                                    padding: '0 4px',
                                    fontSize: '12px',
                                    lineHeight: 1.2
                                  }}>
                                    {alloc ? alloc.team : ''}
                                  </div>
                                  {alloc && alloc.isMultiSlot && (
                                    <div style={{
                                      fontSize: '12px',
                                      opacity: 0.6,
                                      marginTop: '4px'
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
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShareView;