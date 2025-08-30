// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, query, where, deleteDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// User Profile Functions
export const getUserProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (err) {
    console.error("Error getting user profile:", err);
    return null;
  }
};

export const createUserProfile = async (userId, email, clubId, role = 'coach') => {
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
// Create a shareable link for allocations
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

// Club Functions
export const createClub = async (clubName) => {
  try {
    // Generate a 6-character club ID
    const clubId = Math.random().toString(36).substr(2, 6).toUpperCase();
    
    await setDoc(doc(db, 'clubs', clubId), {
      name: clubName,
      subscription: 'active',
      createdAt: Date.now(),
      clubId: clubId // Store for reference
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