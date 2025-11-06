import type { VercelRequest, VercelResponse } from '@vercel/node';

// Hàm helper (bạn tự viết) để lấy access token
async function getEtsyAccessToken(): Promise<string> {
    // TODO: Triển khai logic OAuth 2.0 refresh token tại đây
    // 1. Gọi 'https://api.etsy.com/v3/public/oauth/token'
    // 2. Gửi grant_type: 'refresh_token', client_id, client_secret, refresh_token
    // 3. Lấy 'access_token' từ kết quả trả về
    
    // Giả lập access token
    return 'DUMMY_ACCESS_TOKEN'; 
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Listing ID is required' });
    }

    try {
        // const accessToken = await getEtsyAccessToken();
        // const apiKey = process.env.ETSY_API_KEY!;
        // const shopId = process.env.ETSY_SHOP_ID!;
        // const headers = {
        //     'x-api-key': apiKey,
        //     'Authorization': `Bearer ${accessToken}`
        // };

        // TODO: 1. Gọi getListing
        // const listingRes = await fetch(`.../shops/${shopId}/listings/${id}`, { headers });
        // const listingData = await listingRes.json();

        // TODO: 2. Gọi getListingInventory
        // const inventoryRes = await fetch(`.../shops/${shopId}/listings/${id}/inventory`, { headers });
        // const inventoryData = await inventoryRes.json();
        
        // --- DỮ LIỆU GIẢ ĐỊNH (PHẢI THAY BẰNG GỌI BACKEND THẬT) ---
        await new Promise(res => setTimeout(res, 1000)); // Giả lập chờ
        const listingData = {
            title: "Fetched T-Shirt",
            description: "This is a fetched description.\n100% Cotton.",
            taxonomy_id: 123456,
            shipping_profile_id: 987654321,
            return_policy_id: 123456789,
        };
        const inventoryData = {
            "products": [{"sku": "SKU-S"}, {"sku": "SKU-M"}],
            "pricing_on_property": 503
        };
        // --- Hết Dữ liệu giả định ---

        res.status(200).json({ listingData, inventoryData });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
