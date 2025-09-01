import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom"
import { auth, db } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, deleteDoc } from "firebase/firestore";
import { useFirebaseAllocations } from '../hooks/useFirebaseAllocations';

const pitches = [
  { id: "pitch2", name: "Pitch 2 - Grass", hasGrassArea: true },
  { id: "pitch1", name: "Pitch 1 - Astro", hasGrassArea: false }
];

const defaultTeams = [
  { name: "Under 6", color: "#00FFFF" },
  { name: "Under 8", color: "#FF0000" },
  { name: "Under 9", color: "#0000FF" },
  { name: "Under 10", color: "#00AA00" },
  { name: "Under 11 - Red", color: "#CC0000" },
  { name: "Under 11 - Black", color: "#000000" },
  { name: "Under 12 YPL", color: "#FFD700" },
  { name: "Under 12 YSL", color: "#FF6600" },
  { name: "Under 13 YCC", color: "#8B00FF" },
  { name: "Under 14 YCC", color: "#FF1493" },
  { name: "Under 14 YSL", color: "#00CED1" },
  { name: "Under 15 YCC", color: "#8B4513" },
  { name: "Under 16 YCC", color: "#696969" }
];

function getDefaultPitchAreaForTeam(teamName) {
  if (teamName.includes('Under 6') || teamName.includes('Under 7')) {
    return 'Under 6 & 7';
  } else if (teamName.includes('Under 8') || teamName.includes('Under 9')) {
    return 'Under 8 & 9';
  } else if (teamName.includes('Under 10') || teamName.includes('Under 11') || teamName.includes('Under 12') || teamName.includes('Under 13')) {
    return 'Under 10-13';
  } else if (teamName.includes('Under 14') || teamName.includes('Under 15') || teamName.includes('Under 16')) {
    return 'Under 14+';
  } else {
    return 'Under 10-13';
  }
}

