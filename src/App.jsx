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

  // If user is already authenticated, redirect to menu
  return user ? <Navigate to="/menu" replace /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public login route - redirects to menu if already authenticated */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

        {/* Protected menu - this is your main dashboard */}
        <Route
          path="/menu"
          element={
            <PrivateRoute>
              <Menu />
            </PrivateRoute>
          }
        />

        {/* Protected training page */}
        <Route
          path="/training"
          element={
            <PrivateRoute>
              <TrainingPitchAllocator />
            </PrivateRoute>
          }
        />

        {/* Protected match day page */}
        <Route
          path="/matchday"
          element={
            <PrivateRoute>
              <MatchDayPitchAllocator />
            </PrivateRoute>
          }
        />

        {/* Protected settings page */}
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        {/* Root route - redirects based on authentication status */}
        <Route 
          path="/" 
          element={<Navigate to="/menu" replace />}
        />

        {/* Catch-all route for 404s */}
        <Route 
          path="*" 
          element={<Navigate to="/menu" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;