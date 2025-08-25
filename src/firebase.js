import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
const analytics = getAnalytics(app);