// ShareView.jsx - Fixed resolver & syntax issue corrected

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';

// Resolve pitch name based on Firestore keys (canonical pitch-N)
function resolvePitchName(pitchNumber, pitchNames) {
  if (!pitchNumber) return "Pitch ?";

  // Direct match first
  if (pitchNames[pitchNumber]) {
    return pitchNames[pitchNumber];
  }

  // Canonical form: pitch-N
  const key = `pitch-${pitchNumber}`;
  if (pitchNames[key]) {
    return pitchNames[key];
  }

  return `Pitch ${pitchNumber}`;
}

async function loadPitchNames(clubId) {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../utils/firebase');
  const ref = doc(db, 'clubs', clubId, 'settings', 'general');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  return (data && data.pitchNames) || {};
}

async function getSharedAllocation(shareId) {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../utils/firebase');

  const shareSnap = await getDoc(doc(db, 'sharedAllocations', shareId));
  if (!shareSnap.exists()) throw new Error('Share not found');
  const share = shareSnap.data();

  const clubId = share.clubId;
  if (!clubId) throw new Error('Club ID missing');

  const clubSnap = await getDoc(doc(db, 'clubs', clubId));
  if (!clubSnap.exists()) throw new Error('Club not found');
  const club = clubSnap.data();

  return {
    ...share,
    clubId,
    clubName: club.name,
    satelliteConfig: {
      imageUrl: club.satelliteConfig?.imageUrl,
      imagePath: club.satelliteConfig?.imagePath,
      imageWidth: club.satelliteConfig?.imageWidth,
      imageHeight: club.satelliteConfig?.imageHeight,
      pitchBoundaries:
        club.satelliteConfig?.pitchBoundaries?.map((b, i) => ({
          pitchNumber: (b.pitchNumber ?? String(i + 1)).toString(),
          sizeType: b.sizeType || 'large',
          boundaries: b.boundaries,
        })) || [],
    },
  };
}

export default function ShareView() {
  const { shareId } = useParams();

  const [sharedData, setSharedData] = useState(null);
  const [pitchNames, setPitchNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imgUrl, setImgUrl] = useState(null);

  const pitchNamesVersion = useMemo(() => Object.keys(pitchNames).join('|'), [pitchNames]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getSharedAllocation(shareId);
        setSharedData(data);
        if (data.clubId) {
          const names = await loadPitchNames(data.clubId);
          setPitchNames(names);
        }
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  useEffect(() => {
    (async () => {
      if (!sharedData?.satelliteConfig?.imageUrl) return;
      try {
        let imagePath = sharedData.satelliteConfig.imagePath;
        if (!imagePath) {
          const m = sharedData.satelliteConfig.imageUrl.match(/\/o\/(.+?)\?alt=/);
          if (m) imagePath = decodeURIComponent(m[1]);
        }
        if (!imagePath) return;
        const { ref, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../utils/firebase');
        const url = await getDownloadURL(ref(storage, imagePath));
        setImgUrl(url);
      } catch (_) {
        // Silent
      }
    })();
  }, [sharedData]);

  const calcCanvas = useCallback((w, h) => {
    const maxW = isMobile ? Math.max(280, (typeof window !== 'undefined' ? window.innerWidth - 40 : 360)) : 1000;
    const maxH = isMobile ? 400 : 600;
    const ar = (w || 1) / (h || 1);
    let width = maxW;
    let height = width / ar;
    if (height > maxH) {
      height = maxH;
      width = height * ar;
    }
    return { width, height };
  }, [isMobile]);

  const onImgLoad = useCallback(() => {
    if (!sharedData?.satelliteConfig) return;
    const { imageWidth, imageHeight } = sharedData.satelliteConfig;
    setCanvasSize(calcCanvas(imageWidth, imageHeight));
    setImgLoaded(true);
  }, [sharedData, calcCanvas]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imgRef.current;
    const sc = sharedData?.satelliteConfig;
    if (!canvas || !image || !imgLoaded || !sc) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const sx = canvas.width / (sc.imageWidth || 1);
    const sy = canvas.height / (sc.imageHeight || 1);

    (sc.pitchBoundaries || []).forEach((p) => {
      const { x1, y1, x2, y2 } = p.boundaries || {};
      const x = (x1 || 0) * sx;
      const y = (y1 || 0) * sy;
      const w = ((x2 || 0) - (x1 || 0)) * sx;
      const h = ((y2 || 0) - (y1 || 0)) * sy;

      ctx.fillStyle = 'rgba(34,197,94,0.35)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = resolvePitchName(p.pitchNumber, pitchNames);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
    });
  }, [sharedData, imgLoaded, pitchNames]);

  useEffect(() => {
    if (imgLoaded) draw();
  }, [imgLoaded, draw, pitchNamesVersion]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;

  const sc = sharedData?.satelliteConfig;

  return (
    <div style={{ padding: isMobile ? 12 : 24, background: '#f9fafb', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: isMobile ? 20 : 28 }}>{sharedData?.clubName} – Allocations</h1>

      <div style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        {imgUrl ? (
          <>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
            />
            <img
              ref={imgRef}
              src={imgUrl}
              onLoad={onImgLoad}
              alt="Satellite"
              style={{ display: 'none' }}
            />
          </>
        ) : (
          <div style={{ height: 320, display: 'grid', placeItems: 'center', color: '#6b7280' }}>Loading satellite…</div>
        )}
      </div>

      {/* Pitch Legend */}
      <div style={{ marginTop: 16, background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <h2 style={{ fontSize: isMobile ? 16 : 18, margin: '0 0 8px' }}>Pitch Legend</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {(sc?.pitchBoundaries || []).map((p) => {
            const name = resolvePitchName(p.pitchNumber, pitchNames);
            return (
              <div key={`legend-${p.pitchNumber}-${pitchNamesVersion}`} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>
                {name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
