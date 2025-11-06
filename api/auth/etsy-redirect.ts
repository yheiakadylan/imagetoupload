
import type { VercelRequest, VercelResponse } from '@vercel/node';

// IMPORTANT: These should be set in your Vercel Environment Variables
const ETSY_CLIENT_ID = process.env.ETSY_KEYSTRING; 
const VERCEL_URL = process.env.VERCEL_URL;

// Construct the Redirect URI based on the environment
const REDIRECT_URI = VERCEL_URL
    ? `https://${VERCEL_URL}/api/auth/etsy-callback`
    : 'http://localhost:3000/api/auth/etsy-callback';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { userId } = req.query;

    if (!ETSY_CLIENT_ID) {
        return res.status(500).send("ETSY_KEYSTRING environment variable is not set.");
    }
    if (!userId) {
        return res.status(400).send("User ID is required to initiate authentication.");
    }

    // A random string for CSRF protection
    const randomState = Math.random().toString(36).substring(7);
    // We encode the userId in the state to identify the user upon callback
    const state = `${randomState}:${userId}`;
    
    // The permissions our app requires
    const scope = 'listings_w listings_r listings_d shops_r'.split(' ').join('%20');
    
    // NOTE: For production, you must implement full PKCE challenge generation.
    // 1. Generate a random `code_verifier` string.
    // 2. Store it securely (e.g., in a short-lived, httpOnly cookie).
    // 3. Create a SHA-256 hash of the verifier, then base64url-encode it to get the `code_challenge`.
    const pkce_challenge = "Y_pkce_challenge_needs_to_be_generated_dynamically"; // This is a placeholder. A real implementation is required for security.

    // Construct the full authorization URL
    const authUrl = `https://www.etsy.com/oauth/connect?` +
        `response_type=code&` +
        `client_id=${ETSY_CLIENT_ID}&` +
        `redirect_uri=${REDIRECT_URI}&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `code_challenge=${pkce_challenge}&` +
        `code_challenge_method=S256`;

    // Redirect the user to Etsy's authorization page
    res.redirect(302, authUrl);
}