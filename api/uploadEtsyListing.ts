import type { VercelRequest, VercelResponse } from '@vercel/node';

async function getEtsyAccessToken(): Promise<string> {
    // TODO: Triển khai logic OAuth 2.0 refresh token tại đây
    return 'DUMMY_ACCESS_TOKEN'; 
}

// Hàm helper để chuyển data URL sang Blob
function dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(','), mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { listing, inventory, imageDataUrls } = req.body;
        
        // const accessToken = await getEtsyAccessToken();
        // const apiKey = process.env.ETSY_API_KEY!;
        // const shopId = process.env.ETSY_SHOP_ID!;
        // const headers = {
        //     'x-api-key': apiKey,
        //     'Authorization': `Bearer ${accessToken}`
        // };

        // --- TODO: Quy trình 3 bước ---
        
        // 1. Upload Image (POST multipart/form-data)
        // const image_ids = [];
        // for (const dataUrl of imageDataUrls) {
        //    const imageBlob = dataURLtoBlob(dataUrl);
        //    const formData = new FormData();
        //    formData.append('image', imageBlob, 'listing-image.png');
        //    const imageRes = await fetch(`.../shops/${shopId}/listings/images`, { method: 'POST', headers, body: formData });
        //    const imageData = await imageRes.json();
        //    image_ids.push(imageData.listing_image_id);
        // }


        // 2. Create Listing (POST application/json)
        // const listingPayload = {
        //     ...listing,
        //     image_ids: image_ids,
        //     quantity: 999, // Tạm thời
        //     price: 25.00 // Tạm thời
        // };
        // const listingRes = await fetch(`.../application/listings`, { method: 'POST', headers, body: JSON.stringify(listingPayload) });
        // const listingData = await listingRes.json();
        // const new_listing_id = listingData.listing_id;

        // 3. Update Inventory (PUT application/json)
        // await fetch(`.../application/listings/${new_listing_id}/inventory`, { method: 'PUT', headers, body: JSON.stringify(inventory) });
        
        // --- Giả lập thành công ---
        await new Promise(res => setTimeout(res, 2000));
        const new_listing_id = Math.floor(Math.random() * 1000000);
        // --- Hết Giả lập ---
        
        res.status(200).json({ success: true, new_listing_id: new_listing_id });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}