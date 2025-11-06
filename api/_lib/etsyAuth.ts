import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const ETSY_CLIENT_ID = process.env.ETSY_KEYSTRING;
const ETSY_CLIENT_SECRET = process.env.ETSY_SHARED_SECRET;

/**
 * Retrieves a valid Etsy access token for a given user.
 * It checks if the current token is expired and, if so, uses the refresh token
 * to obtain a new one, updating Firestore with the new credentials.
 * @param userId The Firestore document ID of the user.
 * @returns A promise that resolves to a valid access token.
 * @throws An error if the user has not linked their Etsy account or if token refresh fails.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
    if (!ETSY_CLIENT_ID || !ETSY_CLIENT_SECRET) {
        throw new Error("Etsy client ID or secret is not configured in environment variables.");
    }

    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();

    if (!userData || !userData.etsy_refresh_token) {
        throw new Error('User has not linked their Etsy account or is missing a refresh token.');
    }

    // Check if the token is still valid (with a 5-minute buffer for safety)
    const expiresAt = userData.etsy_token_expires_at || 0;
    const buffer = 5 * 60 * 1000; // 5 minutes
    if (Date.now() < expiresAt - buffer) {
        return userData.etsy_access_token;
    }

    // Token is expired or close to expiring, so refresh it.
    console.log(`Refreshing Etsy token for user ${userId}...`);
    const tokenResponse = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: ETSY_CLIENT_ID,
            client_secret: ETSY_CLIENT_SECRET,
            refresh_token: userData.etsy_refresh_token,
        }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        console.error("Failed to refresh Etsy token. Response:", tokenData);
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to refresh token from Etsy');
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Update the new tokens and expiration time in Firestore
    await updateDoc(userDocRef, {
        etsy_access_token: access_token,
        etsy_refresh_token: refresh_token, // Etsy may issue a new refresh token
        etsy_token_expires_at: Date.now() + (expires_in * 1000),
    });

    console.log(`Successfully refreshed Etsy token for user ${userId}.`);
    return access_token;
}