import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom"
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useFirebaseAllocations } from '../hooks/useFirebaseAllocations';

const pitches = [
  { id: "pitch2", name: "Pitch 2 - Grass", hasGrassArea: true },
  { id: "pitch1", name: "Pitch 1 - Astro", hasGrassArea: false }
];

const defaultTeams = [
  { name: "Under 6", color: "#00FFFF" },
  { name: "Under 8", color: "#FF0000" },
  { name: "Under 9", color: "#0000FF" },
  { name: "Under 10", color: "#00AA00" },
  { name: "Under 11 - Red", color: "#CC0000" },
  { name: "Under 11 - Black", color: "#000000" },
  { name: "Under 12 YPL", color: "#FFD700" },
  { name: "Under 12 YSL", color: "#FF6600" },
  { name: "Under 13 YCC", color: "#8B00FF" },
  { name: "Under 14 YCC", color: "#FF1493" },
  { name: "Under 14 YSL", color: "#00CED1" },
  { name: "Under 15 YCC", color: "#8B4513" },
  { name: "Under 16 YCC", color: "#696969" }
];

function getDefaultPitchAreaForTeam(teamName) {
  if (teamName.includes('Under 6') || teamName.includes('Under 7')) {
    return 'Under 6 & 7';
  } else if (teamName.includes('Under 8') || teamName.includes('Under 9')) {
    return 'Under 8 & 9';
  } else if (teamName.includes('Under 10') || teamName.includes('Under 11') || teamName.includes('Under 12') || teamName.includes('Under 13')) {
    return 'Under 10-13';
  } else if (teamName.includes('Under 14') || teamName.includes('Under 15') || teamName.includes('Under 16')) {
    return 'Under 14+';
  } else {
    return 'Under 10-13';
  }
}

