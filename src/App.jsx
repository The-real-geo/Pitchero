import React, { useState, useEffect } from 'react';
import Menu from './components/Menu';
import TrainingPitchAllocator from './components/TrainingPitchAllocator';
import MatchDayPitchAllocator from './components/MatchDayPitchAllocator';
import Settings from './components/Settings';
import { defaultTeams, getDefaultPitchAreaForTeam } from './utils/constants';
import { loadAppConfiguration, saveAppConfiguration } from './utils/firebase';

export default function App() {
  const [currentPage, setCurrentPage] = useState('menu');
  const [teams, setTeams] = useState(defaultTeams);
  const [pitchOrientations, setPitchOrientations] = useState({
    'pitch1': 'portrait',
    'pitch2': 'portrait'
  });
  const [showGrassArea, setShowGrassArea] = useState({
    'pitch1': false,
    'pitch2': true
  });
  const [matchDayPitchAreaRequired, setMatchDayPitchAreaRequired] = useState(() => {
    const defaults = {};
    defaultTeams.forEach(team => {
      defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
    });
    return defaults;
  });

  // Load configuration from Firebase on app start
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await loadAppConfiguration();
        if (config) {
          setTeams(config.teams || defaultTeams);
          setPitchOrientations(config.pitchOrientations || {
            'pitch1': 'portrait',
            'pitch2': 'portrait'
          });
          setShowGrassArea(config.showGrassArea || {
            'pitch1': false,
            'pitch2': true
          });
          setMatchDayPitchAreaRequired(config.matchDayPitchAreaRequired || {});
        }
      } catch (err) {
        console.error("Error loading app configuration:", err);
      }
    };
    
    loadConfig();
  }, []);

  // Save configuration to Firebase when settings change
  const saveConfiguration = async () => {
    try {
      await saveAppConfiguration({
        teams,
        pitchOrientations,
        showGrassArea,
        matchDayPitchAreaRequired
      });
    } catch (err) {
      console.error("Error saving configuration:", err);
    }
  };

  const navigate = (page) => {
    setCurrentPage(page);
  };

  const goBackToMenu = () => {
    setCurrentPage('menu');
  };

  const addTeam = (newTeam) => {
    setTeams(prevTeams => [...prevTeams, newTeam]);
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [newTeam.name]: getDefaultPitchAreaForTeam(newTeam.name)
    }));
    saveConfiguration();
  };

  const removeTeam = (teamName) => {
    setTeams(prevTeams => prevTeams.filter(team => team.name !== teamName));
    setMatchDayPitchAreaRequired(prev => {
      const updated = { ...prev };
      delete updated[teamName];
      return updated;
    });
    saveConfiguration();
  };

  const updatePitchOrientation = (pitchId, orientation) => {
    setPitchOrientations(prev => ({
      ...prev,
      [pitchId]: orientation
    }));
    saveConfiguration();
  };

  const updateGrassAreaVisibility = (pitchId, visible) => {
    setShowGrassArea(prev => ({
      ...prev,
      [pitchId]: visible
    }));
    saveConfiguration();
  };

  const updateMatchDayPitchAreaRequired = (teamName, pitchAreaReq) => {
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [teamName]: pitchAreaReq
    }));
    saveConfiguration();
  };

  switch (currentPage) {
    case 'training':
      return (
        <TrainingPitchAllocator 
          onBack={goBackToMenu} 
          teams={teams} 
          pitchOrientations={pitchOrientations} 
          showGrassArea={showGrassArea} 
        />
      );
    case 'matchday':
      return (
        <MatchDayPitchAllocator 
          onBack={goBackToMenu} 
          teams={teams} 
          pitchOrientations={pitchOrientations} 
          showGrassArea={showGrassArea} 
          matchDayPitchAreaRequired={matchDayPitchAreaRequired} 
        />
      );
    case 'settings':
      return (
        <Settings 
          onBack={goBackToMenu} 
          teams={teams} 
          addTeam={addTeam} 
          removeTeam={removeTeam} 
          pitchOrientations={pitchOrientations} 
          updatePitchOrientation={updatePitchOrientation} 
          showGrassArea={showGrassArea} 
          updateGrassAreaVisibility={updateGrassAreaVisibility} 
          matchDayPitchAreaRequired={matchDayPitchAreaRequired} 
          updateMatchDayPitchAreaRequired={updateMatchDayPitchAreaRequired} 
        />
      );
    default:
      return <Menu onNavigate={navigate} />;
  }
}