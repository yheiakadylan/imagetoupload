
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
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided.' });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // --- THAY ĐỔI LỚN ---
        // Xóa bộ lọc .where('status', '==', 'pending')
        // Chúng ta sẽ lấy tất cả listing của user và sắp xếp
        const snapshot = await adminDb.collection('prepared_listings')
            .where('ownerUid', '==', uid)
            // .where('status', '==', 'pending') // <-- XÓA DÒNG NÀY
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }

        // Thêm trường 'status' vào data trả về
        const listings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || 'Untitled Listing',
                status: data.status || 'pending' // <-- THÊM DÒNG NÀY
            };
        });

        res.status(200).json(listings);

    } catch (error: any) {
        console.error(error);
        // Lỗi này có thể xảy ra nếu bạn chưa tạo Index
        if (error.code === 9) {
             res.status(500).json({ error: 'Lỗi FAILED_PRECONDITION: Query yêu cầu một index. Vui lòng kiểm tra log của Vercel để tạo index.' });
        } else {
            res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        }
    }
}
