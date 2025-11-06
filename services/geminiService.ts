import { GoogleGenAI, Modality, Part, GenerateContentResponse, Type } from "@google/genai";
import { EXPAND_PROMPT_DEFAULT } from "../constants";

const MODEL_ID = 'gemini-2.5-flash-image';
const VIETNAMESE_EXPAND_PROMPT = "Mở rộng khung hình ảnh ra ngoài, giữ nguyên phần nền hiện có. Việc mở rộng phải liền mạch, tiếp tục phong cách hình ảnh và nội dung của phần nền hiện tại để tạo thêm không gian xung quanh";
const VIETNAMESE_INPAINT_PROMPT = `Sử dụng hình ảnh thứ hai làm mặt nạ (mask). Vùng trắng trên mặt nạ chỉ ra khu vực cần chỉnh sửa trên ảnh gốc (ảnh đầu tiên). Trong khu vực được chỉ định bởi mặt nạ, hãy vẽ: "{USER_PROMPT}". Giữ nguyên phần còn lại của hình ảnh gốc không thay đổi.`;


const createAiClient = (apiKey: string) => {
    if (!apiKey) throw new Error("Missing Google AI API key");
    // FIX: Pass apiKey as a named parameter.
    return new GoogleGenAI({ apiKey });
};

const dataUrlToPart = (dataUrl: string): Part => {
    const [header, data] = dataUrl.split(",");
    if (!header || !data) throw new Error('Invalid dataURL format');
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/png";
    return { inlineData: { mimeType, data } };
};

const extractBase64FromResponse = (resp: GenerateContentResponse): string => {
    // FIX: Use the `.text` property to extract the response, which is a base64 string for image generation.
    // The previous implementation was traversing a complex object path that is not part of the public API.
    const part = resp.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!part?.inlineData?.data) {
        const blockReason = resp.candidates?.[0]?.finishReason;
        if (blockReason && blockReason !== 'STOP') {
            throw new Error(`Generation blocked: ${blockReason}.`);
        }
        const safetyFeedback = resp.candidates?.[0]?.safetyRatings;
        if (safetyFeedback) {
            console.error('Safety feedback:', safetyFeedback);
        }
        throw new Error("No image data found in the AI response.");
    }
    const inlineData = part.inlineData;
    return `data:${inlineData.mimeType || 'image/png'};base64,${inlineData.data}`;
};
/**
 * Generates artwork from a text prompt, optionally conditioned by reference images.
 * Also used for expanding images and inpainting with a mask.
 */
export const generateArtwork = async (
    prompt: string,
    aspectRatio: string,
    refUrls: string[] = [],
    count: number,
    apiKey: string,
    maskUrl?: string,
): Promise<string[]> => {
    const ai = createAiClient(apiKey);
    const results: string[] = [];

    // The model does not support candidateCount for image generation, so we loop.
    for (let i = 0; i < count; i++) {
        const parts: Part[] = [];

        // Inpainting logic
        if (maskUrl && refUrls.length > 0) {
            const sourceImageUrl = refUrls[0];
            parts.push(dataUrlToPart(sourceImageUrl));
            parts.push(dataUrlToPart(maskUrl));

            const inpaintPrompt = VIETNAMESE_INPAINT_PROMPT.replace('{USER_PROMPT}', prompt);
            parts.push({ text: inpaintPrompt });
        } else { // Existing logic for generation/expansion/editing
            if (refUrls.length > 0) {
                parts.push(...refUrls.map(dataUrlToPart));
            }

            let textPrompt = prompt;
            // Use the specific Vietnamese prompt for expansion requests
            if (prompt === EXPAND_PROMPT_DEFAULT) {
                textPrompt = VIETNAMESE_EXPAND_PROMPT;
            }

            const baseGuard = refUrls.length > 0
                ? "Use the provided image(s) as reference(s)."
                : "Generate a clean, high-resolution, print-ready artwork. No borders, no watermark, centered composition.";

            parts.push({ text: `${baseGuard} ${textPrompt}` });
        }

        const response = await ai.models.generateContent({
            model: MODEL_ID,
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
                // @ts-ignore
                imageConfig: {
                    aspectRatio
                }
            },
        });

        results.push(extractBase64FromResponse(response));
    }
    return results;
};


/**
 * Generates a mockup by applying an artwork to product samples based on a prompt.
 */
export const generateMockup = async (
    prompt: string,
    aspectRatio: string,
    sampleUrls: string[] = [],
    artworkUrl: string,
    apiKey: string,
): Promise<string> => {
    const ai = createAiClient(apiKey);
    const parts: Part[] = [];

    if (sampleUrls.length > 0) {
        parts.push(...sampleUrls.map(dataUrlToPart));
    }
    parts.push(dataUrlToPart(artworkUrl));

    const guard = sampleUrls.length
        ? "Use the earlier image(s) as product references. The LAST image is the artwork to apply onto the product. Keep the product's shape; do not repaint/reshape. Apply realistically with natural lighting/shadows/reflections."
        : "The provided image is artwork. Generate a product mockup as described and apply this artwork realistically with natural lighting/shadows/reflections.";

    const fullPrompt = `${guard} ${prompt}`;
    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE],
            // @ts-ignore
            imageConfig: {
                aspectRatio
            }
        },
    });

    return extractBase64FromResponse(response);
};
/**
 * Generates an Etsy title and tags based on a prompt and a mockup image.
 */
export const generateEtsyListing = async (
    prompt: string,
    imageUrl: string,
    apiKey: string
): Promise<{ title: string; tags: string[] }> => {
    const ai = createAiClient(apiKey);
    const imagePart = dataUrlToPart(imageUrl);
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: {
                        type: Type.STRING,
                        description: "[Personalization/Material] [Main Item Noun]: [Key Feature/Use] [Top 2–3 Descriptors]; help me write a title in a way that follows Etsy’s updated title guidance (clear nouns, objective descriptors, no subjective/gifting words, no repeats)."
                    },
                    tags: {
                        type: Type.ARRAY,
                        description: "[Personalization/Material] [Main Item Noun]: [Key Feature/Use] [Top 2–3 Descriptors]; help me write 13 SEO tags (each under 20 characters, separated by commas).",
                        items: {
                            type: Type.STRING
                        }
                    }
                }
            }
        }
    });

    try {
        const jsonString = response.text;
        const parsed = JSON.parse(jsonString);
        if (!parsed.title || !Array.isArray(parsed.tags)) {
            throw new Error("Invalid JSON structure in AI response.");
        }
        return parsed;
    } catch (e) {
        console.error("Failed to parse Etsy listing JSON:", response.text, e);
        throw new Error("AI response was not valid JSON.");
    }
};