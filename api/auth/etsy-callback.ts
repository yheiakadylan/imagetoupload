
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// IMPORTANT: These should be set in your Vercel Environment Variables
const ETSY_CLIENT_ID = process.env.ETSY_KEYSTRING;
const ETSY_CLIENT_SECRET = process.env.ETSY_SHARED_SECRET;
const VERCEL_URL = process.env.VERCEL_URL;

const REDIRECT_URI = VERCEL_URL
    ? `https://${VERCEL_URL}/api/auth/etsy-callback`
    : 'http://localhost:3000/api/auth/etsy-callback';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).send("Error: No authorization code provided from Etsy.");
    }
    if (!state || typeof state !== 'string' || !state.includes(':')) {
        return res.status(400).send("Error: Invalid state parameter returned from Etsy.");
    }
    
    // Extract the userId from the state parameter
    const userId = state.split(':')[1];
    if (!userId) {
         return res.status(400).send("Error: User ID could not be parsed from the state parameter.");
    }

    // NOTE: For production, retrieve the `code_verifier` stored in the etsy-redirect step.
    const pkce_verifier = "Y_pkce_verifier_needs_to_be_retrieved_from_cookie"; // This is a placeholder.

    try {
        // Step 1: Exchange the authorization code for an access token
        const tokenResponse = await fetch('https://api.etsy.com/v3/public/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: ETSY_CLIENT_ID!,
                client_secret: ETSY_CLIENT_SECRET!,
                redirect_uri: REDIRECT_URI,
                code: code as string,
                code_verifier: pkce_verifier, 
            }),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error("Etsy token error response:", tokenData);
            throw new Error(tokenData.error_description || tokenData.error || 'Failed to fetch access token from Etsy');
        }

        const { access_token, refresh_token, expires_in } = tokenData;
        const expires_at = Date.now() + (expires_in * 1000);

        // Step 2: Securely store the tokens for the user in Firestore
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            etsy_access_token: access_token,
            etsy_refresh_token: refresh_token,
            etsy_token_expires_at: expires_at
        });

        // Step 3: Redirect the user back to the main application
        const appUrl = VERCEL_URL ? `https://${req.headers.host}` : 'http://localhost:3000';
        res.redirect(302, appUrl);

    } catch (error: any) {
        console.error("Etsy callback handler failed:", error);
        res.status(500).send(`An error occurred during Etsy authentication: ${error.message}`);
    }
}