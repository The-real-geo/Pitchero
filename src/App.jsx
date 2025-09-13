// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./utils/firebase";
import LoginPage from "./components/LoginPage";
import Menu from "./components/Menu";
import TrainingPitchAllocator from "./components/TrainingPitchAllocator";
import MatchDayPitchAllocator from "./components/MatchDayPitchAllocator";
import Settings from "./components/Settings";
import ShareView from "./components/ShareView";
import SatelliteManager from "./components/satellite/SatelliteManager";
import ClubPitchMap from './components/satellite/ClubPitchMap';
import UnifiedPitchAllocator from './components/UnifiedPitchAllocator';
import CapacityOutlook from './components/CapacityOutlook';

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

// Component for handling authenticated users on login page
const PublicRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    );
  }

  // If user is already authenticated, redirect to club-pitch-map (main landing)
  return user ? <Navigate to="/club-pitch-map" replace /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public login route - redirects to club-pitch-map if already authenticated */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

        {/* Public share view route - accessible without authentication */}
        <Route 
          path="/share/:shareId" 
          element={<ShareView />} 
        />
        
        {/* Protected ClubPitchMap - Main landing page after login */}
        <Route
          path="/club-pitch-map"
          element={
            <PrivateRoute>
              <ClubPitchMap />
            </PrivateRoute>
          }
        />

        {/* Protected UnifiedPitchAllocator */}
        <Route
          path="/allocator/:pitchId"
          element={
            <PrivateRoute>
              <UnifiedPitchAllocator />
            </PrivateRoute>
          }
        />

        {/* Protected Capacity Outlook */}
        <Route
          path="/capacity-outlook"
          element={
            <PrivateRoute>
              <CapacityOutlook />
            </PrivateRoute>
          }
        />

        {/* Protected SatelliteManager */}
        <Route
          path="/satellite"
          element={
            <PrivateRoute>
              <SatelliteManager />
            </PrivateRoute>
          }
        />

        {/* Protected Settings */}
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        {/* Legacy Routes - Keep for backward compatibility but may phase out */}
        
        {/* Protected menu - legacy dashboard */}
        <Route
          path="/menu"
          element={
            <PrivateRoute>
              <Menu />
            </PrivateRoute>
          }
        />

        {/* Protected training page - legacy */}
        <Route
          path="/training"
          element={
            <PrivateRoute>
              <TrainingPitchAllocator />
            </PrivateRoute>
          }
        />

        {/* Protected match day page - legacy */}
        <Route
          path="/matchday"
          element={
            <PrivateRoute>
              <MatchDayPitchAllocator />
            </PrivateRoute>
          }
        />

        {/* Root route - redirects to club-pitch-map (main landing) */}
        <Route 
          path="/" 
          element={<Navigate to="/club-pitch-map" replace />}
        />

        {/* Catch-all route for 404s - redirects to club-pitch-map */}
        <Route 
          path="*" 
          element={<Navigate to="/club-pitch-map" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
