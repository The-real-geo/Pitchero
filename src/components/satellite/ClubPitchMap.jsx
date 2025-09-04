// src/components/satellite/ClubPitchMap.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';

const ClubPitchMap = ({ 
  clubId, 
  satelliteConfig, 
  onPitchClick 
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Calculate canvas size maintaining aspect ratio
  const calculateCanvasSize = (imgWidth, imgHeight) => {
    const maxWidth = 1000;
    const maxHeight = 700;
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
    if (imageRef.current && satelliteConfig) {
      const size = calculateCanvasSize(
        satelliteConfig.imageWidth, 
        satelliteConfig.imageHeight
      );
      setCanvasSize(size);
      setImageLoaded(true);
    }
  };

  // Draw the canvas with image and pitch boundaries
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw satellite image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Scale factor for coordinates
    const scaleX = canvas.width / satelliteConfig.imageWidth;
    const scaleY = canvas.height / satelliteConfig.imageHeight;

    // Draw existing pitch boundaries
    if (satelliteConfig.pitchBoundaries) {
      satelliteConfig.pitchBoundaries.forEach((pitch, index) => {
        drawPitchBoundary(ctx, pitch, scaleX, scaleY, index);
      });
    }
  }, [imageLoaded, satelliteConfig]);

  // Draw individual pitch boundary
  const drawPitchBoundary = (ctx, pitch, scaleX, scaleY, index) => {
    const x = pitch.boundaries.x1 * scaleX;
    const y = pitch.boundaries.y1 * scaleY;
    const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
    const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

    // Draw rectangle
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw pitch label
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      pitch.pitchNumber || `Pitch ${index + 1}`,
      x + width / 2,
      y + height / 2
    );
  };

  useEffect(() => {
    if (imageLoaded && canvasRef.current) {
      drawCanvas();
    }
  }, [imageLoaded, satelliteConfig, drawCanvas]);

  // Handle pitch clicks (navigation mode)
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    // Check which pitch was clicked
    const clickedPitch = satelliteConfig.pitchBoundaries?.find(pitch => {
      const bounds = pitch.boundaries;
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });

    if (clickedPitch && onPitchClick) {
      onPitchClick(clickedPitch);
    }
  };

  if (!satelliteConfig?.imageUrl) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        margin: '0 auto',
        maxWidth: '600px'
      }}>
        <Settings size={64} color="#9ca3af" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
          No Satellite Image
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          No satellite image has been configured for this facility yet
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          margin: 0 
        }}>
          BeansFC Facility Overview
        </h2>
      </div>

      {/* Canvas Container */}
      <div style={{
        position: 'relative',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            cursor: satelliteConfig.pitchBoundaries?.length > 0 ? 'pointer' : 'default'
          }}
          onClick={handleCanvasClick}
        />
        
        {/* Hidden image element for loading */}
        <img
          ref={imageRef}
          src={satelliteConfig.imageUrl}
          onLoad={handleImageLoad}
          style={{ display: 'none' }}
          alt="Satellite view"
        />
      </div>

      {/* Navigation Instructions */}
      {satelliteConfig.pitchBoundaries?.length > 0 && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#0c4a6e', margin: 0 }}>
            Click on any pitch area to navigate to the detailed allocation view for that pitch.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClubPitchMap;
