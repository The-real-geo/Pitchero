// Mobile-optimized ShareView.jsx with satellite map and clickable pitches
import React, { useState, useEffect } from 'react';
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

async function safeFetchJson(url) {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Expected JSON but got: ${text.slice(0, 120)}`);
  }
  return response.json();
}

const getSharedAllocation = async (shareId) => {
  try {
    const localData = localStorage.getItem(`shared_allocation_${shareId}`);
    if (localData) return JSON.parse(localData);

    const data = await safeFetchJson(`/api/shares/${shareId}`);
    return data;
  } catch (error) {
    console.error('Error fetching shared allocation:', error);

    if (shareId === 'demo' || process.env.NODE_ENV === 'development') {
      return {
        allocations: {
          '2025-09-06-09:00-pitch1-A': {
            team: 'Under 10',
            colour: '#00AA00',
            duration: 60,
            isMultiSlot: false
          },
          '2025-09-06-10:00-pitch1-B': {
            team: 'Under 12 YPL',
            colour: '#FFD700',
            duration: 60,
            isMultiSlot: false
          }
        },
        date: '2025-09-06',
        clubName: 'Demo Soccer Club',
        type: 'training',
        pitches: ['pitch1', 'pitch2'],
        pitchNames: {
          'pitch1': 'Main Training Pitch',
          'pitch2': 'Secondary Pitch'
        }
      };
    }

    throw error;
  }
};

const pitchPositions = {
  pitch1: { top: '15%', left: '10%', width: '35%', height: '25%' },
  pitch2: { top: '15%', left: '55%', width: '35%', height: '25%' },
  pitch3: { top: '45%', left: '10%', width: '35%', height: '25%' },
  pitch4: { top: '45%', left: '55%', width: '35%', height: '25%' },
  pitch5: { top: '75%', left: '10%', width: '35%', height: '20%' },
  pitch6: { top: '75%', left: '55%', width: '35%', height: '20%' },
  pitch7: { top: '5%', left: '30%', width: '40%', height: '30%' },
  pitch8: { top: '40%', left: '30%', width: '40%', height: '30%' },
  pitch9: { top: '75%', left: '30%', width: '40%', height: '20%' },
  pitch10: { top: '35%', left: '20%', width: '60%', height: '35%' },
};

function ShareView() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [viewMode, setViewMode] = useState('map');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadSharedData = async () => {
      try {
        const data = await getSharedAllocation(shareId);

        let availablePitches = [];
        let extractedDate = data?.date;

        if (data?.allocations && Object.keys(data.allocations).length > 0) {
          const pitchSet = new Set();
          const dateSet = new Set();
          Object.keys(data.allocations).forEach(key => {
            const parts = key.split('-');
            parts.forEach((part, index) => {
              if (part.match(/^‍\d{4}/) && part.length >= 8) {
                dateSet.add(part);
              } else if (index > 0 && !sections.includes(part.toUpperCase())) {
                let pitchId = part;
                if (/^\d+$/.test(pitchId)) pitchId = `pitch${pitchId}`;
                if (pitchId.startsWith('pitch')) pitchSet.add(pitchId);
              }
            });
          });

          if (data.pitches && Array.isArray(data.pitches)) {
            data.pitches.forEach(p => {
              let normalizedPitch = /^\d+$/.test(p) ? `pitch${p}` : p;
              pitchSet.add(normalizedPitch);
            });
          }

          availablePitches = Array.from(pitchSet).sort((a, b) => {
            const aNum = parseInt(a.replace(/\D/g, ''));
            const bNum = parseInt(b.replace(/\D/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return a.localeCompare(b);
          });

          if (dateSet.size > 0 && !extractedDate) {
            extractedDate = Array.from(dateSet)[0];
          }
        }

        setSharedData({
          ...data,
          pitches: availablePitches,
          date: extractedDate || data?.date || new Date().toISOString().split('T')[0]
        });
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
      <div style={{ padding: '16px', textAlign: 'center', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
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
      <div style={{ padding: '16px', textAlign: 'center', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '20px' : '24px', color: '#dc2626', marginBottom: '8px' }}>
            Error Loading Share
          </h2>
          <p style={{ color: '#7f1d1d', marginBottom: '24px', fontSize: isMobile ? '14px' : '16px' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            style={{ padding: '8px 24px', backgroundColor: '#dc2626', color: 'white',
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const renderMapView = () => (
    <div style={{ position: 'relative', width: '100%', height: '100vh',
      backgroundImage: 'url(https://upload.wikimedia.org/wikipedia/commons/e/ec/Soccer_pitch_competition.svg)',
      backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {sharedData.pitches.map(pitchId => (
        <div key={pitchId}
          onClick={() => { setSelectedPitch(pitchId); setViewMode('pitch'); }}
          style={{ position: 'absolute', ...pitchPositions[pitchId], border: '2px solid white',
            backgroundColor: 'rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold',
            fontSize: isMobile ? '10px' : '14px' }}>
          {sharedData.pitchNames?.[pitchId] || pitchId}
        </div>
      ))}
    </div>
  );

  const renderPitchView = () => (
    <div style={{ padding: '16px' }}>
      <button
        onClick={() => setViewMode('map')}
        style={{ marginBottom: '16px', padding: '6px 16px', backgroundColor: '#374151', color: 'white',
          border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
        ← Back to Map
      </button>
      <h2 style={{ marginBottom: '16px', fontSize: isMobile ? '18px' : '22px' }}>
        {sharedData.pitchNames?.[selectedPitch] || selectedPitch}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        {sections.map(section => {
          const allocationKey = Object.keys(sharedData.allocations).find(key => key.includes(`${selectedPitch}-${section}`));
          const allocation = allocationKey ? sharedData.allocations[allocationKey] : null;

          return (
            <div key={section} style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px',
              backgroundColor: allocation ? allocation.colour : '#f9fafb',
              color: allocation && isLightColor(allocation.colour) ? '#000' : '#fff' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Section {section}</div>
              {allocation ? (
                <>
                  <div>{allocation.team}</div>
                  <div style={{ fontSize: '12px', opacity: 0.9 }}>Duration: {allocation.duration} mins</div>
                </>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '12px' }}>Available</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ padding: '12px', backgroundColor: '#111827', color: 'white', textAlign: 'center' }}>
        <h1 style={{ fontSize: isMobile ? '18px' : '22px', marginBottom: '4px' }}>{sharedData.clubName}</h1>
        <div style={{ fontSize: '14px', color: '#9ca3af' }}>Allocation for {sharedData.date}</div>
      </div>
      {viewMode === 'map' ? renderMapView() : renderPitchView()}
    </div>
  );
}

export default ShareView;
