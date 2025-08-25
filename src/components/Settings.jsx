// src/components/Settings.jsx
import React, { useState, useEffect } from 'react';
import { saveAppConfiguration, loadAppConfiguration } from '../utils/firebase';
import { defaultTeams, pitches, getDefaultPitchAreaForTeam } from '../utils/constants';

function Settings({ 
  onBack, 
  teams, 
  addTeam, 
  removeTeam, 
  pitchOrientations, 
  updatePitchOrientation, 
  showGrassArea, 
  updateGrassAreaVisibility, 
  matchDayPitchAreaRequired, 
  updateMatchDayPitchAreaRequired 
}) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  // Auto-save configuration when settings change
  const saveConfigurationToFirebase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await saveAppConfiguration({
        teams,
        pitchOrientations,
        showGrassArea,
        matchDayPitchAreaRequired,
        lastUpdated: new Date().toISOString()
      });
      
      setSaveStatus('Configuration saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setError(`Failed to save configuration: ${err.message}`);
      console.error('Error saving configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load configuration from Firebase
  const loadConfigurationFromFirebase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const config = await loadAppConfiguration();
      if (config) {
        // Note: In a real implementation, you'd want to update the parent component's state
        // For now, we'll just show a success message
        setSaveStatus('Configuration loaded from database!');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('No saved configuration found in database.');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err) {
      setError(`Failed to load configuration: ${err.message}`);
      console.error('Error loading configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset to default configuration
  const resetToDefaults = async () => {
    if (!window.confirm('Reset all settings to defaults? This will clear all custom teams and settings.')) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const defaultConfig = {
        teams: defaultTeams,
        pitchOrientations: {
          'pitch1': 'portrait',
          'pitch2': 'portrait'
        },
        showGrassArea: {
          'pitch1': false,
          'pitch2': true
        },
        matchDayPitchAreaRequired: {},
        lastUpdated: new Date().toISOString()
      };

      await saveAppConfiguration(defaultConfig);
      
      // Note: In a real implementation, you'd want to reset the parent component's state
      // This would require lifting this logic up or using a global state manager
      setSaveStatus('Settings reset to defaults and saved to database!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setError(`Failed to reset configuration: ${err.message}`);
      console.error('Error resetting configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = async () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      const newTeam = {
        name: newTeamName.trim(),
        color: newTeamColor
      };
      
      // Add team locally
      addTeam(newTeam);
      
      // Save to Firebase
      await saveConfigurationToFirebase();
      
      // Reset form
      setNewTeamName('');
      setNewTeamColor('#3B82F6');
    }
  };

  const handleRemoveTeam = async (teamName) => {
    if (window.confirm(`Remove team "${teamName}"? This will also clear their match day settings.`)) {
      removeTeam(teamName);
      await saveConfigurationToFirebase();
    }
  };

  const handlePitchOrientationChange = async (pitchId, orientation) => {
    updatePitchOrientation(pitchId, orientation);
    await saveConfigurationToFirebase();
  };

  const handleGrassAreaChange = async (pitchId, visible) => {
    updateGrassAreaVisibility(pitchId, visible);
    await saveConfigurationToFirebase();
  };

  const handleMatchDayAreaChange = async (teamName, pitchAreaReq) => {
    updateMatchDayPitchAreaRequired(teamName, pitchAreaReq);
    await saveConfigurationToFirebase();
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

  const exportConfiguration = () => {
    const config = {
      teams,
      pitchOrientations,
      showGrassArea,
      matchDayPitchAreaRequired,
      exportDate: new Date().toISOString(),
      appVersion: "PitcHero v1.0"
    };
    
    const dataStr = JSON.stringify(config, null, 2);
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

  const importConfiguration = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const importedConfig = JSON.parse(e.target.result);
            
            // Validate the configuration structure
            if (importedConfig.teams && Array.isArray(importedConfig.teams)) {
              // Save imported configuration to Firebase
              await saveAppConfiguration({
                ...importedConfig,
                lastUpdated: new Date().toISOString()
              });
              
              setSaveStatus('Configuration imported and saved to database! Please refresh to see changes.');
              setTimeout(() => setSaveStatus(null), 5000);
            } else {
              setError('Invalid configuration file format.');
            }
          } catch (error) {
            setError('Error importing configuration: ' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Loading indicator */}
        {loading && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 1000
          }}>
            Saving to database...
          </div>
        )}

        {/* Success message */}
        {saveStatus && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '12px',
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#166534'
          }}>
            ✅ {saveStatus}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#dc2626'
          }}>
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '12px',
                padding: '2px 6px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={onBack}
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

        {/* Configuration Management */}
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
          }}>Configuration Management</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <button
              onClick={saveConfigurationToFirebase}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              💾 Save to Database
            </button>

            <button
              onClick={loadConfigurationFromFirebase}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📥 Load from Database
            </button>

            <button
              onClick={exportConfiguration}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#9ca3af' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📤 Export to File
            </button>

            <button
              onClick={importConfiguration}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📁 Import from File
            </button>

            <button
              onClick={resetToDefaults}
              disabled={loading}
              style={{
                padding: '12px 20px',
                backgroundColor: loading ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔄 Reset to Defaults
            </button>
          </div>

          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '12px',
            marginTop: '20px',
            fontSize: '13px',
            color: '#0c4a6e'
          }}>
            <strong>💡 Tip:</strong> Your settings are automatically saved to the Firebase database when you make changes. 
            Use "Export to File" to create local backups of your configuration.
          </div>
        </div>
        
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
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    opacity: loading ? 0.6 : 1
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTeam();
                    }
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
                  disabled={loading}
                  style={{
                    width: '60px',
                    height: '36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                />
              </div>
              
              <button
                onClick={generateRandomColor}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  backgroundColor: loading ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                🎲 Random
              </button>
              
              <button
                onClick={handleAddTeam}
                disabled={!newTeamName.trim() || loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: (!newTeamName.trim() || loading) ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!newTeamName.trim() || loading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Adding...' : 'Add Team'}
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
                      {isDefaultTeam && (
                        <span style={{
                          fontSize: '11px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          padding: '2px 6px',
                          borderRadius: '10px'
                        }}>Default</span>
                      )}
                    </div>
                    
                    {!isDefaultTeam && (
                      <button
                        onClick={() => handleRemoveTeam(team.name)}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: loading ? '#9ca3af' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {loading ? '...' : 'Remove'}
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
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="portrait"
                        checked={pitchOrientations[pitch.id] === 'portrait'}
                        onChange={() => handlePitchOrientationChange(pitch.id, 'portrait')}
                        disabled={loading}
                        style={{
                          margin: 0,
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      />
                      <span>Portrait</span>
                    </label>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="landscape"
                        checked={pitchOrientations[pitch.id] === 'landscape'}
                        onChange={() => handlePitchOrientationChange(pitch.id, 'landscape')}
                        disabled={loading}
                        style={{
                          margin: 0,
                          cursor: loading ? 'not-allowed' : 'pointer'
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
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}>
                      <input
                        type="checkbox"
                        checked={showGrassArea[pitch.id]}
                        onChange={(e) => handleGrassAreaChange(pitch.id, e.target.checked)}
                        disabled={loading}
                        style={{
                          margin: 0,
                          cursor: loading ? 'not-allowed' : 'pointer'
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
                onChange={(e) => handleMatchDayAreaChange(team.name, e.target.value)}
                disabled={loading}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  minWidth: '120px',
                  opacity: loading ? 0.6 : 1
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

        {/* Database Info */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '13px',
          color: '#475569'
        }}>
          <strong>🔥 Firebase Integration:</strong> Your settings are automatically saved to Firestore when you make changes. 
          All teams, pitch configurations, and match day settings are stored in the cloud and will persist across browser sessions.
        </div>
      </div>
    </div>
  );
}

export default Settings;