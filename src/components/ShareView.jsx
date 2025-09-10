// ShareView.jsx - Cleaned-up version with proper pitch names re-rendering (using canonical pitch-N keys)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// Helper: get pitch name with fallback (DB always stores as pitch-N)
const getPitchDisplayName = (pitchNumber, pitchNames) => {
  const key = `pitch-${pitchNumber}`;
  if (pitchNames && pitchNames[key]) {
    return pitchNames[key];
  }
  return `Pitch ${pitchNumber}`;
};

// Load pitch names
const loadPitchNames = async (clubId) => {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../utils/firebase');
  try {
    const settingsRef = doc(db, 'clubs', clubId, 'settings', 'general');
    const settingsDoc = await getDoc(settingsRef);
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return data.pitchNames || {};
    }
    return {};
  } catch (err) {
    console.error('Failed to load pitch names:', err);
    return {};
  }
};

// Load shared allocation
const getSharedAllocation = async (shareId) => {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../utils/firebase');
  const shareDoc = await getDoc(doc(db, 'sharedAllocations', shareId));
  if (!shareDoc.exists()) throw new Error('Share not found');
  const shareData = shareDoc.data();
  const clubId = shareData.clubId;
  if (!clubId) throw new Error('Club ID missing');
  const clubDoc = await getDoc(doc(db, 'clubs', clubId));
  if (!clubDoc.exists()) throw new Error('Club not found');
  const clubData = clubDoc.data();
  return {
    ...shareData,
    clubId,
    clubName: clubData.name,
    satelliteConfig: {
      imageUrl: clubData.satelliteConfig?.imageUrl,
      imagePath: clubData.satelliteConfig?.imagePath,
      imageWidth: clubData.satelliteConfig?.imageWidth,
      imageHeight: clubData.satelliteConfig?.imageHeight,
      pitchBoundaries: clubData.satelliteConfig?.pitchBoundaries?.map((b, i) => ({
        pitchNumber: (i + 1).toString(),
        sizeType: b.sizeType || 'large',
        boundaries: b.boundaries
      })) || []
    }
  };
};

function ShareView() {
  const { shareId } = useParams();
  const [sharedData, setSharedData] = useState(null);
  const [pitchNames, setPitchNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [firebaseImageUrl, setFirebaseImageUrl] = useState(null);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await getSharedAllocation(shareId);
        setSharedData(data);
        if (data.clubId) {
          const names = await loadPitchNames(data.clubId);
          setPitchNames(names);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [shareId]);

  useEffect(() => {
    const loadImage = async () => {
      if (!sharedData?.satelliteConfig?.imageUrl) return;
      try {
        let imagePath = sharedData.satelliteConfig.imagePath;
        if (!imagePath) {
          const match = sharedData.satelliteConfig.imageUrl.match(/\/o\/(.+?)\?alt=/);
          if (match) imagePath = decodeURIComponent(match[1]);
        }
        if (imagePath) {
          const { ref, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../utils/firebase');
          const imageRef = ref(storage, imagePath);
          const url = await getDownloadURL(imageRef);
          setFirebaseImageUrl(url);
        }
      } catch (err) {
        console.error('Image load failed', err);
      }
    };
    if (sharedData) loadImage();
  }, [sharedData]);

  const calculateCanvasSize = (w, h) => {
    const maxW = isMobile ? window.innerWidth - 40 : 1000;
    const maxH = isMobile ? 400 : 600;
    const aspect = w / h;
    let width = maxW;
    let height = width / aspect;
    if (height > maxH) {
      height = maxH;
      width = height * aspect;
    }
    return { width, height };
  };

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

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded || !sharedData?.satelliteConfig) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / sharedData.satelliteConfig.imageWidth;
    const scaleY = canvas.height / sharedData.satelliteConfig.imageHeight;
    if (sharedData.satelliteConfig.pitchBoundaries) {
      sharedData.satelliteConfig.pitchBoundaries.forEach((pitch) => {
        const x = pitch.boundaries.x1 * scaleX;
        const y = pitch.boundaries.y1 * scaleY;
        const w = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
        const h = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;
        ctx.fillStyle = 'rgba(34,197,94,0.4)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const name = getPitchDisplayName(pitch.pitchNumber, pitchNames);
        ctx.fillText(name, x + w / 2, y + h / 2);
      });
    }
  }, [imageLoaded, sharedData, pitchNames]);

  useEffect(() => {
    if (imageLoaded && sharedData) drawCanvas();
  }, [imageLoaded, sharedData, drawCanvas, pitchNames]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const satelliteConfig = sharedData?.satelliteConfig;

  return (
    <div style={{ padding: isMobile ? '12px' : '24px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <h1>{sharedData.clubName} Allocations</h1>
      <div>
        {firebaseImageUrl && (
          <>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            <img
              ref={imageRef}
              src={firebaseImageUrl}
              onLoad={handleImageLoad}
              style={{ display: 'none' }}
              alt="satellite"
            />
          </>
        )}
      </div>
      <div style={{ marginTop: '20px' }}>
        <h2>Pitch Legend</h2>
        {satelliteConfig?.pitchBoundaries?.map((p) => {
          const name = getPitchDisplayName(p.pitchNumber, pitchNames);
          // Force re-render when pitchNames change
          return (
            <div key={`pitch-${p.pitchNumber}-${Object.keys(pitchNames).join(',')}`}>
              {name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShareView;
