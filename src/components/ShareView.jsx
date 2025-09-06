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

// Safe fetch wrapper
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

// Function to get shared allocation data
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

// Pitch layout positions (same as main app)
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
  // ... rest of your ShareView component code stays the same ...
}

export default ShareView;
