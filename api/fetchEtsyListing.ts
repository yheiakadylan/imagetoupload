import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getValidAccessToken } from './_lib/etsyAuth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const { id, userId } = req.query;
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Listing ID is required' });
    }
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const accessToken = await getValidAccessToken(userId);
        const apiKey = process.env.ETSY_KEYSTRING!;
        const headers = {
            'x-api-key': apiKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        // Step 1: Fetch main listing data
        const listingRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${id}`, { headers });
        if (!listingRes.ok) {
            const errorBody = await listingRes.text();
            throw new Error(`Failed to fetch listing data from Etsy: ${listingRes.status} ${errorBody}`);
        }
        const listingData = await listingRes.json();

        // Step 2: Fetch listing inventory
        const inventoryRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${id}/inventory`, { headers });
         if (!inventoryRes.ok) {
            const errorBody = await inventoryRes.text();
            throw new Error(`Failed to fetch inventory data from Etsy: ${inventoryRes.status} ${errorBody}`);
        }
        const inventoryData = await inventoryRes.json();

        res.status(200).json({ listingData, inventoryData });

    } catch (error: any) {
        console.error(`[fetchEtsyListing] Error for listing ${id} and user ${userId}:`, error);
        res.status(500).json({ error: error.message });
    }
}