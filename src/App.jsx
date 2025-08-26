// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LoginPage from "./components/LoginPage"; // we will create this
import Menu from "./components/Menu";
import TrainingPitchAllocator from "./components/TrainingPitchAllocator";
import MatchDayPitchAllocator from "./components/MatchDayPitchAllocator";
import Settings from "./components/Settings";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public login route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected menu */}
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

        {/* Redirect root to login */}
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;