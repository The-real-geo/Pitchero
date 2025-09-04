// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, query, where, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // NEW: Added Firebase Storage

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC96Yt2uRUrkSkBD3urTK_7s5geQjFZkkI",
  authDomain: "pitchero-eae06.firebaseapp.com",
  projectId: "pitchero-eae06",
  storageBucket: "pitchero-eae06.firebasestorage.app",
  messagingSenderId: "1083501668068",
  appId: "1:1083501668068:web:fb52dc9468fffb63f5eef1",
  measurementId: "G-YHQSHKNRRZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore reference
export const db = getFirestore(app);

// Firebase Authentication reference
export const auth = getAuth(app);

// Firebase Storage reference
export const storage = getStorage(app); // NEW: Added Storage reference

// Export serverTimestamp for use in other files
export { serverTimestamp };

// ================================
// EXISTING USER PROFILE FUNCTIONS
// ================================

export const getUserProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (err) {
    console.error("Error getting user profile:", err);
    return null;
  }
};

export const createUserProfile = async (userId, email, clubId, role = 'member') => {
  try {
    await setDoc(doc(db, 'users', userId), {
      email: email,
      clubId: clubId,
      role: role,
      createdAt: Date.now()
    });
    console.log("User profile created");
  } catch (err) {
    console.error("Error creating user profile:", err);
    throw err;
  }
};

// ================================
// EXISTING SHARING FUNCTIONS
// ================================

// Create a shareable link for allocations (existing function - kept for backward compatibility)
export const createShareableLink = async (allocatorType, allocations, date, clubId, clubName) => {
  try {
    // Generate a unique share ID
    const shareId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a snapshot of current allocations
    const shareData = {
      type: allocatorType, // 'training' or 'match'
      allocations: allocations,
      date: date,
      clubId: clubId,
      clubName: clubName || 'Unknown Club',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    // Save to a public collection in Firebase
    await setDoc(doc(db, 'sharedAllocations', shareId), shareData);
    
    // Return the shareable URL
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    return { url: shareUrl, shareId: shareId };
  } catch (error) {
    console.error('Error creating shareable link:', error);
    throw error;
  }
};

// Create shared allocation - new function for TrainingPitchAllocator
export const createSharedAllocation = async (shareId, shareData) => {
  try {
    const shareRef = doc(db, 'sharedAllocations', shareId);
    await setDoc(shareRef, shareData);
    return shareId;
  } catch (error) {
    console.error('Error creating shared allocation:', error);
    throw error;
  }
};

// Retrieve shared allocation data
export const getSharedAllocation = async (shareId) => {
  try {
    const docRef = doc(db, 'sharedAllocations', shareId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Check if link has expired
      if (new Date(data.expiresAt) < new Date()) {
        throw new Error('This share link has expired');
      }
      
      return data;
    } else {
      throw new Error('Share link not found');
    }
  } catch (error) {
    console.error('Error retrieving shared allocation:', error);
    throw error;
  }
};

// ================================
// EXISTING CLUB FUNCTIONS
// ================================

// Club Functions - FIXED to use 'code' field
export const createClub = async (clubName, createdBy) => {
  try {
    // Generate a 6-character club ID
    const clubId = Math.random().toString(36).substr(2, 6).toUpperCase();
    
    await setDoc(doc(db, 'clubs', clubId), {
      name: clubName,
      code: clubId,  // FIXED: Changed from 'clubId' to 'code' to match Firestore rules
      createdBy: createdBy || auth.currentUser?.uid, // Support passing createdBy or use current user
      createdAt: serverTimestamp(), // Use serverTimestamp for proper timestamp
      subscription: 'active'
    });
    
    console.log(`Club created: ${clubName} (ID: ${clubId})`);
    return clubId;
  } catch (err) {
    console.error("Error creating club:", err);
    throw err;
  }
};

export const getClubInfo = async (clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    return clubDoc.exists() ? clubDoc.data() : null;
  } catch (err) {
    console.error("Error getting club info:", err);
    return null;
  }
};

export const getAllClubs = async () => {
  try {
    const clubsSnapshot = await getDocs(collection(db, 'clubs'));
    return clubsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error("Error getting clubs:", err);
    return [];
  }
};

// ================================
// NEW: SATELLITE CONFIGURATION FUNCTIONS
// ================================

// Initialize satellite configuration for a club
export const initializeSatelliteConfig = async (clubId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    const clubRef = doc(db, 'clubs', clubId);
    
    await updateDoc(clubRef, {
      'satelliteConfig': {
        imageUrl: null,
        imageWidth: 0,
        imageHeight: 0,
        lastUpdated: null,
        pitchBoundaries: []
      }
    });
    
    console.log(`Satellite config initialized for club: ${clubId}`);
    return true;
  } catch (err) {
    console.error("Error initializing satellite config:", err);
    throw err;
  }
};

