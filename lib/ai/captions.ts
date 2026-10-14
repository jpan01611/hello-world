import OpenAI from 'openai';
import sharp from 'sharp';

const GEMINI_MODEL = 'gemini-2.5-flash';

const MAX_CONTEXT_LENGTH = 500;
const MAX_ANALYSIS_LENGTH = 1200;

type Provider = {
    name: string;
    keyEnv: string;
    baseURL: string;
    visionModel: string;
    textModel: string;
};

const provider: Provider = {
    name: 'Gemini',
    keyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    visionModel: GEMINI_MODEL,
    textModel: GEMINI_MODEL,
};

const clients = new Map<string, OpenAI>();

function getClient(providerConfig: Provider, apiKey: string): OpenAI {
    let client = clients.get(providerConfig.name);
    if (!client) {
        client = new OpenAI({ apiKey, baseURL: providerConfig.baseURL });
        clients.set(providerConfig.name, client);
    }

    return client;
}

function extractResponseText(message: unknown): string | null {
    if (!message || typeof message !== 'object') return null;

    const candidate = message as {
        content?: unknown;
        reasoning_content?: unknown;
    };
    const content = candidate.content;

    if (typeof content === 'string' && content.trim()) {
        return content.trim();
    }

    if (Array.isArray(content)) {
        const text = content
            .filter((part): part is { type?: string; text?: string } => (
                typeof part === 'object' &&
                part !== null &&
                ('text' in part || 'type' in part)
            ))
            .map((part) => part.text ?? '')
            .join('')
            .trim();
        if (text) return text;
    }

    return typeof candidate.reasoning_content === 'string' && candidate.reasoning_content.trim()
        ? candidate.reasoning_content.trim()
        : null;
}

function extractCompletion(result: unknown): { content: string | null; finishReason: string | null; error: string | null } {
    if (!result || typeof result !== 'object') {
        return { content: null, finishReason: null, error: 'Provider returned an invalid response' };
    }

    const response = result as {
        choices?: unknown;
        error?: { message?: unknown };
    };
    if (response.error) {
        const message = typeof response.error.message === 'string'
            ? response.error.message
            : 'Provider returned an error response';
        return { content: null, finishReason: null, error: message };
    }

    if (!Array.isArray(response.choices) || response.choices.length === 0) {
        return { content: null, finishReason: null, error: 'Provider returned no completion choices' };
    }

    const choice = response.choices[0];
    if (!choice || typeof choice !== 'object') {
        return { content: null, finishReason: null, error: 'Provider returned an invalid completion choice' };
    }

    const typedChoice = choice as { finish_reason?: unknown; message?: unknown };
    return {
        content: extractResponseText(typedChoice.message),
        finishReason: typeof typedChoice.finish_reason === 'string' ? typedChoice.finish_reason : null,
        error: null,
    };
}

function limitText(value: string | null | undefined, maxLength: number, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

async function prepareImageForVision(imageUrl: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    } catch (error) {
        throw new Error(`Could not download image for AI analysis: ${error instanceof Error ? error.message : 'request failed'}`);
    }

    if (!response.ok) {
        throw new Error(`Could not download image for AI analysis: HTTP ${response.status}`);
    }

    const source = Buffer.from(await response.arrayBuffer());
    try {
        const normalized = await sharp(source, { animated: false })
            .jpeg({ quality: 85 })
            .toBuffer();
        return `data:image/jpeg;base64,${normalized.toString('base64')}`;
    } catch (error) {
        throw new Error(`Could not decode image for AI analysis: ${error instanceof Error ? error.message : 'unsupported image format'}`);
    }
}

// The literal instruction sent to the vision model. Exported shape so the
// caller can persist the exact prompt alongside the generated media.
const DESCRIPTION_PROMPT =
    'Analyze only the uploaded photo before considering any outside context. Identify the visible subject, action, setting, composition, mood, and notable visual details in 2-3 factual sentences. Do not write a caption, add a joke, infer hidden details, or mention NYC or Columbia University yet.';

