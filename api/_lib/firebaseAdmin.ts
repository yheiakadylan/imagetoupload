
import admin from 'firebase-admin';

// This variable will store the initialized app
let app: admin.app.App;

if (!process.env.FIREBASE_ADMIN_SDK_JSON) {
    throw new Error("FIREBASE_ADMIN_SDK_JSON environment variable is not set.");
}

if (!admin.apps.length) {
    // Parse the JSON from the environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);

    app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    app = admin.app();
}

export const adminAuth = app.auth();
export const adminDb = app.firestore();
