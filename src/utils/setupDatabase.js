// src/utils/setupDatabase.js
import { db } from './firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

export const createClub = async (clubData) => {
  const clubRef = doc(collection(db, 'clubs'));
  await setDoc(clubRef, {
    name: clubData.name,
    subscription: clubData.subscription || 'active',
    createdAt: Date.now()
  });
  return clubRef.id;
};

export const createUserProfile = async (userId, email, clubId, role = 'coach') => {
  await setDoc(doc(db, 'users', userId), {
    email: email,
    clubId: clubId,
    role: role,
    createdAt: Date.now()
  });
};