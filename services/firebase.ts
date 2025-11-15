// FIX: Use named imports for Firebase v9+ modular functions instead of a namespace import.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCx9vtXMdCButQVMEg1g_RJ_dSxcW6UqUg",
  authDomain: "ai-genart.firebaseapp.com",
  projectId: "ai-genart",
  storageBucket: "ai-genart.firebasestorage.app",
  messagingSenderId: "133544409645",
  appId: "1:133544409645:web:6955ac0d4aeb6864ec16a4"
};

// Initialize Firebase
// FIX: Call Firebase app functions directly as named imports, not as methods on a namespace.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
