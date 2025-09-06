// ClubPitchMap.jsx - Fix the firebase import path
import React from 'react';
import '../../utils/firebase'; // Changed from '../utils/firebase' to '../../utils/firebase'

function ClubPitchMap({
  satelliteImage,
  pitchPositions,
  pitches,
  selectedPitches,
  onPitchClick,
  readOnly = false,
  showAllocationCount = false,
  pitchAllocations = {},
  pitchNames = {}
}) {
  // Default positions if not provided
  const defaultPositions = {
    pitch1: { top: '15%', left: '10%', width: '35%', height: '25%' },
    pitch2: { top: '15%', left: '55%', width: '35%', height: '25%' },
    pitch3: { top: '45%', left: '10%', width: '35%', height: '25%' },
    pitch4: { top: '45%', left: '55%', width: '35%', height: '25%' },
    pitch5: { top: '75%', left: '10%', width: '35%', height: '20%' },
    pitch6: { top: '75%', left: '55%', width: '35%', height: '20%' },
  };

  const positions = { ...defaultPositions, ...pitchPositions };

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

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '800px',
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
          const position = positions[pitchId];
          if (!position) return null;
          
          const isSelected = selectedPitches.includes(pitchId);
          const allocationData = pitchAllocations[pitchId] || {};
          const hasAllocations = allocationData.count > 0;
          
          return (
            <button
              key={pitchId}
              onClick={() => !readOnly && onPitchClick && onPitchClick(pitchId)}
              disabled={readOnly}
              style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                width: position.width,
                height: position.height,
                backgroundColor: isSelected ? 
                  'rgba(34, 197, 94, 0.4)' : 
                  (hasAllocations ? 'rgba(59, 130, 246, 0.3)' : 'rgba(229, 231, 235, 0.3)'),
                border: isSelected ? 
                  '3px solid #16a34a' : 
                  (hasAllocations ? '3px solid #3b82f6' : '2px solid #9ca3af'),
                borderRadius: '8px',
                cursor: readOnly ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                transition: 'all 0.2s',
                minHeight: '60px'
              }}
              onMouseOver={(e) => {
                if (!readOnly) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = hasAllocations ? 
                      'rgba(59, 130, 246, 0.5)' : 'rgba(229, 231, 235, 0.5)';
                  }
                }
              }}
              onMouseOut={(e) => {
                if (!readOnly) {
                  e.currentTarget.style.transform = 'scale(1)';
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = hasAllocations ? 
                      'rgba(59, 130, 246, 0.3)' : 'rgba(229, 231, 235, 0.3)';
                  }
                }
              }}
            >
              <div style={{
                backgroundColor: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: isSelected ? '#16a34a' : (hasAllocations ? '#1e40af' : '#6b7280')
                }}>
                  {getPitchDisplayName(pitchId)}
                </div>
                {showAllocationCount && hasAllocations && (
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginTop: '2px',
                    textAlign: 'center'
                  }}>
                    {allocationData.count} slots
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ClubPitchMap;
