// src/components/satellite/SatelliteImageUpload.jsx
import React, { useState } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../../utils/firebase';

const SatelliteImageUpload = ({ clubId, onImageUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  // Validate image before upload
  const validateImage = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a JPEG or PNG image';
    }
    
    if (file.size > maxSize) {
      return 'Image must be smaller than 5MB';
    }
    
    return null;
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    setError('');
    
    // Validate file
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase Storage
    await uploadSatelliteImage(file);
  };

  // Upload image to Firebase
  const uploadSatelliteImage = async (file) => {
    setUploading(true);
    
    try {
      // Create storage reference
      const storageRef = ref(storage, `clubs/${clubId}/satellite-${Date.now()}.${file.name.split('.').pop()}`);
      
      // Upload file
      const uploadResult = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      // Get image dimensions
      const img = new Image();
      img.onload = async () => {
        // Update club document with satellite config
        const clubRef = doc(db, 'clubs', clubId);
        
        await updateDoc(clubRef, {
          'satelliteConfig.imageUrl': downloadURL,
          'satelliteConfig.imageWidth': img.width,
          'satelliteConfig.imageHeight': img.height,
          'satelliteConfig.lastUpdated': new Date()
        });
        
        // Notify parent component
        onImageUploaded({
          url: downloadURL,
          width: img.width,
          height: img.height
        });
        
        setUploading(false);
      };
      
      img.src = downloadURL;
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#1f2937', 
          marginBottom: '8px' 
        }}>Upload Satellite Image</h2>
        <p style={{ color: '#6b7280' }}>
          Upload an aerial/satellite view of your facility to set up interactive pitch navigation.
        </p>
      </div>

      {/* Upload Area */}
      <div
        style={{
          position: 'relative',
          border: `2px dashed ${dragActive ? '#3b82f6' : uploading ? '#9ca3af' : '#d1d5db'}`,
          borderRadius: '12px',
          padding: '48px 32px',
          textAlign: 'center',
          backgroundColor: dragActive ? '#eff6ff' : uploading ? '#f9fafb' : 'white',
          transition: 'all 0.2s ease',
          cursor: uploading ? 'not-allowed' : 'pointer'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <p style={{ fontSize: '18px', color: '#6b7280' }}>Uploading image...</p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <img 
              src={preview} 
              alt="Preview" 
              style={{ 
                maxHeight: '300px', 
                borderRadius: '8px', 
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' 
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', color: '#10b981' }}>
              <Check size={20} style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>Image uploaded successfully!</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Upload size={64} color="#9ca3af" />
            <div>
              <p style={{ fontSize: '20px', color: '#374151', marginBottom: '8px' }}>
                Drag and drop your satellite image here, or click to browse
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                PNG or JPEG, max 5MB. Best quality: 1920x1080 or higher, taken from directly overhead.
              </p>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleInputChange}
              disabled={uploading}
              style={{
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <X size={20} color="#dc2626" style={{ marginRight: '8px' }} />
            <span style={{ color: '#dc2626' }}>{error}</span>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div style={{
        marginTop: '32px',
        backgroundColor: '#eff6ff',
        border: '1px solid '#bfdbfe',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{ 
          fontWeight: '600', 
          color: '#1e40af', 
          marginBottom: '12px' 
        }}>Image Guidelines for Best Results:</h3>
        <ul style={{ 
          color: '#1e40af', 
          fontSize: '14px',
          lineHeight: '1.6',
          paddingLeft: '20px',
          margin: 0
        }}>
          <li>Take photo from directly overhead (drone preferred)</li>
          <li>Ensure all pitch boundaries are clearly visible</li>
          <li>Use even lighting (overcast days work best)</li>
          <li>Higher resolution = better accuracy (1920x1080 minimum)</li>
          <li>Remove any temporary obstacles (cars, equipment)</li>
        </ul>
      </div>
    </div>
  );
};

export default SatelliteImageUpload;
