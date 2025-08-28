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
export const saveAllocation = async (allocatorType, allocation, date) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Get user's clubId
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile?.clubId) throw new Error('User not assigned to club');
    
    const docRef = await addDoc(collection(db, allocatorType), {
      ...allocation,
      date: date,
      clubId: userProfile.clubId,
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

export const loadAllocations = async (allocatorType, date) => {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    // Get user's clubId
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile?.clubId) return [];
    
    console.log(`Loading ${allocatorType} for date: ${date}, club: ${userProfile.clubId}`);
    
    // Filter by both date AND clubId
    const q = query(
      collection(db, allocatorType), 
      where("date", "==", date),
      where("clubId", "==", userProfile.clubId)
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

export const clearAllAllocations = async (allocatorType, date) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  try {
    // Get user's clubId
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile?.clubId) throw new Error('User not assigned to club');
    
    console.log(`Clearing all ${allocatorType} for date: ${date}, club: ${userProfile.clubId}`);
    
    // Filter by both date AND clubId for safety
    const q = query(
      collection(db, allocatorType), 
      where("date", "==", date),
      where("clubId", "==", userProfile.clubId)
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