// Update satellite image URL and dimensions
export const updateSatelliteImage = async (clubId, imageUrl, imageWidth, imageHeight) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    const clubRef = doc(db, 'clubs', clubId);
    
    await updateDoc(clubRef, {
      'satelliteConfig.imageUrl': imageUrl,
      'satelliteConfig.imageWidth': imageWidth,
      'satelliteConfig.imageHeight': imageHeight,
      'satelliteConfig.lastUpdated': serverTimestamp()
    });
    
    console.log(`Satellite image updated for club: ${clubId}`);
    return true;
  } catch (err) {
    console.error("Error updating satellite image:", err);
    throw err;
  }
};

// Save pitch boundaries configuration
export const savePitchBoundaries = async (clubId, pitchBoundaries) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Ensure user belongs to the club (security check)
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile || userProfile.clubId !== clubId) {
      throw new Error('User not authorized for this club');
    }
    
    const clubRef = doc(db, 'clubs', clubId);
    
    // Add additional metadata to boundaries
    const boundariesWithMetadata = pitchBoundaries.map((boundary, index) => ({
      ...boundary,
      pitchId: boundary.pitchId || `pitch-${index + 1}`,
      sectionsAvailable: getSectionsForSize(boundary.sizeType),
      isActive: true,
      createdBy: user.uid,
      createdAt: serverTimestamp()
    }));
    
    await updateDoc(clubRef, {
      'satelliteConfig.pitchBoundaries': boundariesWithMetadata,
      'satelliteConfig.lastUpdated': serverTimestamp()
    });
    
    console.log(`Pitch boundaries saved for club: ${clubId}`);
    return true;
  } catch (err) {
    console.error("Error saving pitch boundaries:", err);
    throw err;
  }
};

// Get satellite configuration for a club
export const getSatelliteConfig = async (clubId) => {
  try {
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    
    if (clubDoc.exists()) {
      const data = clubDoc.data();
      return data.satelliteConfig || null;
    }
    
    return null;
  } catch (err) {
    console.error("Error getting satellite config:", err);
    return null;
  }
};

