import React from 'react';

function Menu({ onNavigate }) {
  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#10b981',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 'bold',
          color: '#1f2937',
          margin: '0 0 32px 0'
        }}>PitcHero</h1>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <button
            onClick={() => onNavigate('training')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            Training Pitch Allocator
          </button>
          
          <button
            onClick={() => onNavigate('matchday')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            Match Day Pitch Allocator
          </button>
          
          <button
            onClick={() => onNavigate('settings')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default Menu;