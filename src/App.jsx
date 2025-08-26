// src/App.jsx - Clean version using Menu component
import React, { useState } from 'react';
import Menu from './components/Menu';
import TrainingPitchAllocator from './components/TrainingPitchAllocator';
import MatchDayPitchAllocator from './components/MatchDayPitchAllocator';
import Settings from './components/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('menu');

  const navigate = (page) => {
    setCurrentPage(page);
  };

  const goBackToMenu = () => {
    setCurrentPage('menu');
  };

  // Main menu
  if (currentPage === 'menu') {
    return <Menu onNavigate={navigate} />;
  }

  // Training page
if (currentPage === 'training') {
  return <TrainingPitchAllocator onBack={goBackToMenu} />;
}

  // Match day page 
  if (currentPage === 'matchday') {
  return <MatchDayPitchAllocator onBack={goBackToMenu} />;
}

  // Settings page 
  if (currentPage === 'settings') {
  return <Settings onBack={goBackToMenu} />;
}

  return null;
}

export default App;