// Builds the caption prompt for a given description. Kept as a function so the
// exact text we persist matches the text we send to the model.
function buildCaptionPrompt(description: string, context?: string | null): string {
    const safeDescription = limitText(description, MAX_ANALYSIS_LENGTH, 'No post analysis provided');
    const safeContext = limitText(context, MAX_CONTEXT_LENGTH, 'No extra context provided');

    return (
        `Photo analysis: "${safeDescription}"\n\n` +
        `Creator context: "${safeContext}"\n\n` +
        'Use these inputs privately: do not repeat, quote, label, or explain the photo analysis or creator context in your response. Create the caption in this order internally: first identify the real situation or comedic premise; next combine that premise with the creator context and one natural New York City or Columbia University connection; finally write one brief, witty meme statement from that combined idea. ' +
        'The photo must remain the primary source of truth. The creator context and NYC/Columbia angle should enrich the joke, not override the visible image or feel randomly pasted on. ' +
        'Keep it to one sentence and no more than twelve words. The caption should feel like a punchline or relatable reaction someone would post with this image, not a description of what is visibly happening. Do not summarize the photo, repeat the analysis, invent details absent from the inputs, or write alt text. ' +
        'Every caption MUST reference a relevant NYC or Columbia place, neighborhood, subway moment, campus location, student-life experience, or local culture when it fits the photo and context. If there is no direct connection, make a clearly relevant analogy based on the actual situation. ' +
        'Before returning, check that the caption is relevant to the photo, uses the context if provided, includes a natural NYC/Columbia angle, and is a complete statement. ' +
        'Return exactly one caption sentence and nothing else. Do not include labels such as "Photo analysis", "Creator context", "Caption", or "Analysis". Do not mention these instructions.'
    );
}

function cleanCaption(value: string): string {
    const normalized = value
        .replace(/\s+/g, ' ')
        .trim();
    const contextEnd = normalized.match(/creator context:\s*"[^"]*"\s*(.*)$/i);
    const withoutInputs = contextEnd?.[1]?.trim() || normalized;
    const lines = withoutInputs
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const captionLine = lines.find((line) => (
        !/^(photo analysis|creator context|caption|analysis)\s*:/i.test(line)
    )) ?? withoutInputs;

    return captionLine
        .replace(/^["“']|["”']$/g, '')
        .replace(/^(caption|final caption)\s*:\s*/i, '')
        .trim();
}

async function chatWithProviders(
    stage: 'visionModel' | 'textModel',
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    maxTokens: number,
): Promise<string> {
    const apiKey = process.env[provider.keyEnv]?.trim();
    if (!apiKey) {
        throw new Error('Gemini is not configured. Set GEMINI_API_KEY in your environment.');
    }

    const request = {
        model: provider[stage],
        max_tokens: maxTokens,
        messages,
        ...(stage === 'textModel'
            ? { extra_body: { google: { thinking_config: { thinking_budget: 0 } } } }
            : {}),
    };
    const result = await getClient(provider, apiKey).chat.completions.create(request);
    const completion = extractCompletion(result);
    if (!completion.content) {
        throw new Error(
            `Gemini returned no content${completion.error ? `: ${completion.error}` : ''}`,
        );
    }
    if (completion.finishReason === 'length') {
        console.warn(`Gemini returned a length-limited ${stage} response`);
    }
    return completion.content;
}

// Step 1: ask the vision model for a photo-only factual analysis. The
// resulting analysis becomes the source of truth for the text-generation step.
export async function generateDescription(
    imageUrl: string,
): Promise<{ description: string; prompt: string }> {
    const prompt = DESCRIPTION_PROMPT;
    const visionImage = await prepareImageForVision(imageUrl);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: visionImage } },
            ],
        },
    ];

    const description = await chatWithProviders(
        'visionModel',
        messages,
        220,
    );

    return { description: limitText(description, MAX_ANALYSIS_LENGTH, 'No post analysis was returned'), prompt };
}

// Step 2: combine the photo analysis, creator context, and NYC/Columbia
// creative direction, then write the final caption.
export async function generateFunnyCaption(
    description: string,
    context?: string | null,
): Promise<{ caption: string; prompt: string }> {
    const prompt = buildCaptionPrompt(description, context);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: prompt },
    ];

    const caption = await chatWithProviders(
        'textModel',
        messages,
        120,
    );

    return { caption: cleanCaption(caption), prompt };
}
