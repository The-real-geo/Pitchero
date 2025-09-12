import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';

const NavigationSidebar = ({ 
  satelliteConfig, 
  clubInfo, 
  user, 
  userRole,
  pitchNames,
  normalizedPitchId,
  allPitchAllocations,
  onImport,
  onExport,
  hasAllocations = false
}) => {
  const navigate = useNavigate();
  
  const isAdmin = userRole === 'admin';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getAllocationsCountForPitch = (pitchId) => {
    let count = 0;
    Object.keys(allPitchAllocations || {}).forEach(key => {
      if (key.includes(`-${pitchId}-`)) {
        count++;
      }
    });
    return count;
  };

  const getPitchDisplayName = (pitchNumber, names) => {
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
  };

  if (!satelliteConfig?.pitchBoundaries) return null;

  return (
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
      {/* User Info Section at the top */}
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
          {clubInfo?.name || 'Loading...'}
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

      {/* Import/Export Buttons - Only show for admins */}
      {isAdmin && (
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={onImport}
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
              marginBottom: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
          >
            📥 Import Allocations
          </button>
          
          <button
            onClick={onExport}
            disabled={!hasAllocations}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: !hasAllocations 
                ? 'rgba(100,100,100,0.3)' 
                : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              fontSize: '14px',
              color: !hasAllocations 
                ? 'rgba(255,255,255,0.5)' 
                : 'white',
              cursor: !hasAllocations 
                ? 'not-allowed' 
                : 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (hasAllocations) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasAllocations) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }
            }}
          >
            📤 Export Allocations
          </button>
        </div>
      )}
      
      {/* Scrollable pitch navigation section */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          marginBottom: '16px',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Pitch Navigation
        </h3>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {satelliteConfig.pitchBoundaries.map((pitch) => {
            const pitchNum = pitch.pitchNumber || pitch.id || (satelliteConfig.pitchBoundaries.indexOf(pitch) + 1);
            const pitchIdToCheck = `pitch${pitchNum}`;
            const allocCount = getAllocationsCountForPitch(pitchIdToCheck);
            const hasAllocations = allocCount > 0;
            const displayName = getPitchDisplayName(pitchNum, pitchNames);
            const isCurrentPitch = normalizedPitchId === pitchIdToCheck;
            
            return (
              <button
                key={pitchNum}
                onClick={() => {
                  navigate(`/allocator/${pitchNum}`);
                }}
                style={{
                  padding: '12px 8px',
                  backgroundColor: isCurrentPitch 
                    ? 'rgba(255,255,255,0.2)' 
                    : hasAllocations 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'transparent',
                  border: isCurrentPitch
                    ? '2px solid rgba(255,255,255,0.5)'
                    : hasAllocations 
                      ? '1px solid rgba(255,255,255,0.2)' 
                      : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: isCurrentPitch
                    ? 'white'
                    : hasAllocations 
                      ? 'rgba(255,255,255,0.9)' 
                      : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentPitch) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentPitch) {
                    e.currentTarget.style.backgroundColor = hasAllocations 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'transparent';
                  }
                }}
              >
                {isCurrentPitch && (
                  <div style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '10px'
                  }}>
                    ▶
                  </div>
                )}
                <div>{displayName}</div>
                {allocCount > 0 && (
                  <div style={{ 
                    fontSize: '11px', 
                    marginTop: '4px', 
                    opacity: 0.8 
                  }}>
                    {allocCount} allocation{allocCount !== 1 ? 's' : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
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
          🗺️ Back to Map View
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
  );
};

export default NavigationSidebar;
