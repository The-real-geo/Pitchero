import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";


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
    console.log("Allocation saved with ID:", docRef.id);
    return docRef.id;
  } catch (err) {
    console.error("Error saving allocation:", err);
    throw err;
  }
};

export const loadAllocations = async (allocatorType, date) => {
  try {
    const q = query(collection(db, allocatorType), where("date", "==", date));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Error loading allocations:", err);
    return [];
  }
};

export const clearAllAllocations = async (allocatorType, date) => {
  try {
    const q = query(collection(db, allocatorType), where("date", "==", date));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, allocatorType, docSnapshot.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`Cleared ${deletePromises.length} allocations for ${date}`);
  } catch (err) {
    console.error("Error clearing allocations:", err);
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
  } catch (err) {
    console.error("Error saving configuration:", err);
    throw err;
  }
};

export const loadAppConfiguration = async () => {
  try {
    const q = query(collection(db, 'appConfigurations'), where("type", "==", "settings"));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const configs = querySnapshot.docs.map(doc => doc.data());
      return configs.sort((a, b) => b.updated - a.updated)[0];
    }
    
    return null;
  } catch (err) {
    console.error("Error loading configuration:", err);
    return null;
  }
};