function Settings({ onBack }) {
  const navigate = useNavigate();
  const { 
    userProfile, 
    clubInfo
  } = useFirebaseAllocations('trainingAllocations');
  
  // Auth state
  const [user, setUser] = useState(null);
  
  // Hamburger menu state
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  
  // Loading states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Backup reminder state
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  
  // State for teams
  const [teams, setTeams] = useState(defaultTeams);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6');

  // State for pitch configurations
  const [pitchOrientations, setPitchOrientations] = useState({
    'pitch1': 'portrait',
    'pitch2': 'portrait'
  });
  const [showGrassArea, setShowGrassArea] = useState({
    'pitch1': false,
    'pitch2': true
  });

  // State for match day settings
  const [matchDayPitchAreaRequired, setMatchDayPitchAreaRequired] = useState(() => {
    const defaults = {};
    defaultTeams.forEach(team => {
      defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
    });
    return defaults;
  });

  // Auth monitoring
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Check if it's the 1st of the month and user is admin
  useEffect(() => {
    const today = new Date();
    const isFirstOfMonth = today.getDate() === 1;
    const isAdmin = userProfile?.role === 'admin';
    
    if (isFirstOfMonth && isAdmin && !sessionStorage.getItem('backupReminderShown')) {
      setShowBackupReminder(true);
      sessionStorage.setItem('backupReminderShown', 'true');
    }
  }, [userProfile]);

  // Close hamburger menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHamburgerMenu && !event.target.closest('.hamburger-menu-container')) {
        setShowHamburgerMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHamburgerMenu]);

  // Logout function
  const handleLogout = async () => {
    try {
      setShowHamburgerMenu(false); // Close menu before logout
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Test Delete Allocation Function (for debugging)
  const testDeleteAllocation = async (allocationType, documentId) => {
    try {
      const collectionName = allocationType === 'training' ? 'trainingAllocations' : 'matchAllocations';
      await deleteDoc(doc(db, collectionName, documentId));
      console.log(`✅ Successfully deleted ${allocationType} allocation with ID: ${documentId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete ${allocationType} allocation:`, error);
      return false;
    }
  };

  // Clear All Future Allocations Function (with confirmation)
  const clearAllFutureAllocations = async () => {
    if (!window.confirm('⚠️ WARNING: This will DELETE all future allocations!\n\nThis action cannot be undone. Continue?')) {
      return;
    }
    
    if (!window.confirm('Are you absolutely sure? All future training and match allocations will be permanently deleted.')) {
      return;
    }
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];
      
      let deletedCount = 0;
      
      // Delete future training allocations
      const trainingQuery = query(
        collection(db, 'trainingAllocations'),
        where('clubId', '==', clubInfo?.clubId),
        where('date', '>=', todayString)
      );
      const trainingDocs = await getDocs(trainingQuery);
      
      for (const docSnapshot of trainingDocs.docs) {
        await deleteDoc(doc(db, 'trainingAllocations', docSnapshot.id));
        deletedCount++;
      }
      
      // Delete future match allocations
      const matchQuery = query(
        collection(db, 'matchAllocations'),
        where('clubId', '==', clubInfo?.clubId),
        where('date', '>=', todayString)
      );
      const matchDocs = await getDocs(matchQuery);
      
      for (const docSnapshot of matchDocs.docs) {
        await deleteDoc(doc(db, 'matchAllocations', docSnapshot.id));
        deletedCount++;
      }
      
      alert(`✅ Deleted ${deletedCount} future allocations.\n\nRefreshing page...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Error clearing allocations:', error);
      alert('❌ Error clearing allocations. Check console for details.');
    }
  };

  // Copy club ID to clipboard
  const copyClubId = () => {
    if (clubInfo?.clubId) {
      navigator.clipboard.writeText(clubInfo.clubId);
      alert('Club ID copied to clipboard!');
    }
  };

  // Backup Allocations Function
  const backupAllocations = async () => {
    if (isBackingUp) return; // Prevent multiple clicks
    
    setIsBackingUp(true);
    
    try {
      console.log('=== Starting Backup Process ===');
      console.log('Club Info:', clubInfo);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];
      
      // Store complete documents including their IDs
      const trainingBackup = [];
      const matchBackup = [];
      
      try {
        // Get ALL training allocations for this club
        const trainingQuery = query(
          collection(db, 'trainingAllocations'),
          where('clubId', '==', clubInfo?.clubId || '9W3LNH')
        );
        const trainingSnapshot = await getDocs(trainingQuery);
        
        trainingSnapshot.forEach((doc) => {
          const data = doc.data();
          const dateField = data.date;
          
          // Only backup future allocations
          if (dateField && dateField >= todayString) {
            trainingBackup.push({
              id: doc.id,
              data: data
            });
          }
        });
        
        // Get ALL match allocations for this club
        const matchQuery = query(
          collection(db, 'matchAllocations'),
          where('clubId', '==', clubInfo?.clubId || '9W3LNH')
        );
        const matchSnapshot = await getDocs(matchQuery);
        
        matchSnapshot.forEach((doc) => {
          const data = doc.data();
          const dateField = data.date;
          
          // Only backup future allocations
          if (dateField && dateField >= todayString) {
            matchBackup.push({
              id: doc.id,
              data: data
            });
          }
        });
        
      } catch (error) {
        console.error('Error fetching allocations:', error);
        alert('Error fetching allocations. Check console for details.');
        setIsBackingUp(false);
        return;
      }
      
      console.log(`Backing up ${trainingBackup.length} training and ${matchBackup.length} match allocations`);
      
      const backupData = {
        backupDate: new Date().toISOString(),
        clubId: clubInfo?.clubId,
        clubName: clubInfo?.name,
        trainingAllocations: trainingBackup,
        matchDayAllocations: matchBackup,
        backupVersion: "2.0" // New version for new structure
      };
      
      // Create and download the file
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `allocations-backup-${clubInfo?.name || 'club'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`✅ Backup created successfully!\n\nTraining: ${trainingBackup.length} allocations\nMatch Day: ${matchBackup.length} allocations`);
      setShowHamburgerMenu(false);
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('❌ Error creating backup. Check console for details.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore Allocations Function
  const restoreAllocations = () => {
    if (isRestoring) return; // Prevent multiple clicks
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        setIsRestoring(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const backupData = JSON.parse(event.target.result);
            
            // Validate backup file
            if (!backupData.trainingAllocations || !backupData.matchDayAllocations) {
              alert('❌ Invalid backup file format. Please select a valid allocations backup file.');
              setIsRestoring(false);
              return;
            }
            
            // Show warning and confirmation
            const trainingCount = Object.keys(backupData.trainingAllocations).length;
            const matchDayCount = Object.keys(backupData.matchDayAllocations).length;
            
            const confirmMessage = `⚠️ WARNING: This will OVERWRITE all existing allocations!\n\n` +
              `Backup details:\n` +
              `• Created: ${new Date(backupData.backupDate).toLocaleDateString()}\n` +
              `• Club: ${backupData.clubName || 'Unknown'}\n` +
              `• Training allocations to restore: ${trainingCount} dates\n` +
              `• Match day allocations to restore: ${matchDayCount} dates\n\n` +
              `Are you absolutely sure you want to restore these allocations?`;
            
            if (!window.confirm(confirmMessage)) {
              setIsRestoring(false);
              return;
            }
            
            // Second confirmation for safety
            if (!window.confirm('This action cannot be undone. Continue with restore?')) {
              setIsRestoring(false);
              return;
            }
            
            // Restore the allocations
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayString = today.toISOString().split('T')[0];
            
            // Handle different backup versions
            const backupVersion = parseFloat(backupData.backupVersion) || 1.0;
            
            if (backupVersion >= 2.0) {
              // New structure - array of {id, data} objects
              const trainingArray = Array.isArray(backupData.trainingAllocations) 
                ? backupData.trainingAllocations 
                : [];
              const matchArray = Array.isArray(backupData.matchDayAllocations) 
                ? backupData.matchDayAllocations 
                : [];
              
              // Filter future allocations
              const futureTraining = trainingArray.filter(item => 
                item.data && item.data.date && item.data.date >= todayString
              );
              const futureMatch = matchArray.filter(item => 
                item.data && item.data.date && item.data.date >= todayString
              );
              
              // Update Firebase with restored allocations
              if (clubInfo?.clubId) {
                try {
                  let trainingRestored = 0;
                  let matchRestored = 0;
                  
                  // First, delete existing future allocations to avoid duplicates
                  console.log('Clearing existing future allocations...');
                  
                  // Get all existing future allocations for this club
                  const existingTrainingQuery = query(
                    collection(db, 'trainingAllocations'),
                    where('clubId', '==', clubInfo.clubId)
                  );
                  const existingTraining = await getDocs(existingTrainingQuery);
                  let deletedTraining = 0;
                  
                  for (const docSnapshot of existingTraining.docs) {
                    const data = docSnapshot.data();
                    // Only delete future allocations
                    if (data.date && data.date >= todayString) {
                      await deleteDoc(doc(db, 'trainingAllocations', docSnapshot.id));
                      deletedTraining++;
                      console.log(`Deleted existing training allocation: ${data.date}`);
                    }
                  }
                  
                  const existingMatchQuery = query(
                    collection(db, 'matchAllocations'),
                    where('clubId', '==', clubInfo.clubId)
                  );
                  const existingMatch = await getDocs(existingMatchQuery);
                  let deletedMatch = 0;
                  
                  for (const docSnapshot of existingMatch.docs) {
                    const data = docSnapshot.data();
                    // Only delete future allocations
                    if (data.date && data.date >= todayString) {
                      await deleteDoc(doc(db, 'matchAllocations', docSnapshot.id));
                      deletedMatch++;
                      console.log(`Deleted existing match allocation: ${data.date}`);
                    }
                  }
                  
                  console.log(`Cleared ${deletedTraining} training and ${deletedMatch} match allocations`);
                  
                  // Small delay to ensure deletions are processed
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Restore training allocations with their original IDs
                  for (const item of futureTraining) {
                    try {
                      await setDoc(
                        doc(db, 'trainingAllocations', item.id), 
                        item.data
                      );
                      trainingRestored++;
                      console.log(`Restored training: ${item.data.date}`);
                    } catch (error) {
                      console.error(`Failed to restore training ${item.data.date}:`, error);
                    }
                  }
                  
                  // Restore match allocations with their original IDs
                  for (const item of futureMatch) {
                    try {
                      await setDoc(
                        doc(db, 'matchAllocations', item.id), 
                        item.data
                      );
                      matchRestored++;
                      console.log(`Restored match: ${item.data.date}`);
                    } catch (error) {
                      console.error(`Failed to restore match ${item.data.date}:`, error);
                    }
                  }
                  
                  alert(`✅ Restore complete!\n\nTraining: ${trainingRestored} allocations\nMatch Day: ${matchRestored} allocations\n\nRefreshing page...`);
                  
                  setTimeout(() => {
                    window.location.reload();
                  }, 3000);
                } catch (error) {
                  console.error('Restore error:', error);
                  alert('❌ Error during restore. Check console.');
                }
              }
            } else {
              // Old structure - handle legacy backups
              alert('⚠️ This backup uses an old format. Please create a new backup with the updated version.');
              setIsRestoring(false);
              return;
            }
              } catch (error) {
                console.error('Error updating Firebase:', error);
                alert('❌ Error restoring allocations to database. Please check your permissions.');
            } else {
              alert('❌ Unable to restore allocations. Club information not available.');
            }
            
            setShowHamburgerMenu(false);
          } catch (error) {
            console.error('Error restoring allocations:', error);
            alert('❌ Error restoring allocations. Please check the file format and try again.');
          } finally {
            setIsRestoring(false);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() && !teams.find(t => t.name === newTeamName.trim())) {
      const newTeam = {
        name: newTeamName.trim(),
        color: newTeamColor
      };
      setTeams(prev => [...prev, newTeam]);
      setMatchDayPitchAreaRequired(prev => ({
        ...prev,
        [newTeam.name]: getDefaultPitchAreaForTeam(newTeam.name)
      }));
      setNewTeamName('');
      setNewTeamColor('#3B82F6');
    }
  };

  const removeTeam = (teamName) => {
    setTeams(prevTeams => prevTeams.filter(team => team.name !== teamName));
    setMatchDayPitchAreaRequired(prev => {
      const updated = { ...prev };
      delete updated[teamName];
      return updated;
    });
  };

  const updatePitchOrientation = (pitchId, orientation) => {
    setPitchOrientations(prev => ({
      ...prev,
      [pitchId]: orientation
    }));
  };

  const updateGrassAreaVisibility = (pitchId, visible) => {
    setShowGrassArea(prev => ({
      ...prev,
      [pitchId]: visible
    }));
  };

  const updateMatchDayPitchAreaRequired = (teamName, pitchAreaReq) => {
    setMatchDayPitchAreaRequired(prev => ({
      ...prev,
      [teamName]: pitchAreaReq
    }));
  };

  const generateRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#A569BD'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setNewTeamColor(randomColor);
  };

  const exportSettings = () => {
    const settingsData = {
      teams,
      pitchOrientations,
      showGrassArea,
      matchDayPitchAreaRequired,
      exportDate: new Date().toISOString(),
      appVersion: "PitcHero Settings v1.0"
    };
    
    const dataStr = JSON.stringify(settingsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pitchero-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowHamburgerMenu(false);
  };

  const importSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importData = JSON.parse(e.target.result);
            if (importData.teams) setTeams(importData.teams);
            if (importData.pitchOrientations) setPitchOrientations(importData.pitchOrientations);
            if (importData.showGrassArea) setShowGrassArea(importData.showGrassArea);
            if (importData.matchDayPitchAreaRequired) setMatchDayPitchAreaRequired(importData.matchDayPitchAreaRequired);
            setShowHamburgerMenu(false);
          } catch (error) {
            console.error('Error importing settings:', error);
            alert('Error importing settings file. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const resetToDefaults = () => {
    if (window.confirm("Are you sure you want to reset all settings to defaults?")) {
      setTeams(defaultTeams);
      setPitchOrientations({
        'pitch1': 'portrait',
        'pitch2': 'portrait'
      });
      setShowGrassArea({
        'pitch1': false,
        'pitch2': true
      });
      const defaults = {};
      defaultTeams.forEach(team => {
        defaults[team.name] = getDefaultPitchAreaForTeam(team.name);
      });
      setMatchDayPitchAreaRequired(defaults);
      setShowHamburgerMenu(false);
    }
  };

  // Backup Reminder Modal
  const BackupReminderModal = () => {
    if (!showBackupReminder) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          border: '2px solid #10b981'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📅 Monthly Backup Reminder
          </h2>
          
          <p style={{
            fontSize: '16px',
            color: '#374151',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            It's the 1st of the month! It's recommended to create a backup of your training and match day allocations to ensure your data is safe.
          </p>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => setShowBackupReminder(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Remind Me Later
            </button>
            <button
              onClick={async () => {
                setShowBackupReminder(false);
                await backupAllocations();
              }}
              disabled={isBackingUp}
              style={{
                padding: '10px 20px',
                backgroundColor: isBackingUp ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isBackingUp ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isBackingUp ? 0.7 : 1
              }}
            >
              {isBackingUp ? 'Creating Backup...' : 'Create Backup Now'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Hamburger Menu Component
  const HamburgerMenu = () => {
    return (
      <div className="hamburger-menu-container" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px'
          }}
          title="Menu"
        >
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151' }}></div>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151' }}></div>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#374151' }}></div>
        </button>
        
        {showHamburgerMenu && (
          <div style={{
            position: 'absolute',
            top: '45px',
            right: '0',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            minWidth: '240px',
            zIndex: 100
          }}>
            {/* User Info Section */}
            {user && (
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb'
              }}>
                {clubInfo && (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🏢 {clubInfo.name}
                  </div>
                )}
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  👤 {user.email}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  Role: {userProfile?.role || 'loading...'}
                </div>
              </div>
            )}
            
            {/* Allocations Backup Section */}
            <div style={{
              borderBottom: '1px solid #e5e7eb',
              paddingTop: '8px',
              paddingBottom: '8px'
            }}>
              <div style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Allocations
              </div>
              
              <button
                onClick={() => backupAllocations()}
                disabled={isBackingUp}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: isBackingUp ? '#9ca3af' : '#059669',
                  border: 'none',
                  cursor: isBackingUp ? 'wait' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                  opacity: isBackingUp ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isBackingUp) e.currentTarget.style.backgroundColor = '#ecfdf5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {isBackingUp ? '⏳ Creating Backup...' : '💾 Backup Allocations'}
              </button>
              
              <button
                onClick={() => restoreAllocations()}
                disabled={isRestoring}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: isRestoring ? '#9ca3af' : '#dc2626',
                  border: 'none',
                  cursor: isRestoring ? 'wait' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                  opacity: isRestoring ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isRestoring) e.currentTarget.style.backgroundColor = '#fef2f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {isRestoring ? '⏳ Restoring...' : '⚠️ Restore Allocations'}
              </button>
            </div>
            
            {/* Settings Section */}
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Settings
              </div>
              
              <button
                onClick={exportSettings}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                📤 Export Settings
              </button>
              
              <button
                onClick={importSettings}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                📥 Import Settings
              </button>
              
              <button
                onClick={resetToDefaults}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                🔄 Reset to Defaults
              </button>
            </div>
            
            {/* Logout Button - Separated at bottom */}
            {user && (
              <>
                <div style={{
                  borderTop: '1px solid #e5e7eb',
                  margin: '0'
                }}></div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'white',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: '0 0 8px 8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  🚪 Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      width: '100vw',
      position: 'absolute',
      top: 0,
      left: 0,
      margin: 0,
      boxSizing: 'border-box'
    }}>
      {/* Backup Reminder Modal */}
      <BackupReminderModal />
      
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate("/menu")}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back to Menu
            </button>
            <h1 style={{
              fontSize: '30px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>Settings</h1>
          </div>
          
          {/* Hamburger Menu */}
          <HamburgerMenu />
        </div>
        
        {/* Club Information Section */}
        {clubInfo && (
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            marginBottom: '24px',
            border: '2px solid #10b981'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🏢 Club Information
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Club Name:
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                {clubInfo.name}
              </div>
              <div></div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Club ID:
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#1f2937',
                backgroundColor: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: '6px',
                letterSpacing: '2px'
              }}>
                {clubInfo.clubId}
              </div>
              <button
                onClick={copyClubId}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                Copy ID
              </button>
            </div>
            
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#0c4a6e'
            }}>
              <strong>Share this Club ID with new members:</strong> New users can enter this 6-character code during signup to join your club. Only share with trusted members.
            </div>
          </div>
        )}
        
        {/* Team Management Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Team Management</h2>
          
          {/* Add New Team */}
          <div style={{
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
            backgroundColor: '#f9fafb'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Add New Team</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '12px',
              alignItems: 'end'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>Color</label>
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  style={{
                    width: '60px',
                    height: '36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
              </div>
              
              <button
                onClick={generateRandomColor}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                Random Color
              </button>
              
              <button
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: newTeamName.trim() ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newTeamName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Add Team
              </button>
            </div>
          </div>
          
          {/* Current Teams List */}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '16px'
            }}>Current Teams ({teams.length})</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px'
            }}>
              {teams.map((team) => {
                const isDefaultTeam = defaultTeams.some(dt => dt.name === team.name);
                return (
                  <div key={team.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          backgroundColor: team.color,
                          border: '1px solid #d1d5db'
                        }}
                      ></div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>{team.name}</span>
                    </div>
                    
                    {!isDefaultTeam && (
                      <button
                        onClick={() => removeTeam(team.name)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Pitch Configuration Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Pitch Configuration</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {pitches.map((pitch) => (
              <div key={pitch.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fafafa'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>{pitch.name}</h3>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Orientation</label>
                  
                  <div style={{
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="portrait"
                        checked={pitchOrientations[pitch.id] === 'portrait'}
                        onChange={() => updatePitchOrientation(pitch.id, 'portrait')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Portrait</span>
                    </label>
                    
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="radio"
                        name={`orientation-${pitch.id}`}
                        value="landscape"
                        checked={pitchOrientations[pitch.id] === 'landscape'}
                        onChange={() => updatePitchOrientation(pitch.id, 'landscape')}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Landscape</span>
                    </label>
                  </div>
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>Grass Area</label>
                  
                  {pitch.hasGrassArea ? (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={showGrassArea[pitch.id]}
                        onChange={(e) => updateGrassAreaVisibility(pitch.id, e.target.checked)}
                        style={{
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <span>Show grass area</span>
                    </label>
                  ) : (
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      Not available for this pitch type
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Match Day Settings Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '24px'
          }}>Match Day Settings</h2>
          
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            Configure pitch area requirements for each team's match day allocations.
          </p>
          
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#0c4a6e'
          }}>
            <strong>Match Day Auto-Allocation Rules:</strong>
            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
              <li><strong>Under 6 & 7:</strong> Any single section or grass area for 50 minutes (books 60 min)</li>
              <li><strong>Under 8 & 9:</strong> 2 vertical sections for 50 minutes (books 60 min)</li>
              <li><strong>Under 10-13:</strong> 4 sections (half pitch) for 60 minutes (books 60 min)</li>
              <li><strong>Under 14+:</strong> Full pitch (8 sections) for 80 minutes (books 90 min)</li>
            </ul>
          </div>
          
          {teams.map((team) => (
            <div key={team.name} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '16px',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: team.color,
                  border: '1px solid #d1d5db'
                }}
              ></div>
              
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {team.name}
              </div>
              
              <select 
                value={matchDayPitchAreaRequired[team.name] || getDefaultPitchAreaForTeam(team.name)} 
                onChange={(e) => updateMatchDayPitchAreaRequired(team.name, e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '120px'
                }}
              >
                <option value="Under 6 & 7">Under 6 & 7</option>
                <option value="Under 8 & 9">Under 8 & 9</option>
                <option value="Under 10-13">Under 10-13</option>
                <option value="Under 14+">Under 14+</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Settings;