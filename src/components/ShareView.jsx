// Mobile-optimized ShareView.jsx with satellite map and clickable pitches
// Fixed CORS issue using Firebase SDK with proper public access
// UPDATED: Now fetches custom pitch names from settings

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];

function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

// Function to get shared allocation data
const getSharedAllocation = async (shareId) => {
  try {
    // Import Firebase here (adjust the path to match your project structure)
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../utils/firebase'); // Adjust path as needed
    
    // Get the shared allocation data from Firebase
    const shareDoc = await getDoc(doc(db, 'sharedAllocations', shareId));
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const shareData = shareDoc.data();
    console.log('Share data:', shareData);
    
    // Get the club data to fetch satelliteConfig and pitchBoundaries
    const clubId = shareData.clubId;
    if (!clubId) {
      throw new Error('Club ID not found in share data');
    }
    
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) {
      throw new Error('Club not found');
    }
    
    const clubData = clubDoc.data();
    console.log('Club data:', clubData);
    
    // CRITICAL: Load pitch names from settings/general document (same as ClubPitchMap)
    let pitchNames = {};
    try {
      const settingsRef = doc(db, 'clubs', clubId, 'settings', 'general');
      console.log('🔍 FETCHING PITCH NAMES FROM:', `clubs/${clubId}/settings/general`);
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        console.log('📋 SETTINGS DATA:', settingsData);
        
        if (settingsData.pitchNames) {
          pitchNames = settingsData.pitchNames;
          console.log('✅ PITCH NAMES LOADED:', pitchNames);
        } else {
          console.log('❌ NO pitchNames FIELD IN SETTINGS');
        }
      } else {
        console.log('❌ SETTINGS DOCUMENT DOES NOT EXIST');
      }
    } catch (settingsError) {
      console.error('❌ ERROR LOADING PITCH NAMES:', settingsError);
    }
    
    // Combine the share data with club satellite config and pitch names
    return {
      ...shareData,
      clubName: clubData.name,
      pitchNames: pitchNames, // Add pitch names to the returned data
      satelliteConfig: {
        imageUrl: clubData.satelliteConfig?.imageUrl,
        imagePath: clubData.satelliteConfig?.imagePath, // Store the Firebase path for SDK usage
        imageWidth: clubData.satelliteConfig?.imageWidth,
        imageHeight: clubData.satelliteConfig?.imageHeight,
        pitchBoundaries: clubData.satelliteConfig?.pitchBoundaries?.map((boundary, index) => ({
          pitchNumber: (index + 1).toString(), // Convert 0-based to 1-based numbering
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

// Helper function to get display name for a pitch (same logic as ClubPitchMap)
const getPitchDisplayName = (pitchNumber, pitchNames) => {
  // Try different key formats - same as ClubPitchMap
  const possibleKeys = [
    `pitch-${pitchNumber}`,     // "pitch-1" (this is what's in Firebase)
    `pitch${pitchNumber}`,      // "pitch1"
    `Pitch ${pitchNumber}`,     // "Pitch 1"
    `Pitch-${pitchNumber}`,     // "Pitch-1"
    pitchNumber.toString(),     // "1"
  ];
  
  // Find the first key that exists in pitchNames
  for (const key of possibleKeys) {
    if (pitchNames && pitchNames[key]) {
      console.log(`✔ Found custom name for key "${key}": ${pitchNames[key]}`);
      return pitchNames[key];
    }
  }
  
  // Fallback if no custom name found
  return `Pitch ${pitchNumber}`;
};

function ShareView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'pitch'
  
  // Canvas and image refs for satellite rendering
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Firebase SDK image loading states
  const [firebaseImageUrl, setFirebaseImageUrl] = useState(null);
  const [imageLoadingState, setImageLoadingState] = useState('idle'); // 'idle', 'loading', 'loaded', 'error'
  const [imageError, setImageError] = useState(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Firebase SDK image loading - Fixed for proper public access
  useEffect(() => {
    const loadFirebaseImage = async () => {
      if (!sharedData?.satelliteConfig?.imageUrl) return;
      
      try {
        setImageLoadingState('loading');
        setImageError(null);
        
        let imagePath = sharedData.satelliteConfig.imagePath;
        
        // If no imagePath, extract from the imageUrl
        if (!imagePath && sharedData.satelliteConfig.imageUrl) {
          const pathMatch = sharedData.satelliteConfig.imageUrl.match(/\/o\/(.+?)\?alt=/);
          if (pathMatch) {
            imagePath = decodeURIComponent(pathMatch[1]);
            console.log('Extracted path from URL:', imagePath);
          }
        }
        
        // Use Firebase SDK to get public access URL
        if (imagePath) {
          console.log('Loading image via Firebase SDK:', imagePath);
          
          const { ref, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../utils/firebase'); // Adjust path as needed
          
          // Create a reference to the image using the path
          const imageRef = ref(storage, imagePath);
          
          // Get the download URL using Firebase SDK (generates proper public access token)
          const publicUrl = await getDownloadURL(imageRef);
          
          console.log('Firebase SDK generated public URL successfully');
          setFirebaseImageUrl(publicUrl);
          setImageLoadingState('loaded');
          
        } else {
          // No path available - this will likely fail due to CORS
          console.log('No Firebase path available, cannot use SDK - image will likely fail to load');
          setImageError('No Firebase storage path available');
          setImageLoadingState('error');
        }
        
      } catch (error) {
        console.error('Error loading Firebase image:', error);
        setImageError(error.message || 'Failed to load satellite image');
        setImageLoadingState('error');
      }
    };

    if (sharedData?.satelliteConfig) {
      loadFirebaseImage();
    }
  }, [sharedData]);

  // Calculate canvas size maintaining aspect ratio
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

  // Draw the canvas with image and pitch boundaries
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded || !sharedData?.satelliteConfig) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw satellite image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Scale factor for coordinates
    const scaleX = canvas.width / sharedData.satelliteConfig.imageWidth;
    const scaleY = canvas.height / sharedData.satelliteConfig.imageHeight;

    const allocations = sharedData?.allocations || {};
    const pitchNames = sharedData?.pitchNames || {};

    // Draw pitch boundaries
    if (sharedData.satelliteConfig.pitchBoundaries) {
      sharedData.satelliteConfig.pitchBoundaries.forEach((pitch) => {
        const x = pitch.boundaries.x1 * scaleX;
        const y = pitch.boundaries.y1 * scaleY;
        const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
        const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

        // Check if this pitch has allocations
        const pitchNum = pitch.pitchNumber;
        const hasAllocations = Object.keys(allocations).some(key => {
          const parts = key.split('-');
          return parts.some(part => part === pitchNum || part === `pitch${pitchNum}`);
        });

        // Draw rectangle
        ctx.fillStyle = hasAllocations ? 'rgba(34, 197, 94, 0.6)' : 'rgba(34, 197, 94, 0.3)';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Get display name for the pitch
        const displayName = getPitchDisplayName(pitch.pitchNumber, pitchNames);

        // Draw pitch name
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 3;
        ctx.font = `bold ${Math.max(14, Math.min(20, width / 8))}px sans-serif`;
        ctx.textAlign = 'center';
        
        // Draw text outline
        ctx.strokeText(displayName, x + width / 2, y + height / 2 + 8);
        // Draw text fill
        ctx.fillText(displayName, x + width / 2, y + height / 2 + 8);

        // Draw allocation count if has allocations
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
  }, [imageLoaded, sharedData, drawCanvas, viewMode]); // Added viewMode dependency

  // Additional effect to redraw canvas when returning to map view
  useEffect(() => {
    if (viewMode === 'map' && imageLoaded && canvasRef.current && sharedData) {
      // Small delay to ensure canvas is properly mounted
      const timer = setTimeout(() => {
        drawCanvas();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [viewMode, imageLoaded, sharedData, drawCanvas]);

  // Handle canvas click to select pitch
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !sharedData?.satelliteConfig) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * sharedData.satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * sharedData.satelliteConfig.imageHeight;

    // Check which pitch was clicked
    const clickedPitch = sharedData.satelliteConfig.pitchBoundaries?.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch) {
      setSelectedPitch(clickedPitch);
      setViewMode('pitch');
    }
  };

  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const data = await getSharedAllocation(shareId);
        
        console.log('=== SHARE DATA DEBUG ===');
        console.log('Full data:', data);
        console.log('Pitch names:', data.pitchNames);
        
        // Extract pitches from allocation keys
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
                // Check if this could be a pitch
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
        
      } catch (err) {
        console.error('Error loading shared data:', err);
        setError(err.message || 'Failed to load shared allocation');
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedData();
  }, [shareId]);

  if (loading) {
    return (
      <div style={{ 
        padding: '16px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', color: '#374151', marginBottom: '8px' }}>
            Loading allocation...
          </h2>
          <p style={{ color: '#6b7280', fontSize: isMobile ? '14px' : '16px' }}>
            Please wait while we fetch the shared data
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '16px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2'
      }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', color: '#dc2626', marginBottom: '8px' }}>
            Error Loading Share
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '24px', fontSize: isMobile ? '14px' : '16px' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 24px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const allocations = sharedData?.allocations || {};
  const date = sharedData?.date || new Date().toISOString().split('T')[0];
  const clubName = sharedData?.clubName || 'Soccer Club';
  const allocationType = sharedData?.type === 'match' ? 'Match Day' : sharedData?.type === 'training' ? 'Training' : 'Pitch';
  const pitches = sharedData?.pitches || [];
  const pitchNames = sharedData?.pitchNames || {};
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

  // Allocation lookup
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

  // Render satellite map view with canvas
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
        {/* Canvas for satellite map */}
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
            
            {/* Loading state */}
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
            
            {/* Hidden image element for loading */}
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
          /* Loading state */
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
          /* Error state */
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
          /* Fallback if no satellite image */
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

      {/* Pitch List for mobile when no satellite */}
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
              const displayName = getPitchDisplayName(pitch.pitchNumber, pitchNames);
              
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
                    textAlign: 'center'
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

  // Render pitch allocations view
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
    const displayName = getPitchDisplayName(selectedPitch.pitchNumber, pitchNames);
    
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        marginTop: '16px'
      }}>
        {/* Header with Back Button */}
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
        
        {/* Allocations Grid */}
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
                            {/* Type indicator icon */}
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
        </div>

        {/* Main Content */}
        {viewMode === 'map' ? renderMapView() : renderPitchView()}
      </div>
    </div>
  );
}

export default ShareView;
