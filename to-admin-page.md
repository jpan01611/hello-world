# Message for the Admin Page Project

The frontend app has been narrowed to **students at Columbia University**.
Please align the admin dashboard, labels, filters, and media-management copy
with that audience.

## Audience and product language

Use language centered on:

- Columbia student life
- Campus housing and dorm life
- Butler Library and midterms
- Core classes and office hours
- College Walk and campus events
- Broadway, 116th Street, and Morningside Heights
- The 1 train and student commutes
- Dining halls, student clubs, and weekend activities

Avoid generic “everyone” or broad “NYC meme” positioning where a Columbia
student-focused description is more accurate.

## LLM prompt changes

The frontend caption pipeline now:

1. Analyzes only the visible photo first.
2. Uses optional creator context.
3. Targets Columbia student experiences when the image or context supports it.
4. Prefers specific references such as Butler, Core classes, College Walk,
   Morningside Heights, Broadway, 116th Street, or the 1 train.
5. Does **not** force a Columbia reference when it would be unrelated or
   misleading.
6. Returns one brief meme-style sentence of no more than 12 words.

The photo remains the source of truth. Admin tools must not encourage editors
or operators to add campus references that are absent from the image and
unsupported by creator context.

## Admin UI updates

Update admin-facing copy so it clearly communicates:

- The application serves Columbia students.
- Creator context should be useful for identifying campus or student-life
  details.
- Generated captions can be reviewed for relevance, accuracy, and natural
  Columbia references.
- A Columbia reference should be removed or revised when it feels forced,
  inaccurate, or unrelated to the image.

Useful media-review fields include:

- Source image
- Creator context
- Photo description
- Generated caption
- Vision prompt
- Caption prompt
- Provider and model
- Creation timestamp
- Vote totals and net score

## Caption operation history

The frontend also records caption-generation activity through the migration
`supabase/migrations/0026_capture_caption_operations.sql`.

When a caption is inserted, the database creates:

- A completed `generation_requests` row
- A related `llm_responses` row

The operation history is supplementary audit data. The canonical user-facing
caption remains in `public.captions`.

When displaying history:

- Use `generation_requests.output` or `llm_responses.response` for caption text.
- Order records by `created_at`.
- Treat `llm_responses.request_id` as nullable.
- Treat `model` as nullable; it may currently be `null`.
- Identify backfilled records when `input` begins with `Historical caption:`.
- Do not assume operation history has a direct `caption.id` foreign key.
- Use the image URL in the request input only as a text-based correlation for
  newly captured records.

The recommended nested query is:

```ts
const { data, error } = await supabase
  .from('llm_responses')
  .select(`
    id,
    provider,
    model,
    response,
    created_at,
    request:generation_requests (
      id,
      status,
      provider,
      model,
      input,
      output,
      error,
      created_at
    )
  `)
  .order('created_at', { ascending: false });
```

If relationship selection is unavailable in the admin project's generated
types, fetch both tables separately and join responses to requests using
`llm_responses.request_id`.

## Security and behavior

- Keep prompts and operation history restricted to the authenticated admin
  area.
- Do not expose Gemini keys or Supabase service-role credentials to the client.
- Preserve the frontend's existing caption behavior; admin history should not
  replace reads from `public.captions`.
- If the admin app generates captions, apply its superadmin authorization
  before invoking the server-side LLM pipeline.
- Do not allow an administrator to turn off their own superadmin access.

## Dynamic LLM configuration contract

The admin app must treat the LLM catalog as live configuration, not
display-only metadata. This contract is introduced by:

- `supabase/migrations/0022_admin_operations.sql`
- `supabase/migrations/0024_seed_gemini_llm.sql`
- `supabase/migrations/0027_llm_provider_secret_reference.sql`

### Provider records

`public.llm_providers` contains:

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid` | Provider identifier |
| `name` | `text` | Display name, such as Google Gemini or OpenAI |
| `base_url` | `text` | OpenAI-compatible API base URL |
| `secret_env_var` | `text` | Server environment variable name containing the key |
| `active` | `boolean` | Whether the provider may be used |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps |

`secret_env_var` stores only a variable name, never an API key. Examples
include `GEMINI_API_KEY` and `OPENAI_API_KEY`.

### Model records

`public.llm_models` contains:

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid` | Model identifier |
| `provider_id` | `uuid` | Nullable reference to `llm_providers.id` |
| `name` | `text` | Admin display name |
| `model_key` | `text` | Exact provider model identifier |
| `active` | `boolean` | Whether the model may be used |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps |

The active generation configuration is the newest active model whose provider
is also active. The server uses:

- `llm_models.model_key` as the request model
- `llm_providers.base_url` as the API endpoint
- `llm_providers.secret_env_var` to look up the server-only Vercel secret

The frontend may display provider and model names, but generation must remain
server-side and must never expose an API key.

### Example configuration

```sql
insert into public.llm_providers
  (name, base_url, secret_env_var, active)
values
  ('OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY', true);
```

Create a model using the returned provider ID:

```sql
insert into public.llm_models
  (provider_id, name, model_key, active)
values
  ('<provider-id>', 'GPT-4o Mini', 'gpt-4o-mini', true);
```

The seeded Gemini configuration is:

| Field | Value |
| --- | --- |
| Provider | Google Gemini |
| Base URL | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Secret variable | `GEMINI_API_KEY` |
| Model key | `gemini-2.5-flash` |

### Frontend configuration query

Use this query when displaying the configured provider/model. Never select or
display a secret value:

