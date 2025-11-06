import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getValidAccessToken } from './_lib/etsyAuth';

// Helper to convert data URL to Blob for multipart/form-data upload
function dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || arr.length < 2) {
        throw new Error('Invalid data URL format');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type: mime});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { userId, listing, inventory, imageDataUrls } = req.body;
        
        if (!userId || !listing || !inventory || !Array.isArray(imageDataUrls)) {
            return res.status(400).json({ error: "Missing required fields in request body." });
        }
        
        const accessToken = await getValidAccessToken(userId);
        const apiKey = process.env.ETSY_KEYSTRING!;
        const shopId = process.env.ETSY_SHOP_ID!; // You must set this in your environment variables
        
        if (!shopId) {
            throw new Error("ETSY_SHOP_ID environment variable is not configured.");
        }

        const authHeaders = {
            'x-api-key': apiKey,
            'Authorization': `Bearer ${accessToken}`
        };

        // --- Step 1: Upload Images ---
        const image_ids: number[] = [];
        for (const dataUrl of imageDataUrls) {
           const imageBlob = dataURLtoBlob(dataUrl);
           const formData = new FormData();
           formData.append('image', imageBlob, 'listing-image.png');
           
           const imageRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/images`, { 
               method: 'POST', 
               headers: { ...authHeaders }, // Note: Content-Type is set automatically by fetch for FormData
               body: formData 
            });

           if (!imageRes.ok) {
               const errorBody = await imageRes.text();
               throw new Error(`Image upload failed: ${imageRes.status} ${errorBody}`);
           }
           const imageData = await imageRes.json();
           image_ids.push(imageData.listing_image_id);
        }

        // --- Step 2: Create Listing ---
        const listingPayload = {
            ...listing,
            listing_image_ids: image_ids,
            quantity: 999, // Required for physical items
            price: inventory.products[0]?.offerings[0]?.price || 25.00 // Must provide a base price
        };
        
        const listingRes = await fetch(`https://openapi.etsy.com/v3/application/shops/${shopId}/listings`, { 
            method: 'POST', 
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(listingPayload) 
        });

        if (!listingRes.ok) {
            const errorBody = await listingRes.json();
            console.error("Etsy Listing Creation Error:", errorBody);
            throw new Error(errorBody.error || 'Failed to create listing.');
        }
        const listingData = await listingRes.json();
        const new_listing_id = listingData.listing_id;

        // --- Step 3: Update Inventory ---
        const inventoryUpdateRes = await fetch(`https://openapi.etsy.com/v3/application/listings/${new_listing_id}/inventory`, { 
            method: 'PUT', 
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(inventory) 
        });

        if (!inventoryUpdateRes.ok) {
             const errorBody = await inventoryUpdateRes.text();
             // This is not a fatal error, the draft was created. We can warn the user.
             console.warn(`Listing ${new_listing_id} created, but inventory update failed: ${errorBody}`);
        }
        
        res.status(200).json({ success: true, new_listing_id: new_listing_id });

    } catch (error: any) {
        console.error("[uploadEtsyListing] Error:", error);
        res.status(500).json({ error: error.message });
    }
}
