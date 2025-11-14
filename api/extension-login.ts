
// api/extension-login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from './services/firebase'; // Import config from the root services

// Initialize Firebase CLIENT app (only for this login function)
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
        res.status(401).json({ error: 'Invalid credentials' });
    }
}
