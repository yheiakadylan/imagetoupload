
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { serialize } from 'cookie';

// IMPORTANT: These should be set in your Vercel Environment Variables
const ETSY_CLIENT_ID = process.env.ETSY_KEYSTRING || 'txon8yoksj6q8ug9iqe3ktnr'; 
const ETSY_CLIENT_SECRET = process.env.ETSY_SHARED_SECRET || 'ouej4bmfla';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state } = req.query;

    // Use Vercel's forwarded headers for the most reliable URL construction
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const REDIRECT_URI = `${protocol}://${host}/api/auth/etsy-callback`;

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

    // Retrieve the code verifier from the cookie
    const pkce_verifier = req.cookies.etsy_pkce_verifier;

    if (!pkce_verifier) {
        return res.status(400).send("Error: Missing PKCE verifier. Your session may have expired or cookies are blocked.");
    }

    // Clear the one-time use verifier cookie immediately
    const clearCookie = serialize('etsy_pkce_verifier', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        expires: new Date(0), // Set expiration to the past
        path: '/api/auth',
        sameSite: 'lax',
    });
    res.setHeader('Set-Cookie', clearCookie);

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
            throw new Error(tokenData.error_description || tokenData.error || 'Failed to fetch access token from Etsy. The code may have been used already, or the verifier was incorrect.');
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
        // We use the same dynamic host/protocol to build the final app URL
        const appUrl = `${protocol}://${host}`;
        res.redirect(302, appUrl);

    } catch (error: any) {
        console.error("Etsy callback handler failed:", error);
        res.status(500).send(`An error occurred during Etsy authentication: ${error.message}`);
    }
}
