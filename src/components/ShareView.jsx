// ShareView.jsx - Mobile-optimized with protected pitch names loading
// Ensures pitch names are properly loaded even on slow connections

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

// Helper function to get display name for a pitch with proper fallback
const getPitchDisplayName = (pitchNumber, pitchNames, loadingState) => {
  // If still loading, show loading indicator
  if (loadingState === 'loading') {
    return `Pitch ${pitchNumber} (...)`;
  }
  
  // Try different key formats
  const possibleKeys = [
    `pitch-${pitchNumber}`,     // "pitch-1" (primary format in Firebase)
    `pitch${pitchNumber}`,      // "pitch1"
    `Pitch ${pitchNumber}`,     // "Pitch 1"
    `Pitch-${pitchNumber}`,     // "Pitch-1"
    pitchNumber.toString(),     // "1"
  ];
  
  // Find the first key that exists in pitchNames
  for (const key of possibleKeys) {
    if (pitchNames && pitchNames[key]) {
      return pitchNames[key];
    }
  }
  
  // Fallback
  return `Pitch ${pitchNumber}`;
};

// Function to load pitch names with retry logic
const loadPitchNames = async (clubId, maxRetries = 3) => {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../utils/firebase');
  
  const attemptLoad = async (attemptNumber) => {
    try {
      const settingsRef = doc(db, 'clubs', clubId, 'settings', 'general');
      console.log(`🔍 Attempt ${attemptNumber}: Loading pitch names from clubs/${clubId}/settings/general`);
      
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        if (settingsData.pitchNames) {
          console.log('✅ Pitch names loaded successfully:', settingsData.pitchNames);
          return { success: true, data: settingsData.pitchNames };
        } else {
          console.log('⚠️ Settings exist but no pitchNames field');
          return { success: true, data: {} };
        }
      } else {
        console.log('⚠️ Settings document does not exist');
        return { success: true, data: {} };
      }
    } catch (error) {
      console.error(`❌ Attempt ${attemptNumber} failed:`, error);
      return { success: false, error };
    }
  };
  
  // Try loading with retries
  for (let i = 1; i <= maxRetries; i++) {
    const result = await attemptLoad(i);
    
    if (result.success) {
      return result.data;
    }
    
    // If not the last attempt, wait before retrying (exponential backoff)
    if (i < maxRetries) {
      const backoffTime = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
  
  console.error('❌ All retry attempts failed');
  return {};
};

// Main function to get shared allocation data
const getSharedAllocation = async (shareId) => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../utils/firebase');
    
    // Get the shared allocation data
    const shareDoc = await getDoc(doc(db, 'sharedAllocations', shareId));
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const shareData = shareDoc.data();
    console.log('Share data loaded:', shareData);
    
    // Get the club data
    const clubId = shareData.clubId;
    if (!clubId) {
      throw new Error('Club ID not found in share data');
    }
    
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }
    
    const clubData = clubDoc.data();
    console.log('Club data loaded:', clubData);
    
    // Return data WITHOUT pitch names initially (they'll be loaded separately)
    return {
      ...shareData,
      clubId,
      clubName: clubData.name,
      satelliteConfig: {
        imageUrl: clubData.satelliteConfig?.imageUrl,
        imagePath: clubData.satelliteConfig?.imagePath,
        imageWidth: clubData.satelliteConfig?.imageWidth,
        imageHeight: clubData.satelliteConfig?.imageHeight,
        pitchBoundaries: clubData.satelliteConfig?.pitchBoundaries?.map((boundary, index) => ({
          pitchNumber: (index + 1).toString(),
          sizeType: boundary.sizeType || 'large',
          boundaries: boundary.boundaries
        })) || []
      }
    };

  } catch (error) {
    console.error('Error fetching shared allocation:', error);
    throw new Error(error.message || 'Failed to load shared allocation');
  }
};

