import OpenAI from 'openai';

const VISION_MODEL = 'qwen/qwen3.8-27b';
const TEXT_MODEL = 'openai/gpt-oss-20b';

const OPENROUTER_VISION_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const OPENROUTER_TEXT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const HUGGINGFACE_VISION_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
const HUGGINGFACE_TEXT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

type Provider = {
    name: string;
    keyEnv: string;
    baseURL: string;
    visionModel: string;
    textModel: string;
};

const providers: Provider[] = [
    {
        name: 'Groq', keyEnv: 'GROQ_API_KEY',
        baseURL: 'https://api.groq.com/openai/v1',
        visionModel: VISION_MODEL, textModel: TEXT_MODEL,
    },
    {
        name: 'OpenRouter', keyEnv: 'OPENROUTER_API_KEY',
        baseURL: 'https://openrouter.ai/api/v1',
        visionModel: OPENROUTER_VISION_MODEL, textModel: OPENROUTER_TEXT_MODEL,
    },
    {
        name: 'Hugging Face', keyEnv: 'HUGGINGFACE_API_KEY',
        baseURL: 'https://router.huggingface.co/v1',
        visionModel: HUGGINGFACE_VISION_MODEL, textModel: HUGGINGFACE_TEXT_MODEL,
    },
];

const clients = new Map<string, OpenAI>();

function getClient(provider: Provider, apiKey: string): OpenAI {
    let client = clients.get(provider.name);
    if (!client) {
        client = new OpenAI({ apiKey, baseURL: provider.baseURL });
        clients.set(provider.name, client);
    }
    return client;
}

// The literal instruction sent to the vision model. Exported shape so the
// caller can persist the exact prompt alongside the generated media.
const DESCRIPTION_PROMPT =
    'Describe this image factually in 1-2 sentences, focusing on the main subject, action, and setting.';

// Builds the caption prompt for a given description. Kept as a function so the
// exact text we persist matches the text we send to the model.
function buildCaptionPrompt(description: string): string {
    return (
        `Here is a factual description of a photo: "${description}"\n\n` +
        'Write one short, witty, funny caption for this photo as if for a caption contest. ' +
        'Return only the caption text, no quotes, no extra commentary.'
    );
}

// Tries each provider in order, returning the first successful non-empty
// response. Only throws once every provider has failed.
async function chatWithFallback(
    stage: 'visionModel' | 'textModel',
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    maxTokens: number,
): Promise<string> {
    let lastError: unknown;
    let configuredProviders = 0;
    for (const provider of providers) {
        const apiKey = process.env[provider.keyEnv]?.trim();
        if (!apiKey) continue;
        configuredProviders++;
        try {
            const result = await getClient(provider, apiKey).chat.completions.create({
                model: provider[stage],
                max_tokens: maxTokens,
                messages,
            });
            const content = result.choices[0]?.message?.content?.trim();
            if (content) {
                return content;
            }
            throw new Error(`${provider.name} returned an empty response`);
        } catch (err) {
            console.error(`${provider.name} call failed, trying next provider:`, err);
            lastError = err;
        }
    }
    if (configuredProviders === 0) {
        const error = new Error('No AI provider is configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, or HUGGINGFACE_API_KEY.');
        console.error(error.message);
        throw error;
    }
    throw lastError instanceof Error ? lastError : new Error('All providers failed');
}

// Step 1 of the pipeline: ask a vision model for a factual description of
// what's in the uploaded image. Tries Groq, then OpenRouter, then Hugging
// Face, in that order. The providers accept a remote image URL directly, no
// need to fetch/base64-encode it ourselves. Returns both the description and
// the exact prompt used, so the caller can persist the prompt.
export async function generateDescription(
    imageUrl: string,
): Promise<{ description: string; prompt: string }> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: 'user',
            content: [
                { type: 'text', text: DESCRIPTION_PROMPT },
                { type: 'image_url', image_url: { url: imageUrl } },
            ],
        },
    ];

    const description = await chatWithFallback(
        'visionModel',
        messages,
        300,
    );

    return { description, prompt: DESCRIPTION_PROMPT };
}

// Step 2 of the pipeline: turn the factual description into a funny caption,
// in the spirit of a caption-contest app. Tries Groq, then OpenRouter, then
// Hugging Face, in that order. Returns both the caption and the exact prompt
// used, so the caller can persist the prompt.
export async function generateFunnyCaption(
    description: string,
): Promise<{ caption: string; prompt: string }> {
    const prompt = buildCaptionPrompt(description);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: prompt },
    ];

    const caption = await chatWithFallback(
        'textModel',
        messages,
        150,
    );

    return { caption, prompt };
}
