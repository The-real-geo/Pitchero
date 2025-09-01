import React, { useState, useRef, useEffect } from 'react';

const predefinedColors = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000',
  '#FF6600', '#8B00FF', '#00CED1', '#FFD700', '#8B4513', '#696969',
  '#CC0000', '#00AA00', '#1493FF', '#FF1493', '#00BFFF', '#32CD32'
];

export function ColorPicker({ color, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(color);
  const pickerRef = useRef(null);

  useEffect(() => {
    setCustomColor(color);
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const handleColorSelect = (selectedColor) => {
    onChange(selectedColor);
    setCustomColor(selectedColor);
    setShowPicker(false);
  };

  const handleCustomColorChange = (e) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <div style={{ position: 'relative' }} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        style={{
          width: '80px',
          height: '36px',
          padding: '4px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: color,
            borderRadius: '4px',
            border: '1px solid #d1d5db'
          }}
        />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>▼</span>
      </button>

      {showPicker && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '0',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '240px'
          }}
        >
          {/* Predefined Colors Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
            marginBottom: '12px'
          }}>
            {predefinedColors.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                onClick={() => handleColorSelect(presetColor)}
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: presetColor,
                  border: color === presetColor ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                  transform: color === presetColor ? 'scale(1.1)' : 'scale(1)'
                }}
                title={presetColor}
              />
            ))}
          </div>

          {/* Custom Color Input */}
          <div style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <label style={{
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '500'
            }}>
              Custom:
            </label>
            <input
              type="color"
              value={customColor}
              onChange={handleCustomColorChange}
              style={{
                width: '50px',
                height: '30px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  setCustomColor(value);
                  if (value.length === 7) {
                    onChange(value);
                  }
                }
              }}
              placeholder="#000000"
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}