function ShareView() {
  const { shareId } = useParams();
  const [sharedData, setSharedData] = useState(null);
  const [pitchNames, setPitchNames] = useState({});
  const [pitchNamesLoadingState, setPitchNamesLoadingState] = useState('idle'); // idle, loading, loaded, error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'pitch'
  
  // Canvas and image refs
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Firebase image states
  const [firebaseImageUrl, setFirebaseImageUrl] = useState(null);
  const [imageLoadingState, setImageLoadingState] = useState('idle');
  const [imageError, setImageError] = useState(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load shared data and pitch names together
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getSharedAllocation(shareId);
        
        // Process allocations and extract pitches
        let availablePitches = [];
        let extractedDate = data?.date;
        
        if (data?.allocations && Object.keys(data.allocations).length > 0) {
          const pitchSet = new Set();
          const dateSet = new Set();
          
          Object.keys(data.allocations).forEach(key => {
            const parts = key.split('-');
            
            parts.forEach((part, index) => {
              if (part.match(/^\d{4}/) && part.length >= 8) {
                dateSet.add(part);
              } else if (index > 0 && !sections.includes(part.toUpperCase())) {
                let pitchId = part;
                if (/^\d+$/.test(pitchId)) {
                  pitchId = `pitch${pitchId}`;
                  pitchSet.add(pitchId);
                } else if (pitchId.startsWith('pitch')) {
                  pitchSet.add(pitchId);
                }
              }
            });
          });
          
          if (data.pitches && Array.isArray(data.pitches)) {
            data.pitches.forEach(p => {
              let normalizedPitch = p;
              if (/^\d+$/.test(p)) {
                normalizedPitch = `pitch${p}`;
              }
              pitchSet.add(normalizedPitch);
            });
          }
          
          availablePitches = Array.from(pitchSet).sort((a, b) => {
            const aNum = parseInt(a.replace(/\D/g, ''));
            const bNum = parseInt(b.replace(/\D/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            return a.localeCompare(b);
          });
          
          if (dateSet.size > 0 && !extractedDate) {
            extractedDate = Array.from(dateSet)[0];
          }
        }
        
        const updatedData = {
          ...data,
          pitches: availablePitches,
          date: extractedDate || data?.date || new Date().toISOString().split('T')[0]
        };
        
        setSharedData(updatedData);
        
        // Load pitch names immediately after setting shared data
        if (data?.clubId) {
          console.log('🚀 Loading pitch names for clubId:', data.clubId);
          setPitchNamesLoadingState('loading');
          
          try {
            const names = await loadPitchNames(data.clubId);
            console.log('📦 Received pitch names:', names);
            console.log('📦 Keys in pitch names:', Object.keys(names));
            console.log('📦 Is empty?:', Object.keys(names).length === 0);
            
            if (names && Object.keys(names).length > 0) {
              setPitchNames(names);
              setPitchNamesLoadingState('loaded');
              console.log('✅ Pitch names successfully set in state');
            } else {
              console.log('⚠️ Pitch names object is empty or null');
              setPitchNames({});
              setPitchNamesLoadingState('loaded'); // Still mark as loaded even if empty
            }
          } catch (error) {
            console.error('❌ Failed to load pitch names:', error);
            setPitchNamesLoadingState('error');
            setPitchNames({});
          }
        }
        
      } catch (err) {
        console.error('Error loading shared data:', err);
        setError(err.message || 'Failed to load shared allocation');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [shareId]);

  // Firebase SDK image loading - now loads AFTER pitch names
  useEffect(() => {
    const loadFirebaseImage = async () => {
      // Only load image after pitch names have been attempted
      if (!sharedData?.satelliteConfig?.imageUrl || pitchNamesLoadingState === 'idle') return;
      
      try {
        setImageLoadingState('loading');
        setImageError(null);
        
        let imagePath = sharedData.satelliteConfig.imagePath;
        
        if (!imagePath && sharedData.satelliteConfig.imageUrl) {
          const pathMatch = sharedData.satelliteConfig.imageUrl.match(/\/o\/(.+?)\?alt=/);
          if (pathMatch) {
            imagePath = decodeURIComponent(pathMatch[1]);
          }
        }
        
        if (imagePath) {
          const { ref, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../utils/firebase');
          
          const imageRef = ref(storage, imagePath);
          const publicUrl = await getDownloadURL(imageRef);
          
          setFirebaseImageUrl(publicUrl);
          setImageLoadingState('loaded');
        } else {
          setImageError('No Firebase storage path available');
          setImageLoadingState('error');
        }
        
      } catch (error) {
        console.error('Error loading Firebase image:', error);
        setImageError(error.message || 'Failed to load satellite image');
        setImageLoadingState('error');
      }
    };

    if (sharedData?.satelliteConfig && pitchNamesLoadingState !== 'idle') {
      loadFirebaseImage();
    }
  }, [sharedData, pitchNamesLoadingState]);

  // Calculate canvas size
  const calculateCanvasSize = (imgWidth, imgHeight) => {
    const maxWidth = isMobile ? window.innerWidth - 40 : 1000;
    const maxHeight = isMobile ? 400 : 600;
    const aspectRatio = imgWidth / imgHeight;
    
    let width = maxWidth;
    let height = width / aspectRatio;
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width, height };
  };

  // Handle image load
  const handleImageLoad = () => {
    if (imageRef.current && sharedData?.satelliteConfig) {
      const size = calculateCanvasSize(
        sharedData.satelliteConfig.imageWidth, 
        sharedData.satelliteConfig.imageHeight
      );
      setCanvasSize(size);
      setImageLoaded(true);
    }
  };

  // Handle image error
  const handleImageError = (error) => {
    console.error('Image failed to load:', error);
    setImageLoaded(false);
    setImageLoadingState('error');
    setImageError('Failed to load satellite image');
  };

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded || !sharedData?.satelliteConfig) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / sharedData.satelliteConfig.imageWidth;
    const scaleY = canvas.height / sharedData.satelliteConfig.imageHeight;

    const allocations = sharedData?.allocations || {};
    
    if (sharedData.satelliteConfig.pitchBoundaries) {
      sharedData.satelliteConfig.pitchBoundaries.forEach((pitch, index) => {
        const x = pitch.boundaries.x1 * scaleX;
        const y = pitch.boundaries.y1 * scaleY;
        const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
        const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

        const pitchNum = pitch.pitchNumber;
        const hasAllocations = Object.keys(allocations).some(key => {
          const parts = key.split('-');
          return parts.some(part => part === pitchNum || part === `pitch${pitchNum}`);
        });

        ctx.fillStyle = hasAllocations ? 'rgba(34, 197, 94, 0.6)' : 'rgba(34, 197, 94, 0.3)';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Draw pitch number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const pitchLabel = pitch.pitchNumber || `${index + 1}`;
        const textMetrics = ctx.measureText(pitchLabel);
        const padding = 10;
        
        ctx.fillStyle = 'rgba(31, 41, 55, 0.8)';
        ctx.fillRect(
          x + width / 2 - textMetrics.width / 2 - padding,
          y + height / 2 - 15,
          textMetrics.width + padding * 2,
          30
        );
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pitchLabel, x + width / 2, y + height / 2);

        if (hasAllocations) {
          const allocCount = Object.keys(allocations).filter(key => {
            const parts = key.split('-');
            return parts.some(part => part === pitchNum || part === `pitch${pitchNum}`);
          }).length;
          
          ctx.font = `${Math.max(10, Math.min(14, width / 12))}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(`${allocCount} slots`, x + width / 2, y + height / 2 + 28);
        }
      });
    }
  }, [imageLoaded, sharedData]);

  useEffect(() => {
    if (imageLoaded && canvasRef.current && sharedData) {
      drawCanvas();
    }
  }, [imageLoaded, sharedData, drawCanvas, viewMode]);

  useEffect(() => {
    if (viewMode === 'map' && imageLoaded && canvasRef.current && sharedData) {
      const timer = setTimeout(() => {
        drawCanvas();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [viewMode, imageLoaded, sharedData, drawCanvas]);

  // Handle canvas click
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !sharedData?.satelliteConfig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * sharedData.satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * sharedData.satelliteConfig.imageHeight;

    const clickedPitch = sharedData.satelliteConfig.pitchBoundaries?.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch) {
      setSelectedPitch(clickedPitch);
      setViewMode('pitch');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '16px',
        color: '#6b7280'
      }}>
        Loading allocation...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        Error: {error}
      </div>
    );
  }

  const allocations = sharedData?.allocations || {};
  const date = sharedData?.date || new Date().toISOString().split('T')[0];
  const clubName = sharedData?.clubName || 'Soccer Club';
  const allocationType = sharedData?.type === 'match' ? 'Match Day' : sharedData?.type === 'training' ? 'Training' : 'Pitch';
  const pitches = sharedData?.pitches || [];
  const satelliteConfig = sharedData?.satelliteConfig;
  
  // Extract time range
  let start = 9;
  let end = 18;
  let timeInterval = 30;
  
  const actualTimeSlots = new Set();
  
  if (Object.keys(allocations).length > 0) {
    Object.keys(allocations).forEach(key => {
      const parts = key.split('-');
      parts.forEach(part => {
        if (part && part.match(/^\d{2}:\d{2}$/)) {
          actualTimeSlots.add(part);
        }
      });
    });
    
    const sortedTimes = Array.from(actualTimeSlots).sort();
    
    if (sortedTimes.length > 0) {
      const firstTime = sortedTimes[0];
      const lastTime = sortedTimes[sortedTimes.length - 1];
      
      start = parseInt(firstTime.split(':')[0]) || 9;
      const lastHour = parseInt(lastTime.split(':')[0]) || 17;
      end = Math.min(lastHour + 2, 21);
      
      if (sortedTimes.length > 1) {
        const has15MinIntervals = sortedTimes.some(t => t.endsWith(':15') || t.endsWith(':45'));
        if (has15MinIntervals) {
          timeInterval = 15;
        }
      }
    }
  }
  
  const timeSlots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += timeInterval) {
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeSlots.push(timeString);
    }
  }

  // Allocation lookup functions
  const findAllocation = (timeSlot, pitchId, section) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchNum}-${section}`,
      `${date}-${timeSlot}-pitch${pitchNum}-${section}`,
      `${timeSlot}-${pitchNum}-${section}`,
      `${timeSlot}-pitch${pitchNum}-${section}`,
    ];
    
    for (const key of possibleKeys) {
      if (allocations[key]) {
        return allocations[key];
      }
    }
    
    return null;
  };

  const hasAllocationsForTimeSlot = (timeSlot, pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    const possibleKeys = [
      `${date}-${timeSlot}-${pitchNum}`,
      `${date}-${timeSlot}-pitch${pitchNum}`,
      `${timeSlot}-${pitchNum}`,
      `${timeSlot}-pitch${pitchNum}`,
    ];
    
    return Object.keys(allocations).some(key => {
      return possibleKeys.some(pattern => key.startsWith(pattern + '-'));
    });
  };

  const getAllocationsCountForPitch = (pitchId) => {
    const pitchNum = pitchId.replace(/\D/g, '');
    
    let count = 0;
    Object.keys(allocations).forEach(key => {
      const parts = key.split('-');
      for (let i = 0; i < parts.length - 1; i++) {
        if ((parts[i] === pitchNum || parts[i] === `pitch${pitchNum}`) && 
            sections.includes(parts[i + 1].toUpperCase())) {
          count++;
          break;
        }
      }
    });
    
    return count;
  };

  // Render map view
  const renderMapView = () => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: isMobile ? '12px' : '20px',
      marginTop: '16px'
    }}>
      <h2 style={{
        fontSize: isMobile ? '16px' : '20px',
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: '12px',
        textAlign: 'center'
      }}>
        Select Your Pitch
      </h2>
      
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: isMobile ? '100%' : '1000px',
        margin: '0 auto',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center'
      }}>
        {firebaseImageUrl && satelliteConfig && imageLoadingState === 'loaded' ? (
          <>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ 
                maxWidth: '100%', 
                height: 'auto',
                cursor: 'pointer',
                display: imageLoaded ? 'block' : 'none'
              }}
              onClick={handleCanvasClick}
            />
            
            {!imageLoaded && (
              <div style={{
                width: '100%',
                height: isMobile ? '300px' : '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f3f4f6',
                color: '#6b7280'
              }}>
                Preparing satellite view...
              </div>
            )}
            
            <img
              ref={imageRef}
              src={firebaseImageUrl}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: 'none' }}
              alt="Satellite view"
            />
          </>
        ) : imageLoadingState === 'loading' ? (
          <div style={{
            width: '100%',
            height: isMobile ? '300px' : '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            color: '#6b7280'
          }}>
            Loading satellite view...
          </div>
        ) : imageLoadingState === 'error' ? (
          <div style={{
            width: '100%',
            height: isMobile ? '300px' : '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div>Unable to load satellite image</div>
            {imageError && (
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {imageError}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            width: '100%',
            paddingTop: '60%',
            backgroundColor: '#10b981',
            backgroundImage: 'linear-gradient(0deg, #10b981 0%, #059669 100%)',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              opacity: 0.5
            }}>
              Field Overview
            </div>
          </div>
        )}
      </div>
      
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        <p style={{
          fontSize: isMobile ? '12px' : '14px',
          color: '#6b7280',
          textAlign: 'center',
          margin: 0
        }}>
          Tap on your pitch to view allocations
        </p>
      </div>

      {/* Pitch Legend - with key to force re-render when names load */}
      {satelliteConfig?.pitchBoundaries?.length > 0 && (
        <div 
          key={`legend-${Object.keys(pitchNames).length}`} // Force re-render when pitch names change
          style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: '16px',
          marginTop: '16px'
        }}>
          <div style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            Pitch Legend
            {pitchNamesLoadingState === 'loading' && (
              <span style={{ 
                fontSize: '10px', 
                color: '#f59e0b',
                backgroundColor: '#fef3c7',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                Loading names...
              </span>
            )}
            {pitchNamesLoadingState === 'error' && (
              <span style={{ 
                fontSize: '10px', 
                color: '#ef4444',
                backgroundColor: '#fee2e2',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                Names not loaded
              </span>
            )}
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '8px',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {satelliteConfig.pitchBoundaries.map((pitch, index) => {
              const pitchNumber = pitch.pitchNumber || (index + 1);
              const displayName = getPitchDisplayName(pitchNumber, pitchNames, pitchNamesLoadingState);
              const allocCount = getAllocationsCountForPitch(`pitch${pitchNumber}`);
              const hasAllocations = allocCount > 0;
              
              return (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: hasAllocations ? '#f0f9ff' : '#f9fafb',
                    borderRadius: '6px',
                    border: hasAllocations ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                    cursor: 'default',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    marginRight: '12px'
                  }}>
                    {pitchNumber}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: isMobile ? '13px' : '14px',
                      color: '#374151',
                      fontWeight: '500'
                    }}>
                      {displayName}
                    </div>
                    {hasAllocations && (
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        {allocCount} allocations
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{
            padding: '8px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #bfdbfe',
            borderRadius: '4px',
            fontSize: isMobile ? '11px' : '12px',
            color: '#1e40af',
            textAlign: 'center',
            margin: '12px auto 0',
            maxWidth: '400px'
          }}>
            Tap on a pitch on the map to view the training or game allocations for that specific pitch.
          </div>
        </div>
      )}

      {/* Pitch Buttons for mobile */}
      {(isMobile || imageLoadingState !== 'loaded') && satelliteConfig?.pitchBoundaries && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '16px',
          marginTop: '16px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px'
          }}>
            Available Pitches
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px'
          }}>
            {satelliteConfig.pitchBoundaries.map((pitch) => {
              const allocCount = getAllocationsCountForPitch(`pitch${pitch.pitchNumber}`);
              const hasAllocations = allocCount > 0;
              const displayName = getPitchDisplayName(pitch.pitchNumber, pitchNames, pitchNamesLoadingState);
              
              return (
                <button
                  key={pitch.pitchNumber}
                  onClick={() => {
                    setSelectedPitch(pitch);
                    setViewMode('pitch');
                  }}
                  style={{
                    padding: '12px 8px',
                    backgroundColor: hasAllocations ? '#dcfce7' : '#f3f4f6',
                    border: hasAllocations ? '2px solid #16a34a' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: hasAllocations ? '#15803d' : '#6b7280',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {displayName}
                  {hasAllocations && (
                    <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8 }}>
                      {allocCount} slots
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Render pitch view
  const renderPitchView = () => {
    if (!selectedPitch) return null;
    
    const pitchGridStyle = {
      position: 'relative',
      backgroundColor: '#dcfce7',
      border: '4px solid white',
      borderRadius: '8px',
      padding: isMobile ? '8px' : '16px',
      width: isMobile ? '100%' : '280px',
      maxWidth: isMobile ? '320px' : '280px',
      height: isMobile ? '280px' : '400px',
      margin: '0 auto'
    };
    
    const pitchId = `pitch${selectedPitch.pitchNumber}`;
    const displayName = getPitchDisplayName(selectedPitch.pitchNumber, pitchNames, pitchNamesLoadingState);
    
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginTop: '16px'
      }}>
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={() => {
              setViewMode('map');
              setSelectedPitch(null);
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← Back to Map
          </button>
          
          <h2 style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>
            {displayName}
          </h2>
          
          <span style={{
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {getAllocationsCountForPitch(pitchId)} slots
          </span>
        </div>
        
        <div style={{ padding: '4px' }}>
          {timeSlots.map((s) => {
            const hasAllocations = hasAllocationsForTimeSlot(s, pitchId);
            
            if (!hasAllocations && actualTimeSlots.size > 0 && !actualTimeSlots.has(s)) {
              return null;
            }
            
            return (
              <div key={s} style={{ marginBottom: isMobile ? '12px' : '8px' }}>
                <h3 style={{
                  fontSize: isMobile ? '11px' : '12px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '4px',
                  textAlign: 'center'
                }}>
                  <span style={{
                    backgroundColor: hasAllocations ? '#dbeafe' : '#e5e7eb',
                    color: hasAllocations ? '#1e40af' : '#9ca3af',
                    padding: isMobile ? '2px 6px' : '4px 8px',
                    borderRadius: '9999px',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: hasAllocations ? '500' : '400',
                    opacity: hasAllocations ? 1 : 0.6
                  }}>
                    {s}
                  </span>
                </h3>
                
                {(hasAllocations || actualTimeSlots.has(s)) && (
                  <div style={pitchGridStyle}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#bbf7d0',
                      borderRadius: '8px'
                    }}></div>
                    
                    <div style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: 'repeat(4, 1fr)',
                      gap: isMobile ? '2px' : '4px',
                      height: '100%',
                      zIndex: 10
                    }}>
                      {sections.map((sec) => {
                        const alloc = findAllocation(s, pitchId, sec);
                        
                        return (
                          <div 
                            key={sec} 
                            style={{
                              border: '2px solid rgba(255,255,255,0.5)',
                              borderRadius: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: isMobile ? '10px' : '12px',
                              fontWeight: '500',
                              padding: '2px',
                              textAlign: 'center',
                              backgroundColor: alloc ? (alloc.colour || alloc.color) + '90' : 'rgba(255,255,255,0.1)',
                              borderColor: alloc ? (alloc.colour || alloc.color) : 'rgba(255,255,255,0.5)',
                              color: alloc ? (isLightColor(alloc.colour || alloc.color) ? '#000' : '#fff') : '#374151',
                              position: 'relative'
                            }}
                          >
                            {alloc && (
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                width: isMobile ? '12px' : '14px',
                                height: isMobile ? '12px' : '14px',
                                backgroundColor: alloc.type === 'training' ? '#3b82f6' : '#ef4444',
                                color: 'white',
                                fontSize: isMobile ? '7px' : '8px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '2px',
                                zIndex: 20
                              }}>
                                {alloc.type === 'training' ? 'T' : 'M'}
                              </div>
                            )}
                            
                            <div style={{
                              fontSize: isMobile ? '10px' : '12px',
                              opacity: 0.75,
                              marginBottom: isMobile ? '2px' : '4px',
                              fontWeight: 'bold'
                            }}>{sec}</div>
                            <div style={{
                              textAlign: 'center',
                              padding: '0 2px',
                              fontSize: isMobile ? '10px' : '12px',
                              lineHeight: 1.2,
                              wordBreak: 'break-word'
                            }}>
                              {alloc ? alloc.team : ''}
                            </div>
                            {alloc && alloc.isMultiSlot && (
                              <div style={{
                                fontSize: isMobile ? '9px' : '12px',
                                opacity: 0.6,
                                marginTop: '2px'
                              }}>
                                {alloc.duration}min
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: isMobile ? '12px' : '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: isMobile ? '100%' : '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          padding: isMobile ? '16px' : '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: isMobile ? '12px' : '24px'
        }}>
          <div style={{
            display: isMobile ? 'block' : 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h1 style={{
              fontSize: isMobile ? '20px' : '28px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0,
              marginBottom: isMobile ? '12px' : 0
            }}>
              {clubName} - {allocationType} Allocations
            </h1>
            {!isMobile && (
              <button
                onClick={() => window.print()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🖨️ Print
              </button>
            )}
          </div>
          
          <div style={{
            display: isMobile ? 'block' : 'flex',
            gap: '24px',
            fontSize: isMobile ? '12px' : '14px',
            color: '#6b7280'
          }}>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Date:</strong> {new Date(date).toLocaleDateString('en-US', {
                weekday: isMobile ? 'short' : 'long',
                month: isMobile ? 'short' : 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Time Range:</strong> {start}:00 - {end}:00
            </div>
            <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
              <strong>Total Allocations:</strong> {Object.keys(allocations).length}
            </div>
            {pitches.length > 0 && (
              <div style={{ marginBottom: isMobile ? '8px' : 0 }}>
                <strong>Active Pitches:</strong> {pitches.length}
              </div>
            )}
          </div>
          
          {/* Loading indicator for pitch names */}
          {pitchNamesLoadingState === 'loading' && (
            <div style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#fef3c7',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#92400e',
              display: 'inline-block'
            }}>
              Loading custom pitch names...
            </div>
          )}
        </div>

        {/* Main Content */}
        {viewMode === 'map' ? renderMapView() : renderPitchView()}
      </div>
    </div>
  );
}

export default ShareView;
