import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Eye, Settings, Plus } from 'lucide-react';

const SatelliteOverviewMap = ({ 
  clubId, 
  satelliteConfig, 
  onPitchClick, 
  isSetupMode = false,
  onEnterSetupMode,
  onSaveConfiguration
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Drawing states for setup mode
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [tempBoundaries, setTempBoundaries] = useState([]);

  useEffect(() => {
    if (imageLoaded && canvasRef.current) {
      drawCanvas();
    }
  }, [imageLoaded, satelliteConfig, tempBoundaries]);

  // Calculate canvas size maintaining aspect ratio
  const calculateCanvasSize = (imgWidth, imgHeight) => {
    const maxWidth = 800;
    const maxHeight = 600;
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
  const drawCanvas = () => {
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

    // Draw temporary boundaries (during setup)
    tempBoundaries.forEach((pitch, index) => {
      drawPitchBoundary(ctx, pitch, scaleX, scaleY, index, true);
    });

    // Draw current drawing rectangle
    if (currentDrawing && isSetupMode) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        currentDrawing.x1 * scaleX,
        currentDrawing.y1 * scaleY,
        (currentDrawing.x2 - currentDrawing.x1) * scaleX,
        (currentDrawing.y2 - currentDrawing.y1) * scaleY
      );
      ctx.setLineDash([]);
    }
  };

  // Draw individual pitch boundary
  const drawPitchBoundary = (ctx, pitch, scaleX, scaleY, index, isTemporary = false) => {
    const x = pitch.boundaries.x1 * scaleX;
    const y = pitch.boundaries.y1 * scaleY;
    const width = (pitch.boundaries.x2 - pitch.boundaries.x1) * scaleX;
    const height = (pitch.boundaries.y2 - pitch.boundaries.y1) * scaleY;

    // Draw rectangle
    ctx.fillStyle = isTemporary ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(x, y, width, height);
    
    ctx.strokeStyle = isTemporary ? '#3B82F6' : '#16A34A';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw pitch label
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      pitch.pitchNumber || `Pitch ${index + 1}`,
      x + width / 2,
      y + height / 2
    );
  };

  // Handle mouse events for drawing (setup mode)
  const handleMouseDown = (e) => {
    if (!isSetupMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    setIsDrawing(true);
    setCurrentDrawing({ x1: x, y1: y, x2: x, y2: y });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isSetupMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / canvasSize.width) * satelliteConfig.imageWidth;
    const y = ((e.clientY - rect.top) / canvasSize.height) * satelliteConfig.imageHeight;

    setCurrentDrawing(prev => ({ ...prev, x2: x, y2: y }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDrawing) return;

    // Minimum size check
    const minSize = 20;
    const width = Math.abs(currentDrawing.x2 - currentDrawing.x1);
    const height = Math.abs(currentDrawing.y2 - currentDrawing.y1);

    if (width > minSize && height > minSize) {
      // Normalize coordinates (ensure x1 < x2, y1 < y2)
      const normalizedBoundary = {
        pitchNumber: `${tempBoundaries.length + 1}`,
        sizeType: 'large', // Default - will be configurable in next phase
        boundaries: {
          x1: Math.min(currentDrawing.x1, currentDrawing.x2),
          y1: Math.min(currentDrawing.y1, currentDrawing.y2),
          x2: Math.max(currentDrawing.x1, currentDrawing.x2),
          y2: Math.max(currentDrawing.y1, currentDrawing.y2)
        }
      };

      setTempBoundaries(prev => [...prev, normalizedBoundary]);
    }

    setIsDrawing(false);
    setCurrentDrawing(null);
  };

  // Handle pitch clicks (navigation mode)
  const handleCanvasClick = (e) => {
    if (isSetupMode) return;

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

  // Save configuration (setup mode)
  const handleSaveConfiguration = () => {
    if (onSaveConfiguration && tempBoundaries.length > 0) {
      onSaveConfiguration(tempBoundaries);
      setTempBoundaries([]);
    }
  };

  if (!satelliteConfig?.imageUrl) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Satellite Image</h3>
        <p className="text-gray-600 mb-4">Upload a satellite image to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {isSetupMode ? 'Setup Pitch Boundaries' : 'Facility Overview'}
        </h2>
        
        <div className="flex gap-2">
          {isSetupMode ? (
            <>
              <button
                onClick={handleSaveConfiguration}
                disabled={tempBoundaries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                <Eye className="w-4 h-4" />
                Save & Exit Setup
              </button>
            </>
          ) : (
            <button
              onClick={onEnterSetupMode}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit3 className="w-4 h-4" />
              Setup Pitches
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {isSetupMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            <strong>Setup Mode:</strong> Click and drag to draw rectangles around each pitch. 
            Make sure to draw inside the actual pitch boundaries for accurate click detection.
          </p>
        </div>
      )}

      {/* Canvas Container */}
      <div className="relative bg-white rounded-lg shadow-sm border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ maxWidth: '100%', height: 'auto' }}
          className={`block mx-auto ${
            isSetupMode 
              ? 'cursor-crosshair' 
              : satelliteConfig.pitchBoundaries?.length > 0 
              ? 'cursor-pointer' 
              : ''
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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

      {/* Pitch List (Setup Mode) */}
      {isSetupMode && tempBoundaries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Drawn Pitches ({tempBoundaries.length})</h3>
          <div className="grid gap-2">
            {tempBoundaries.map((pitch, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Pitch {pitch.pitchNumber}</span>
                <span className="text-sm text-gray-600">
                  {pitch.sizeType} ({Math.round(pitch.boundaries.x2 - pitch.boundaries.x1)} × {Math.round(pitch.boundaries.y2 - pitch.boundaries.y1)}px)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SatelliteOverviewMap;
