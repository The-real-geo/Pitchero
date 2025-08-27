// src/components/Menu.jsx
import React from 'react';
import { useNavigate } from "react-router-dom";
import { auth } from "../utils/firebase";
import { signOut } from "firebase/auth";

function Menu() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#10b981',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      width: '100%'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '80px 60px',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: '0 0 24px 0'
          }}>PitcHero</h1>
          
          <p style={{
            fontSize: '20px',
            color: '#6b7280',
            margin: '0 0 48px 0'
          }}>
            Football Pitch Allocation System for Clubs
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginBottom: '48px'
          }}>
            <button
              onClick={() => navigate('/training')}
              style={{
                padding: '32px 48px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '24px',
                fontWeight: '600',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                minHeight: '160px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#2563eb';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '48px' }}>⚽</span>
              <span>Training Pitch Allocator</span>
            </button>
            
            <button
              onClick={() => navigate('/matchday')}
              style={{
                padding: '32px 48px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '24px',
                fontWeight: '600',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                minHeight: '160px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#047857';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(5, 150, 105, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#059669';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '48px' }}>🏆</span>
              <span>Match Day Allocator</span>
            </button>
            
            <button
              onClick={() => navigate('/settings')}
              style={{
                padding: '32px 48px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '24px',
                fontWeight: '600',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                minHeight: '160px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#4b5563';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(107, 114, 128, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#6b7280';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '48px' }}>⚙️</span>
              <span>Settings</span>
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '32px 48px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '24px',
                fontWeight: '600',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                minHeight: '160px'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#b91c1c';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#dc2626';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '48px' }}>🚪</span>
              <span>Logout</span>
            </button>
          </div>
          
          <div style={{
            padding: '24px',
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            fontSize: '16px',
            color: '#6b7280'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '18px' }}>System Status:</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
              <div>🔥 Firebase: Connected</div>
              <div>⚡ Components: Ready</div>
              <div>📊 13 Teams • 2 Pitches</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Menu;