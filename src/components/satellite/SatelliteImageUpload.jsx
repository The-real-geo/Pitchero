import React, { useState } from 'react';
import { Upload, X, Check } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../../config/firebase'; // Adjust path to your firebase config

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
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Satellite Image</h2>
        <p className="text-gray-600">
          Upload an aerial/satellite view of your facility to set up interactive pitch navigation.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : uploading 
            ? 'border-gray-300 bg-gray-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-lg text-gray-600">Uploading image...</p>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <img 
              src={preview} 
              alt="Preview" 
              className="max-h-64 mx-auto rounded-lg shadow-md"
            />
            <div className="flex items-center justify-center text-green-600">
              <Check className="w-5 h-5 mr-2" />
              <span>Image uploaded successfully!</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-16 h-16 text-gray-400 mx-auto" />
            <div>
              <p className="text-xl text-gray-600 mb-2">
                Drag and drop your satellite image here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                PNG or JPEG, max 5MB. Best quality: 1920x1080 or higher, taken from directly overhead.
              </p>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <X className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Image Guidelines for Best Results:</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Take photo from directly overhead (drone preferred)</li>
          <li>• Ensure all pitch boundaries are clearly visible</li>
          <li>• Use even lighting (overcast days work best)</li>
          <li>• Higher resolution = better accuracy (1920x1080 minimum)</li>
          <li>• Remove any temporary obstacles (cars, equipment)</li>
        </ul>
      </div>
    </div>
  );
};

export default SatelliteImageUpload;
