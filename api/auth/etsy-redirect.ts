
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { serialize } from 'cookie';

// IMPORTANT: These should be set in your Vercel Environment Variables
const ETSY_CLIENT_ID = process.env.ETSY_KEYSTRING; 

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { userId } = req.query;

    if (!ETSY_CLIENT_ID) {
        return res.status(500).send("ETSY_KEYSTRING environment variable is not set.");
    }
    if (!userId) {
        return res.status(400).send("User ID is required to initiate authentication.");
    }
    
    // Dynamically construct the Redirect URI from request headers for robustness
    const host = req.headers.host;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const REDIRECT_URI = `${protocol}://${host}/api/auth/etsy-callback`;

    // A random string for CSRF protection
    const randomState = Math.random().toString(36).substring(7);
    // We encode the userId in the state to identify the user upon callback
    const state = `${randomState}:${userId}`;
    
    // --- PKCE Implementation ---
    // 1. Generate a random `code_verifier` string.
    const code_verifier = randomBytes(32).toString('base64url');
    
    // 2. Store it securely in an httpOnly cookie.
    const cookie = serialize('etsy_pkce_verifier', code_verifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 60 * 15, // 15 minutes
        path: '/api/auth', // Scope cookie to the auth paths
        sameSite: 'lax',
    });
    res.setHeader('Set-Cookie', cookie);

    // 3. Create a SHA-256 hash of the verifier, then base64url-encode it to get the `code_challenge`.
    const code_challenge = createHash('sha256')
        .update(code_verifier)
        .digest('base64url');
    
    // The permissions our app requires
    const scope = 'listings_w listings_r listings_d shops_r'.split(' ').join('%20');
    
    // Construct the full authorization URL
    const authUrl = `https://www.etsy.com/oauth/connect?` +
        `response_type=code&` +
        `client_id=${ETSY_CLIENT_ID}&` +
        `redirect_uri=${REDIRECT_URI}&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `code_challenge=${code_challenge}&` +
        `code_challenge_method=S256`;

    // Redirect the user to Etsy's authorization page
    res.redirect(302, authUrl);
}