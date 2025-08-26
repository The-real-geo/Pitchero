// src/components/Menu.jsx
import React from 'react';
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/firebase";

// Inside a functional component
const MatchDayPitchAllocator = () => {
  const navigate = useNavigate(); // ← correct place
  // ...
}

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
          margin: '0 0 16px 0'
        }}>PitcHero</h1>
        
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: '0 0 32px 0'
        }}>
          Football Pitch Allocation System
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <button
            onClick={() => onNavigate('/training')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            ⚽ Training Pitch Allocator
          </button>
          
          <button
            onClick={() => onNavigate('/matchday')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#047857'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#059669'}
          >
            🏆 Match Day Allocator
          </button>
          
          <button
            onClick={() => onNavigate('/settings')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
          >
            ⚙️ Settings
          </button>
        </div>
        
        <div style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>System Status:</div>
          <div>🔥 Firebase: Connected</div>
          <div>⚡ Components: Ready</div>
          <div>📊 13 Teams • 2 Pitches</div>
        </div>
      </div>
    </div>
  );
}

export default Menu;