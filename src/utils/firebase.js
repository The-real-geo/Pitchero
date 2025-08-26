// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";

// 🔥 REPLACE WITH YOUR FIREBASE CONFIG
// Get this from Firebase Console → Project Settings → General → Your apps
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
export const db = getFirestore(app);

// Firestore helper functions
export const saveAllocation = async (allocatorType, allocation, date) => {
  try {
    const docRef = await addDoc(collection(db, allocatorType), {
      ...allocation,
      date: date,
      created: Date.now()
    });
    console.log("✅ Allocation saved with ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("❌ Error saving allocation:", err);
    throw err;
  }
};

export const loadAllocations = async (allocatorType, date) => {
  try {
    console.log(`📥 Loading ${allocatorType} for date: ${date}`);
    const q = query(collection(db, allocatorType), where("date", "==", date));
    const querySnapshot = await getDocs(q);
    const allocations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Loaded ${allocations.length} allocations`);
    return allocations;
  } catch (err) {
    console.error("❌ Error loading allocations:", err);
    return [];
  }
};

export const clearAllAllocations = async (allocatorType, date) => {
  try {
    console.log(`🗑️ Clearing all ${allocatorType} for date: ${date}`);
    const q = query(collection(db, allocatorType), where("date", "==", date));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, allocatorType, docSnapshot.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`✅ Cleared ${deletePromises.length} allocations for ${date}`);
  } catch (err) {
    console.error("❌ Error clearing allocations:", err);
    throw err;
  }
};

export const saveAppConfiguration = async (config) => {
  try {
    await addDoc(collection(db, 'appConfigurations'), {
      ...config,
      type: 'settings',
      updated: Date.now()
    });
    console.log("✅ App configuration saved");
  } catch (err) {
    console.error("❌ Error saving configuration:", err);
    throw err;
  }
};

export const loadAppConfiguration = async () => {
  try {
    const q = query(collection(db, 'appConfigurations'), where("type", "==", "settings"));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const configs = querySnapshot.docs.map(doc => doc.data());
      const latestConfig = configs.sort((a, b) => b.updated - a.updated)[0];
      console.log("✅ App configuration loaded");
      return latestConfig;
    }
    
    console.log("ℹ️ No saved configuration found");
    return null;
  } catch (err) {
    console.error("❌ Error loading configuration:", err);
    return null;
  }
};

// Test Firebase connection
export const testFirebaseConnection = async () => {
  try {
    console.log("🔥 Testing Firebase connection...");
    
    // Try to read from a collection (this will create it if it doesn't exist)
    const testCollection = collection(db, 'connectionTest');
    await getDocs(testCollection);
    
    console.log("✅ Firebase connection successful!");
    return true;
  } catch (err) {
    console.error("❌ Firebase connection failed:", err);
    return false;
  }
};