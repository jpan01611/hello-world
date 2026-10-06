# Setup

Everything needed to run Crackd locally or deploy it.

## Environment variables

Create a `.env.local` in the project root:

```bash
# Supabase (client-visible — safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# AI providers (server-only; no NEXT_PUBLIC_ prefix)
GROQ_API_KEY=<groq-key>
OPENROUTER_API_KEY=<openrouter-key>     # fallback
HUGGINGFACE_API_KEY=<huggingface-key>   # fallback
```

The two Supabase values come from your project's **API settings**. The AI
fallback keys are optional but recommended — if one provider is rate-limited or
down, the next is tried.

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

Run any migrations not yet applied. If you already ran `0001` through `0009`,
apply `0010_public_featured_feed.sql` before using the public homepage.

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

## Running locally

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
