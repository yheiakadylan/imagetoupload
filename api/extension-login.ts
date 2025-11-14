// api/extension-login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
// FIX: Xóa dòng import và dán trực tiếp config vào đây
// Vercel build lỗi khi cố gắng import từ bên ngoài thư mục /api
export const firebaseConfig = {
  apiKey: "AIzaSyBcSyIap5cJ8U3AGyHXksUfvr5Cm0h2W8k",
  authDomain: "musicapp265204.firebaseapp.com",
  projectId: "musicapp265204",
  storageBucket: "musicapp265204.firebasestorage.app",
  messagingSenderId: "654255707414",
  appId: "1:654255707414:web:70f9a517aabecf06622c37",
  measurementId: "G-6TPD10VYRP"
};

// Initialize Firebase CLIENT app (only for this login function)
// NOTE: Vercel có thể cache các instance, nên dùng getApps() là an toàn
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const email = `${username.toLowerCase()}@internal.app`;
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Get the ID Token to send to the extension
        const idToken = await userCredential.user.getIdToken();
        const uid = userCredential.user.uid;

        // Send the token back to the extension for storage
        res.status(200).json({ 
            message: 'Login successful', 
            token: idToken, 
            uid: uid 
        });

    } catch (error: any) {
        console.error("Login API error:", error);
        res.status(401).json({ error: 'Invalid credentials' });
    }
}