function Settings({ onBack }) {
  const navigate = useNavigate();
  const { userProfile, clubInfo } = useFirebaseAllocations('trainingAllocations');
  
  // Auth state
  const [user, setUser] = useState(null);
  
  // State for teams
  const [teams, setTeams] = useState(defaultTeams);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6');

  // State for pitch configurations
  const [pitchOrientations, setPitchOrientations] = useState({
    'pitch1': 'portrait',
    'pitch2': 'portrait'
  });
  const [showGrassArea, setShowGrassArea] = useState({
    'pitch1': false,
    'pitch2': true
  });

  // State for match day settings
  const [matchDayPitchAreaRequired, setMatchDayPitchAreaRequired] = useState(() => {
    const defaults = {};
    defaultTeams.forEach(team => {
      defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
    });
    return defaults;
  });

  // Auth monitoring
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Copy club ID to clipboard
  const copyClubId = () => {
    if (clubInfo?.clubId) {
      navigator.clipboard.writeText(clubInfo.clubId);
      alert('Club ID copied to clipboard!');
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      const newTeam = {
        name: newTeamName.trim(),
        color: newTeamColor
      };
      setTeams(prev => [...prev, newTeam]);
      setMatchDayPitchAreaRequired(prev => ({
        ...prev,
        [newTeam.name]: getDefaultPitchAreaForTeam(newTeam.name)
      }));
      setNewTeamName('');
      setNewTeamColor('#3B82F6');
    }
  };

  const removeTeam = (teamName) => {
    setTeams(prevTeams => prevTeams.filter(team => team.name !== teamName));
    setMatchDayPitchAreaRequired(prev => {
      const updated = { ...prev };
      delete updated[teamName];
      return updated;
    });
  };

  const updatePitchOrientation = (pitchId, orientation) => {
    setPitchOrientations(prev => ({
      ...prev,
      [pitchId]: orientation
    }));
  };

  const updateGrassAreaVisibility = (pitchId, visible) => {
    setShowGrassArea(prev => ({
      ...prev,
      [pitchId]: visible
    }));
  };

  const updateMatchDayPitchAreaRequired = (teamName, pitchAreaReq) => {
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [teamName]: pitchAreaReq
    }));
  };

  const generateRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setNewTeamColor(randomColor);
  };

  const exportSettings = () => {
    const settingsData = {
      teams,
      pitchOrientations,
      showGrassArea,
      matchDayPitchAreaRequired,
      exportDate: new Date().toISOString(),
      appVersion: "PitcHero Settings v1.0"
    };
    
    const dataStr = JSON.stringify(settingsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pitchero-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            if (importData.teams) setTeams(importData.teams);
            if (importData.pitchOrientations) setPitchOrientations(importData.pitchOrientations);
            if (importData.showGrassArea) setShowGrassArea(importData.showGrassArea);
            if (importData.matchDayPitchAreaRequired) setMatchDayPitchAreaRequired(importData.matchDayPitchAreaRequired);
          } catch (error) {
            console.error('Error importing settings:', error);
            alert('Error importing settings file. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const resetToDefaults = () => {
    if (window.confirm("Are you sure?")) {
      setTeams(defaultTeams);
      setPitchOrientations({
        'pitch1': 'portrait',
        'pitch2': 'portrait'
      });
      setShowGrassArea({
        'pitch1': false,
        'pitch2': true
      });
      const defaults = {};
      defaultTeams.forEach(team => {
        defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
      });
      setMatchDayPitchAreaRequired(defaults);
    }
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      width: '100vw',
      position: 'absolute',
      top: 0,
      left: 0,
      margin: 0,
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate("/menu")}
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
              ← Back to Menu
            </button>
            <h1 style={{
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>Settings</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {user && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {clubInfo && (
                  <div style={{
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    🏢 {clubInfo.name}
                  </div>
                )}
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  👤 {user.email} ({userProfile?.role || 'loading...'})
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Logout
                </button>
              </div>
            )}
            <button
              onClick={exportSettings}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Export Settings
            </button>
            <button
              onClick={importSettings}
              style={{
                padding: '8px 16px',
                backgroundColor: '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Import Settings
            </button>
            <button
              onClick={resetToDefaults}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
        
        {/* Club Information Section */}
        {clubInfo && (
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            marginBottom: '24px',
            border: '2px solid #10b981'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🏢 Club Information
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Club Name:
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {clubInfo.name}
              </div>
              <div></div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Club ID:
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1f2937',
                backgroundColor: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: '6px',
                letterSpacing: '2px'
              }}>
                {clubInfo.clubId}
              </div>
              <button
                onClick={copyClubId}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                Copy ID
              </button>
            </div>
            
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#0c4a6e'
            }}>
              <strong>Share this Club ID with new members:</strong> New users can enter this 6-character code during signup to join your club. Only share with trusted members.
            </div>
          </div>
        )}
        
        {/* Team Management Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Team Management</h2>
          
          {/* Add New Team */}
          <div style={{
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Add New Team</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '12px',
              alignItems: 'end'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>Color</label>
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              
              <button
                onClick={generateRandomColor}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                Random Color
              </button>
              
              <button
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: newTeamName.trim() ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newTeamName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Add Team
              </button>
            </div>
          </div>
          
          {/* Current Teams List */}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Current Teams ({teams.length})</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px'
            }}>
              {teams.map((team) => {
                const isDefaultTeam = defaultTeams.some(dt => dt.name === team.name);
                return (
                  <div key={team.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          backgroundColor: team.color,
                          border: '1px solid #d1d5db'
                        }}
                      ></div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>{team.name}</span>
                    </div>
                    
                    {!isDefaultTeam && (
                      <button
                        onClick={() => removeTeam(team.name)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Pitch Configuration Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Pitch Configuration</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {pitches.map((pitch) => (
              <div key={pitch.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fafafa'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>{pitch.name}</h3>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Orientation</label>
                  
                  <div style={{
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="portrait"
                        checked={pitchOrientations[pitch.id] === 'portrait'}
                        onChange={() => updatePitchOrientation(pitch.id, 'portrait')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Portrait</span>
                    </label>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="landscape"
                        checked={pitchOrientations[pitch.id] === 'landscape'}
                        onChange={() => updatePitchOrientation(pitch.id, 'landscape')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Landscape</span>
                    </label>
                  </div>
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Grass Area</label>
                  
                  {pitch.hasGrassArea ? (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={showGrassArea[pitch.id]}
                        onChange={(e) => updateGrassAreaVisibility(pitch.id, e.target.checked)}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Show grass area</span>
                    </label>
                  ) : (
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Not available for this pitch type
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Match Day Settings Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Match Day Settings</h2>
          
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            Configure pitch area requirements for each team's match day allocations.
          </p>
          
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#0c4a6e'
          }}>
            <strong>Match Day Auto-Allocation Rules:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Under 6 & 7:</strong> Any single section or grass area for 50 minutes (books 60 min)</li>
              <li><strong>Under 8 & 9:</strong> 2 vertical sections for 50 minutes (books 60 min)</li>
              <li><strong>Under 10-13:</strong> 4 sections (half pitch) for 60 minutes (books 60 min)</li>
              <li><strong>Under 14+:</strong> Full pitch (8 sections) for 80 minutes (books 90 min)</li>
            </ul>
          </div>
          
          {teams.map((team) => (
            <div key={team.name} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: team.color,
                  border: '1px solid #d1d5db'
                }}
              ></div>
              
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {team.name}
              </div>
              
              <select 
                value={matchDayPitchAreaRequired[team.name] || getDefaultPitchAreaForTeam(team.name)} 
                onChange={(e) => updateMatchDayPitchAreaRequired(team.name, e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="Under 6 & 7">Under 6 & 7</option>
                <option value="Under 8 & 9">Under 8 & 9</option>
                <option value="Under 10-13">Under 10-13</option>
                <option value="Under 14+">Under 14+</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Settings;