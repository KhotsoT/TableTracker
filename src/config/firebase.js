import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const SCHOOL_ID = import.meta.env.VITE_SCHOOL_ID;
export const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME;

const firebaseConfig = {
  apiKey: "AIzaSyAViieUy8atQe6VALse4eOq9l0bdSvEpxs",
  authDomain: "schoolconnect-curtis.firebaseapp.com",
  projectId: "schoolconnect-curtis",
  storageBucket: "schoolconnect-curtis.firebasestorage.app",
  messagingSenderId: "736273003793",
  appId: "1:736273003793:web:eb185d979c441908f7c8b0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 