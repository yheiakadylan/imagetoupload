

// api/get-listing-details.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
// FIX: Import Buffer to resolve 'Cannot find name' error in Node.js environment.
import { Buffer } from 'buffer';
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
// Helper function to fetch an image from a URL and convert it to base64
async function fetchImageAsBase64(url: string) {
    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mime = response.headers.get('content-type') || 'image/png';
        return `data:${mime};base64,${base64}`;
    } catch (error) {
        console.error(`Failed to fetch image ${url}:`, error);
        throw new Error(`Failed to fetch image: ${url}`);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // 1. Verify token (as above)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided.' });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Get listing ID from query
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Listing ID is required.' });
        }
        
        // 3. Get document
        const listingRef = adminDb.collection('prepared_listings').doc(id);
        const docSnap = await listingRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ error: 'Listing not found.' });
        }

        const listingData = docSnap.data()!;

        // 4. Check ownership
        if (listingData.ownerUid !== uid) {
            return res.status(403).json({ error: 'Forbidden: You do not own this listing.' });
        }

        // 5. Fetch images and convert to Base64
        const imageBase64s = await Promise.all(
            (listingData.mockupUrls || []).map((url: string) => fetchImageAsBase64(url))
        );
        
        // 6. Update status to "applied"
        await listingRef.update({ status: "applied" });

        // 7. Return all data to the extension
        res.status(200).json({
            title: listingData.title,
            tags: listingData.tags,
            description: listingData.description,
            imageBase64s: imageBase64s
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}