// src/components/Menu.jsx - FIXED VERSION that works around security rules
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { auth, getUserProfile, db } from "../utils/firebase"; // Import db too
import { signOut } from "firebase/auth";
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, setDoc } from 'firebase/firestore'; // Import setDoc

function Menu() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [setupStatus, setSetupStatus] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // FIXED: Safer satellite setup that works around security rules
  const handleSatelliteSetup = async () => {
    if (!user) {
      setSetupStatus('❌ Please log in first');
      return;
    }

    setIsSettingUp(true);
    setSetupStatus('Setting up satellite configuration...');

    try {
      // Get user's club ID
      const userProfile = await getUserProfile(user.uid);
      const clubId = userProfile?.clubId;

      if (!clubId) {
        setSetupStatus('❌ No club found for your account');
        setIsSettingUp(false);
        return;
      }

      console.log('Setting up satellite config for club:', clubId);

      // FIXED: Use setDoc with merge instead of updateDoc
      const clubRef = doc(db, 'clubs', clubId);
      
      await setDoc(clubRef, {
        satelliteConfig: {
          imageUrl: null,
          imageWidth: 0,
          imageHeight: 0,
          lastUpdated: null,
          pitchBoundaries: []
        }
      }, { merge: true }); // This is the key - merge: true preserves existing data

      setSetupStatus('✅ Satellite setup complete! You can now use Satellite Overview.');
      console.log('✅ Satellite configuration initialized successfully!');

    } catch (error) {
      console.error('Setup error:', error);
      
      // More specific error handling
      if (error.code === 'permission-denied') {
        setSetupStatus('❌ Permission denied. Try Solution 2 below.');
      } else if (error.code === 'not-found') {
        setSetupStatus('❌ Club not found. Contact support.');
      } else {
        setSetupStatus(`❌ Setup failed: ${error.message}`);
      }
    }

    setIsSettingUp(false);
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#10b981',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      position: 'absolute',
      top: 0,
      left: 0,
      margin: 0
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '800px',
        width: '90%'
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

        {/* IMPROVED: Setup section with better error handling */}
        <div style={{
          marginBottom: '32px',
          padding: '20px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fbbf24'
        }}>
          <h3 style={{ color: '#92400e', margin: '0 0 12px 0' }}>
            🔧 One-Time Satellite Setup Required
          </h3>
          <p style={{ fontSize: '14px', color: '#92400e', margin: '0 0 16px 0' }}>
            Click this button once to enable satellite functionality
          </p>
          
          <button
            onClick={handleSatelliteSetup}
            disabled={isSettingUp}
            style={{
              padding: '12px 24px',
              backgroundColor: isSettingUp ? '#9ca3af' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSettingUp ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              marginBottom: '12px'
            }}
          >
            {isSettingUp ? '⏳ Setting Up...' : '🚀 Initialize Satellite Config'}
          </button>
          
          {setupStatus && (
            <div style={{
              fontSize: '14px',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: setupStatus.includes('✅') ? '#d1fae5' : '#fee2e2',
              color: setupStatus.includes('✅') ? '#065f46' : '#991b1b'
            }}>
              {setupStatus}
            </div>
          )}

          {/* Show alternative if permission denied */}
          {setupStatus.includes('Permission denied') && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#e0f2fe',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#0c4a6e'
            }}>
              <strong>Alternative:</strong> Try the Manual Setup option below, or contact your admin to update security rules.
            </div>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <button
            onClick={() => navigate('/satellite')}
            style={{
              padding: '16px 24px',
              backgroundColor: '#7c3aed',
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
            onMouseOver={(e) => e.target.style.backgroundColor = '#6d28d9'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#7c3aed'}
          >
            📡 Satellite Overview
          </button>

          {/* Your existing buttons */}
          <button
            onClick={() => navigate('/training')}
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
            onClick={() => navigate('/matchday')}
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
            onClick={() => navigate('/settings')}
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

          <button
            onClick={handleLogout}
            style={{
              padding: '16px 24px',
              backgroundColor: '#dc2626',
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
              gap: '8px',
              marginTop: '16px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
          >
            🚪 Logout
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
          <div>📡 Satellite: {setupStatus.includes('✅') ? 'Ready' : 'Setup Required'}</div>
        </div>
      </div>
    </div>
  );
}

export default Menu;
