# Setup

Everything needed to run Crackd locally or deploy it.

## Environment variables

Create a `.env.local` in the project root:

```bash
# Supabase (client-visible — safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# AI provider keys (server-only; no NEXT_PUBLIC_ prefix)
# Add the variables named by llm_providers.secret_env_var.
GEMINI_API_KEY=<gemini-key>
```

The two Supabase values come from your project's **API settings**. AI keys are
server-only. Caption generation reads the newest active model whose provider is
also active from `llm_models` and `llm_providers`, then resolves the key using
the provider's `secret_env_var`. The image is analyzed first, then that
analysis and the creator context are used to generate one meme caption.

## Supabase setup

1. Create a Supabase project.
2. In **Storage**, create two **public** buckets: `images` and `avatars`.
   Do this *before* step 3 — `0004_storage_policies.sql` attaches policies to
   these buckets and needs them to exist.
3. Run every file in [`supabase/migrations/`](../supabase/migrations) **in
   numeric order** via the SQL editor. They're idempotent (`if not exists` /
   `drop policy if exists`), so re-running is safe.
4. In **Authentication → Providers**, enable **Google** and add your OAuth
   client ID/secret (create these in the Google Cloud console).
5. Set the auth redirect URL to `<origin>/auth/callback` for every origin you
   use — e.g. `http://localhost:3000/auth/callback` and your Vercel URL.

Run any migrations not yet applied, including the admin LLM configuration and
caption-operation migrations `0022`, `0024`, `0026`, and `0027` from the admin
project before using dynamic provider/model selection. If you already ran `0001` through `0009`,
apply `0010_public_featured_feed.sql` before using the public homepage. Apply
`0014_delete_account.sql` before using the Delete account control on `/profile`.
If Supabase reports that `delete_current_account` is missing after running it,
run `NOTIFY pgrst, 'reload schema';` in the SQL editor and retry.

### Migration reference

| File | Contents |
|------|----------|
| `0001_profiles.sql` | `profiles` table, `handle_new_user` trigger, RLS |
| `0002_profile_avatar.sql` | `avatar_url` column |
| `0003_images_captions_votes.sql` | `images`, `captions`, `votes` tables + RLS |
| `0004_storage_policies.sql` | Storage RLS for `images` / `avatars` buckets |
| `0005_toggle_vote_function.sql` | Atomic `toggle_vote` function |
| `0006_performance_indexes.sql` | Indexes for the feed join/sort |
| `0007_public_read_and_owner_edit.sql` | Owner-only edit/delete |
| `0008_caption_prompts.sql` | `vision_prompt` / `caption_prompt` columns |
| `0009_strict_rls.sql` | Restrict reads to authenticated users |
| `0010_public_featured_feed.sql` | Public featured-feed RPC; post-owner-only caption insertion |
| `0015_post_based_top_rated.sql` | Ranks the public Top rated filter by total post votes |
| `0016_top_rated_home_caption.sql` | Ranks posts by the caption shown on the home feed |
| `0011_post_context.sql` | Optional post context |
| `0012_authenticated_profile_names.sql` | Authenticated profile-name updates |
| `0013_selected_caption.sql` | Owner-selected homepage caption |
| `0014_delete_account.sql` | Authenticated self-service account deletion |

## Running locally

Image and GIF uploads are capped at 900 KB in the app. Oversized files show
an inline message before upload. This leaves multipart overhead below Next.js's
default 1 MB Server Action request limit; Supabase bucket restrictions still
apply. Use a smaller file or a hosted image URL for larger media.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Deployment

Deployed on Vercel, connected to the GitHub repository. Set the same
environment variables in the Vercel project settings, add your Vercel URL to
the Supabase auth redirect URLs, and disable Vercel "deployment protection" so
the app is viewable in Incognito mode.