```ts
const { data, error } = await supabase
  .from('llm_models')
  .select(`
    id,
    name,
    model_key,
    active,
    provider:llm_providers (
      id,
      name,
      base_url,
      active
    )
  `)
  .eq('active', true)
  .order('created_at', { ascending: false });
```

Filter the result in application code so the selected record has an active
model and an active related provider. If no active pair exists, show a clear
configuration warning instead of presenting generation as available.

### Permissions and deployment secrets

- Authenticated users may read configuration according to
  `0022_admin_operations.sql`.
- Superadmins may create, update, and delete provider/model records.
- API keys belong only in Vercel environment variables such as
  `GEMINI_API_KEY` or `OPENAI_API_KEY`.
- Never store API keys in Supabase, browser code, `NEXT_PUBLIC_*`, or request
  payloads.
- Apply `0027_llm_provider_secret_reference.sql` before creating providers that
  use `secret_env_var`.

### Required failure states

The frontend should present the server's explicit configuration error when:

- No active model exists.
- The model's provider is inactive or missing.
- The configured Vercel environment variable is absent.
- The provider returns no usable response.

These are administrator configuration issues, not user input or image-upload
failures.

## Full LLM step administration

Provider and model records control where generation runs, but they do not yet
control every part of the two-stage pipeline. To let the admin page manipulate
all LLM steps, add a versioned configuration layer for the generation stages.

The current frontend pipeline has two stages:

1. **Vision analysis**
   - Receives the normalized image and the vision prompt.
   - Produces a factual description.
   - Currently uses a 1,200-character output limit after the model response.
   - Uses a `max_tokens` request limit of 220.
2. **Caption generation**
   - Receives the factual description and creator context.
   - Produces the final meme caption.
   - Currently uses a `max_tokens` request limit of 120.
   - Uses Gemini thinking budget `0` when the selected provider is Gemini.
   - Cleans labels, quotes, and prompt echoes from the returned text.

### Recommended configuration table

Add a migration-owned table such as `public.llm_generation_steps`:

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid` | Step identifier |
| `step_key` | `text` | Stable key: `vision_analysis` or `caption_generation` |
| `display_name` | `text` | Admin-facing name |
| `active` | `boolean` | Whether the step may run |
| `system_prompt` or `prompt_template` | `text` | Prompt used for the step |
| `max_tokens` | `integer` | Provider request output limit |
| `max_output_chars` | `integer` | Application-side output limit |
| `temperature` | `numeric` | Optional provider setting |
| `thinking_budget` | `integer` nullable | Optional Gemini-specific setting |
| `model_id` | `uuid` nullable | Optional per-step model override |
| `created_at`, `updated_at` | `timestamptz` | Audit timestamps |

Use a unique constraint on `step_key`. If the selected model should always be
global, omit `model_id` and use the active model from `llm_models`; otherwise,
allow each step to select an active model explicitly.

Do not store API keys or provider secrets in this table.

### Admin capabilities

The admin page should allow superadmins to:

- Enable or disable each generation step.
- Edit the vision and caption prompt templates.
- Edit token and character limits within validated safe ranges.
- Edit optional temperature/thinking settings supported by the selected
  provider.
- Select a global active model or a model per step.
- Preview the effective configuration without exposing API keys.
- Test a configuration against a supplied image or existing media record.
- View the resulting description, caption, provider, model, and errors.
- See who changed a configuration and when.
- Restore a known-good default configuration.

Never allow an admin UI field to submit arbitrary environment variable values,
API keys, or client-side provider credentials.

### Prompt-template rules

The frontend must continue supplying runtime values safely:

- Vision stage variables: `{image}`
- Caption stage variables: `{description}`, `{context}`

The admin editor may change the surrounding instructions, but the server must
validate that required placeholders are present before saving:

- Vision prompt must include `{image}` or otherwise preserve the multimodal
  image message.
- Caption prompt must include `{description}` and `{context}`.

Treat prompt templates as untrusted configuration. Escape or delimit runtime
values so creator context cannot accidentally become instruction text. Keep the
photo as the source of truth and retain the Columbia-student audience guidance
unless an intentional product decision changes it.

### Frontend integration

Update `lib/ai/captions.ts` so each generation request:

1. Loads the active provider/model and active step configuration server-side.
2. Rejects missing or inactive step configuration with an explicit admin
   configuration error.
3. Validates limits before calling the provider.
4. Builds the vision and caption requests from the stored configuration.
5. Applies provider-specific options only when supported.
6. Persists the exact effective prompts, model, and provider in operation
   history.

The stored `vision_prompt` and `caption_prompt` should be the fully rendered
prompts sent to the model, not merely the editable template. This preserves
auditability when an administrator later edits the templates.

### Safe defaults and validation

Seed the table with the current known-good behavior:

- `vision_analysis`
  - `max_tokens`: `220`
  - `max_output_chars`: `1200`
- `caption_generation`
  - `max_tokens`: `120`
  - `max_output_chars`: `500` or the product's chosen caption limit
  - `thinking_budget`: `0` for Gemini

Reject values outside documented bounds. For example:

- Token limits must be positive and capped to prevent runaway spend.
- Character limits must be positive and capped.
- Temperature must be numeric and within the selected provider's supported
  range.
- A step cannot be activated without a valid model/provider pair.
- A caption step cannot be activated without required prompt variables.

### Disable and failure behavior

If either required step is inactive or missing, do not silently skip it or
return a success-shaped fallback. Return a clear configuration error such as:

```text
Caption generation is unavailable because the vision_analysis step is inactive.
Ask an administrator to activate a valid configuration.
```

The frontend should show this as an administrator configuration issue, not as a
bad image or user-input error.
