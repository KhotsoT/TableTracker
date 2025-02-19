import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Replace with your Firebase config
  apiKey: "AIzaSyC4nFhQleHwNcKCFOp3pxwnh7yF_48mtsg",
  authDomain: "tabletracker-curtis.firebaseapp.com",
  projectId: "tabletracker-curtis",
  storageBucket: "tabletracker-curtis.firebasestorage.app",
  messagingSenderId: "690668588291",
  appId: "1:690668588291:web:806ab3f885e29313766d36"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 