
// api/get-listings.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
let app: admin.app.App;
if (!process.env.FIREBASE_ADMIN_SDK_JSON) {
    throw new Error("FIREBASE_ADMIN_SDK_JSON environment variable is not set.");
}
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
    app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    app = admin.app();
}
export const adminAuth = app.auth();
export const adminDb = app.firestore();
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // 1. Get the token from the header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided.' });
        }
        const idToken = authHeader.split('Bearer ')[1];

        // 2. Verify the token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 3. Query Firestore
        const snapshot = await adminDb.collection('prepared_listings')
            .where('ownerUid', '==', uid)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        // 4. Return the list (only title and ID)
        const listings = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || 'Untitled Listing'
        }));

        res.status(200).json(listings);

    } catch (error: any) {
        console.error(error);
        res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
}
