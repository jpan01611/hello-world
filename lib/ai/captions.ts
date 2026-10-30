import OpenAI from 'openai';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';

const MAX_CONTEXT_LENGTH = 500;
const MAX_ANALYSIS_LENGTH = 1200;

type ProviderConfig = {
    name: string;
    keyEnv: string;
    baseURL: string;
    modelKey: string;
    modelId: string;
    apiKey: string;
};

type LlmModelRow = {
    id: string;
    provider_id: string | null;
    model_key: string;
    active: boolean;
};

type LlmProviderRow = {
    id: string;
    name: string;
    base_url: string | null;
    secret_env_var: string | null;
    active: boolean;
};

const clients = new Map<string, OpenAI>();

function getClient(providerConfig: ProviderConfig, apiKey: string): OpenAI {
    const clientKey = `${providerConfig.name}:${providerConfig.baseURL}`;
    let client = clients.get(clientKey);
    if (!client) {
        client = new OpenAI({ apiKey, baseURL: providerConfig.baseURL });
        clients.set(clientKey, client);
    }

    return client;
}

async function getProviderConfigs(modelId?: string | null): Promise<ProviderConfig[]> {
    const supabase = await createClient();
    let query = supabase
        .from('llm_models')
        .select('id, provider_id, model_key, active')
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (modelId) {
        query = query.eq('id', modelId);
    }
    const { data, error } = await query;

    if (error) {
        throw new Error(`LLM configuration could not be loaded: ${error.message}`);
    }

    const models = (data as LlmModelRow[] | null) ?? [];
    if (models.length === 0) throw new Error('No active LLM model is configured. Ask an administrator to activate a provider and model.');

    const providerIds = [...new Set(models.map((model) => model.provider_id).filter(Boolean))] as string[];
    const { data: providerRows, error: providerError } = providerIds.length
        ? await supabase.from('llm_providers').select('id, name, base_url, secret_env_var, active').in('id', providerIds)
        : { data: [] as LlmProviderRow[], error: null };
    if (providerError) throw new Error(`LLM provider configuration could not be loaded: ${providerError.message}`);
    const providers = new Map((providerRows ?? []).map((provider) => [provider.id, provider]));
    const configurations = models.flatMap((candidate) => {
        const provider = candidate.provider_id ? providers.get(candidate.provider_id) : null;
        if (!candidate.model_key.trim() || !provider?.active || !provider.name.trim()) return [];
        const baseURL = provider.base_url?.trim() || (
            provider.name.toLowerCase().includes('openai')
                ? 'https://api.openai.com/v1'
                : ''
        );
        if (!baseURL) return [];
        const keyEnv = provider.secret_env_var?.trim() || `${provider.name.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_API_KEY`;
        const apiKey = process.env[keyEnv]?.trim();
        return apiKey ? [{
            name: provider.name,
            keyEnv,
            baseURL,
            modelKey: candidate.model_key,
            modelId: candidate.id,
            apiKey,
        }] : [];
    });

    if (!configurations.length) throw new Error(modelId
        ? 'The selected generation-step model is unavailable or missing its server key.'
        : 'No active LLM model with a configured server key is available. Check the admin LLM settings and Vercel environment variables.');
    return configurations;
}

type GenerationStep = {
    prompt_template: string;
    max_tokens: number;
    max_output_chars: number;
    temperature: number | null;
    thinking_budget: number | null;
    model_id: string | null;
    active: boolean;
};

async function getGenerationStep(stepKey: 'vision_analysis' | 'caption_generation'): Promise<GenerationStep> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('llm_generation_steps')
        .select('prompt_template, max_tokens, max_output_chars, temperature, thinking_budget, model_id, active')
        .eq('step_key', stepKey)
        .maybeSingle();
    if (error) throw new Error(`LLM ${stepKey} configuration could not be loaded: ${error.message}`);
    if (!data?.active) throw new Error(`Caption generation is unavailable because the ${stepKey} step is inactive.`);
    if (!data.prompt_template || data.max_tokens < 1 || data.max_output_chars < 1) throw new Error(`The ${stepKey} configuration is invalid. Ask an administrator to correct it.`);
    if (stepKey === 'vision_analysis' && !data.prompt_template.includes('{image}')) throw new Error('The vision prompt is missing the {image} placeholder.');
    if (stepKey === 'caption_generation' && (!data.prompt_template.includes('{description}') || !data.prompt_template.includes('{context}'))) throw new Error('The caption prompt is missing required placeholders.');
    return data as GenerationStep;
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
    stepKey: 'vision_analysis' | 'caption_generation',
): Promise<string> {
    const step = await getGenerationStep(stepKey);
    const providers = await getProviderConfigs(step.model_id);
    const failures: string[] = [];
    for (const provider of providers) {
        try {
            const request = {
                model: provider.modelKey,
                max_tokens: step.max_tokens,
                ...(step.temperature !== null ? { temperature: step.temperature } : {}),
                messages,
                ...(step.thinking_budget !== null && provider.name.toLowerCase().includes('gemini')
                    ? { extra_body: { google: { thinking_config: { thinking_budget: step.thinking_budget } } } }
                    : {}),
            };
            const result = await getClient(provider, provider.apiKey).chat.completions.create(request);
            const completion = extractCompletion(result);
            if (!completion.content) throw new Error(`${provider.name} returned no usable content${completion.error ? `: ${completion.error}` : ''}`);
            if (completion.finishReason === 'length') console.warn(`${provider.name} returned a length-limited ${stage} response`);
            return completion.content;
        } catch (error) {
            failures.push(`${provider.name}: ${error instanceof Error ? error.message : 'request failed'}`);
        }
    }
    throw new Error(`All active LLM providers failed. ${failures.join(' | ')}`);
}

// Step 1: ask the vision model for a photo-only factual analysis. The
// resulting analysis becomes the source of truth for the text-generation step.
export async function generateDescription(
    imageUrl: string,
): Promise<{ description: string; prompt: string }> {
    const step = await getGenerationStep('vision_analysis');
    const prompt = step.prompt_template.replaceAll('{image}', 'the attached image');
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
        'vision_analysis',
    );

    return { description: limitText(description, step.max_output_chars, 'No post analysis was returned'), prompt };
}

// Step 2: combine the photo analysis, creator context, and NYC/Columbia
// creative direction, then write the final caption.
export async function generateFunnyCaption(
    description: string,
    context?: string | null,
): Promise<{ caption: string; prompt: string }> {
    const step = await getGenerationStep('caption_generation');
    const prompt = step.prompt_template
        .replaceAll('{description}', limitText(description, MAX_ANALYSIS_LENGTH, 'No post analysis provided'))
        .replaceAll('{context}', limitText(context, MAX_CONTEXT_LENGTH, 'No extra context provided'));
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: prompt },
    ];

    const caption = await chatWithProviders(
        'textModel',
        messages,
        'caption_generation',
    );

    return { caption: cleanCaption(caption), prompt };
}
