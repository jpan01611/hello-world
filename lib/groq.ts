import OpenAI from 'openai';

// Groq's API is OpenAI-compatible, so the `openai` SDK works against it by
// just overriding the base URL. Free tier, server-side only (relies on
// GROQ_API_KEY, which is not exposed to the browser since it has no
// NEXT_PUBLIC_ prefix).
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

// OpenRouter is used as a fallback when Groq is unavailable (rate-limited,
// out of quota, etc.) — also OpenAI-compatible, also free-tier, server-side
// only (OPENROUTER_API_KEY).
const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Hugging Face's router is the final fallback — also OpenAI-compatible,
// also free-tier, server-side only (HUGGINGFACE_API_KEY).
const huggingFaceClient = new OpenAI({
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseURL: 'https://router.huggingface.co/v1',
});

const VISION_MODEL = 'qwen/qwen3.8-27b';
const TEXT_MODEL = 'openai/gpt-oss-20b';

const OPENROUTER_VISION_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const OPENROUTER_TEXT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const HUGGINGFACE_VISION_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
const HUGGINGFACE_TEXT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

type Provider = { client: OpenAI; model: string; name: string };

// Tries each provider in order, returning the first successful non-empty
// response. Only throws once every provider has failed.
async function chatWithFallback(
    providers: Provider[],
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    maxTokens: number,
): Promise<string> {
    let lastError: unknown;
    for (const provider of providers) {
        try {
            const result = await provider.client.chat.completions.create({
                model: provider.model,
                max_tokens: maxTokens,
                messages,
            });
            const content = result.choices[0]?.message?.content?.trim();
            if (content) {
                return content;
            }
            lastError = new Error(`${provider.name} returned an empty response`);
        } catch (err) {
            console.error(`${provider.name} call failed, trying next provider:`, err);
            lastError = err;
        }
    }
    throw lastError instanceof Error ? lastError : new Error('All providers failed');
}

// Step 1 of the pipeline: ask a vision model for a factual description of
// what's in the uploaded image. Tries Groq, then OpenRouter, then Hugging
// Face, in that order. The providers accept a remote image URL directly, no
// need to fetch/base64-encode it ourselves.
export async function generateDescription(imageUrl: string): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: 'Describe this image factually in 1-2 sentences, focusing on the main subject, action, and setting.',
                },
                { type: 'image_url', image_url: { url: imageUrl } },
            ],
        },
    ];

    return chatWithFallback(
        [
            { client: groqClient, model: VISION_MODEL, name: 'Groq' },
            { client: openRouterClient, model: OPENROUTER_VISION_MODEL, name: 'OpenRouter' },
            { client: huggingFaceClient, model: HUGGINGFACE_VISION_MODEL, name: 'Hugging Face' },
        ],
        messages,
        300,
    );
}

// Step 2 of the pipeline: turn the factual description into a funny caption,
// in the spirit of a caption-contest app. Tries Groq, then OpenRouter, then
// Hugging Face, in that order.
export async function generateFunnyCaption(description: string): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: 'user',
            content:
                `Here is a factual description of a photo: "${description}"\n\n` +
                'Write one short, witty, funny caption for this photo as if for a caption contest. ' +
                'Return only the caption text, no quotes, no extra commentary.',
        },
    ];

    return chatWithFallback(
        [
            { client: groqClient, model: TEXT_MODEL, name: 'Groq' },
            { client: openRouterClient, model: OPENROUTER_TEXT_MODEL, name: 'OpenRouter' },
            { client: huggingFaceClient, model: HUGGINGFACE_TEXT_MODEL, name: 'Hugging Face' },
        ],
        messages,
        150,
    );
}
