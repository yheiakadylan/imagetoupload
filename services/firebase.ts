// FIX: Use named imports for Firebase v9+ modular functions instead of a namespace import.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBcSyIap5cJ8U3AGyHXksUfvr5Cm0h2W8k",
  authDomain: "musicapp265204.firebaseapp.com",
  projectId: "musicapp265204",
  storageBucket: "musicapp265204.firebasestorage.app",
  messagingSenderId: "654255707414",
  appId: "1:654255707414:web:70f9a517aabecf06622c37",
  measurementId: "G-6TPD10VYRP"
};

// Initialize Firebase
// FIX: Call Firebase app functions directly as named imports, not as methods on a namespace.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