// Upload satellite image to Firebase Storage
export const uploadSatelliteImage = async (clubId, imageFile) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error('Please upload a JPEG or PNG image');
    }
    
    if (imageFile.size > maxSize) {
      throw new Error('Image must be smaller than 5MB');
    }
    
    // Create storage reference
    const timestamp = Date.now();
    const fileExtension = imageFile.name.split('.').pop();
    const fileName = `satellite-${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, `clubs/${clubId}/${fileName}`);
    
    // Upload file
    console.log('Uploading satellite image...');
    const uploadResult = await uploadBytes(storageRef, imageFile);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    console.log('Satellite image uploaded successfully:', downloadURL);
    return {
      url: downloadURL,
      fileName: fileName,
      size: imageFile.size
    };
  } catch (err) {
    console.error("Error uploading satellite image:", err);
    throw err;
  }
};

// Helper function to get sections based on pitch size
const getSectionsForSize = (sizeType) => {
  const sizeConfig = {
    small: 1,   // Training pitch
    medium: 4,  // Junior pitch  
    large: 8    // Full pitch
  };
  return sizeConfig[sizeType] || 8;
};

// Delete pitch boundary
export const deletePitchBoundary = async (clubId, pitchId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Get current satellite config
    const satelliteConfig = await getSatelliteConfig(clubId);
    if (!satelliteConfig?.pitchBoundaries) {
      throw new Error('No pitch boundaries found');
    }
    
    // Filter out the pitch to delete
    const updatedBoundaries = satelliteConfig.pitchBoundaries.filter(
      boundary => boundary.pitchId !== pitchId
    );
    
    const clubRef = doc(db, 'clubs', clubId);
    await updateDoc(clubRef, {
      'satelliteConfig.pitchBoundaries': updatedBoundaries,
      'satelliteConfig.lastUpdated': serverTimestamp()
    });
    
    console.log(`Deleted pitch boundary: ${pitchId}`);
    return true;
  } catch (err) {
    console.error("Error deleting pitch boundary:", err);
    throw err;
  }
};

// ================================
// EXISTING ALLOCATION FUNCTIONS (UNCHANGED)
// ================================

// Multi-tenant Allocation Functions
export const saveAllocation = async (allocatorType, allocation, date, clubId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Use provided clubId or get user's clubId
    let targetClubId = clubId;
    if (!targetClubId) {
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile?.clubId) throw new Error('User not assigned to club');
      targetClubId = userProfile.clubId;
    }
    
    const docRef = await addDoc(collection(db, allocatorType), {
      ...allocation,
      date: date,
      clubId: targetClubId,
      createdBy: user.uid,
      created: Date.now()
    });
    console.log("Allocation saved with ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("Error saving allocation:", err);
    throw err;
  }
};

export const loadAllocations = async (allocatorType, date, clubId) => {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    // Use provided clubId or get user's clubId
    let targetClubId = clubId;
    if (!targetClubId) {
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile?.clubId) return [];
      targetClubId = userProfile.clubId;
    }
    
    console.log(`Loading ${allocatorType} for date: ${date}, club: ${targetClubId}`);
    
    // Filter by both date AND clubId
    const q = query(
      collection(db, allocatorType), 
      where("date", "==", date),
      where("clubId", "==", targetClubId)
    );
    
    const querySnapshot = await getDocs(q);
    const allocations = querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    console.log(`Loaded ${allocations.length} allocations for club`);
    return allocations;
  } catch (err) {
    console.error("Error loading allocations:", err);
    return [];
  }
};

export const clearAllAllocations = async (allocatorType, date, clubId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Use provided clubId or get user's clubId
    let targetClubId = clubId;
    if (!targetClubId) {
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile?.clubId) throw new Error('User not assigned to club');
      targetClubId = userProfile.clubId;
    }
    
    console.log(`Clearing all ${allocatorType} for date: ${date}, club: ${targetClubId}`);
    
    // Filter by both date AND clubId for safety
    const q = query(
      collection(db, allocatorType), 
      where("date", "==", date),
      where("clubId", "==", targetClubId)
    );
    
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, allocatorType, docSnapshot.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`Cleared ${deletePromises.length} allocations for club`);
  } catch (err) {
    console.error("Error clearing allocations:", err);
    throw err;
  }
};

// Fixed deleteAllocation function - uses docId directly
export const deleteAllocation = async (allocatorType, docId, date, clubId) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Use provided clubId or get user's clubId for security check
    let targetClubId = clubId;
    if (!targetClubId) {
      const userProfile = await getUserProfile(user.uid);
      if (!userProfile?.clubId) throw new Error('User not assigned to club');
      targetClubId = userProfile.clubId;
    }
    
    // First, verify the document exists and belongs to the correct club
    const docRef = doc(db, allocatorType, docId);
    const docSnapshot = await getDoc(docRef);
    
    if (!docSnapshot.exists()) {
      console.log(`Allocation not found: ${docId} - may have been already deleted`);
      return;
    }
    
    const allocation = docSnapshot.data();
    
    // Security check - ensure document belongs to the correct club
    if (allocation.clubId !== targetClubId) {
      throw new Error('Cannot delete allocation from different club');
    }
    
    // Delete the document
    await deleteDoc(docRef);
    console.log(`Deleted allocation: ${docId}`);
  } catch (err) {
    console.error("Error deleting allocation:", err);
    // Check if it's a "document not found" error
    if (err.code === 'not-found') {
      console.log(`Allocation not found: ${docId} - may have been already deleted`);
    } else {
      throw err;
    }
  }
};

// ================================
// EXISTING USER MANAGEMENT FUNCTIONS
// ================================

// User Management Functions (for admins)
export const getUsersInClub = async (clubId) => {
  try {
    const q = query(collection(db, 'users'), where("clubId", "==", clubId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error("Error getting club users:", err);
    return [];
  }
};

export const updateUserRole = async (userId, newRole) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  
  try {
    // Verify current user is admin of the same club
    const currentUserProfile = await getUserProfile(currentUser.uid);
    const targetUserProfile = await getUserProfile(userId);
    
    if (currentUserProfile?.role !== 'admin') {
      throw new Error('Only admins can change user roles');
    }
    
    if (currentUserProfile?.clubId !== targetUserProfile?.clubId) {
      throw new Error('Cannot modify users from different clubs');
    }
    
    await setDoc(doc(db, 'users', userId), {
      ...targetUserProfile,
      role: newRole,
      updatedAt: Date.now()
    });
    
    console.log("User role updated");
  } catch (err) {
    console.error("Error updating user role:", err);
    throw err;
  }
};

// ================================
// EXISTING TEST FUNCTIONS
// ================================

// Test Functions
export const testFirebaseConnection = async () => {
  try {
    console.log("Testing Firebase connection...");
    const testCollection = collection(db, 'connectionTest');
    await getDocs(testCollection);
    console.log("Firebase connection successful!");
    return true;
  } catch (err) {
    console.error("Firebase connection failed:", err);
    return false;
  }
};
