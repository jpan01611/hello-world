# funfunfunsahur

A caption-contest web app: bring a photo, add optional context, let Gemini
write a brief NYC/Columbia-themed meme caption, and let the community vote.
Built with Next.js 16, React, TypeScript, and Supabase.

Originally bootstrapped from `create-next-app` as a course project (see
[`REQUIREMENTS.md`](./REQUIREMENTS.md) for the HW1→HW4 assignment scope) and
extended into the current app.

Previously called Crackd, the app now uses a woodpunk/neon caption-lodge
identity: warm wood-grain backgrounds, cream photo cards, orange action
buttons, lime voting accents, and tactile navigation. Authentication and
post permissions are unchanged by the redesign.

> **Looking for something specific?**
> - [`docs/student-readme.md`](./docs/student-readme.md) — the quick, friendly tour
> - [`docs/architecture.md`](./docs/architecture.md) — how it works, with diagrams
> - [`docs/setup.md`](./docs/setup.md) — env vars, Supabase setup, running & deploying
> - [`docs/conventions.md`](./docs/conventions.md) — conventions, full RLS, notes
> - [`docs/design.md`](./docs/design.md) — Sam's persona, product rationale, PM feedback, submission checklist

---

## Features

- **Google OAuth sign-in** via Supabase Auth (PKCE flow through
  `/auth/callback`).
- **Profiles** — a profile row is auto-created on first login. Google names
  populate empty profile fields during OAuth, so complete accounts can go
  directly to the feed. Users can edit their name and avatar from `/profile`.
- **Gallery feed (homepage)** — a shared grid of posts with filters for all
  posts, Top rated, your posts, unvoted posts, and posts without captions.
  Every feed card shows exactly one home caption: the owner's selected caption,
  or the highest-rated fallback caption when no selection has been made.
- **Home-caption Top rated** — both signed-in and anonymous feeds rank posts by
  the net votes of the caption currently shown on the home feed, not by all
  captions combined.
- **Anonymous demo** — signed-out visitors can open a local six-photo slideshow,
  generate prewritten captions, vote with reversible up/down controls, jump
  between photos with the segmented progress bar, and continue to the
  `/intrigued` sign-up prompt.
- **Post details** — signed-in users can click any post to open `/posts/[id]`.
  This is the management view: captions remain in creation order, and owners
  can edit context, generate/delete captions, choose the home caption, and
  delete the post. Deleting a post returns to the feed.
- **New posts** — add a photo either by uploading a file (stored in Supabase
  Storage) or by pasting an image URL. A slider switch selects the input mode.
  The file flow supports drag-and-drop, preview, changing/removing the selected
  photo, and inline validation. Non-image files, multiple files, and files over
  2 MB are rejected before submission. URL posts require a direct image URL;
  invalid or unreadable links show a friendly inline error and do not leave a
  blank post behind.
- **AI captions** — The server loads active providers, models, and the
  `vision_analysis`/`caption_generation` settings from shared Supabase
  configuration managed by the admin app. It honors editable prompts, limits,
  temperature, thinking budget, and per-step model overrides, then falls back
  through eligible active providers. The exact rendered prompts are saved with
  each caption. Provider keys remain server-only environment variables.
- **Voting** — up/down controls update optimistically while the server toggles
  votes atomically. Voting is restricted to logged-in users at both the
  server-action and database (RLS) level.
- **Owner controls** — owners can edit context, generate captions, delete
  captions, choose the homepage caption, and delete posts. Deletes cascade to
  related votes.
- **Creator dashboard** — `/dashboard` shows your posts, caption count, vote
  count, and shortcuts to upload and edit your profile.
- **Protected account page** — `/profile` includes name editing, avatar upload,
  sign-out, and confirmed permanent account deletion. Deleting an account
  removes its profile, posts, captions, and votes through foreign-key cascades.

---

## Tech stack

| Area      | Choice |
|-----------|--------|
| Framework | Next.js 16.3.5 (App Router, React 19, Turbopack) |
| Language  | TypeScript |
| Styling   | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Backend   | Supabase (Postgres, Auth, Storage) |
| Auth glue | `@supabase/ssr`, `@supabase/supabase-js` |
| AI        | Active Supabase-configured providers via the OpenAI-compatible `openai` SDK |
| Hosting   | Vercel |

---

## Project structure

```
app/
  page.tsx               Shared feed with post filters
  layout.tsx             Root layout, fonts
  globals.css            Tailwind + theme tokens
  _actions/
    posts.ts            Server actions for posts, captions, context, votes
                        and safe upload cleanup
    account.ts          Protected server action for permanent account deletion
  _components/posts/
    ImageCard.tsx       Post card/details content, captions, and voting UI
    PostPhoto.tsx       Uncropped photo with a proportion-fitting inner frame
    NewPostTile.tsx     "+" grid tile linking to /new
  _components/demo/
    DemoExperience.tsx  Anonymous six-photo slideshow demo
  posts/[id]/page.tsx   Signed-in post details page
  login/page.tsx         Google sign-in
  auth/callback/route.ts OAuth code→session exchange
  complete-profile/      First/last name onboarding
  profile/page.tsx       Server-side authentication gate
  profile/ProfileForm.tsx Account editing, sign-out, and deletion
  dashboard/page.tsx      Personal post and activity dashboard
  new/
    page.tsx             New-post page
    NewPostForm.tsx      Upload-file vs paste-URL form

lib/
  ai/captions.ts         Photo analysis plus brief caption generation
  upload-limits.ts       Shared upload size validation
  supabase/
    client.ts            Browser Supabase client
    server.ts            Server Supabase client (Server Components/Actions)
    middleware.ts        Session-cookie refresh helper

proxy.ts                 Next.js middleware → refreshes auth session cookies
next.config.ts           Storage host and 2.2 MB Server Action body limit
public/demo-photos/      Six local images used by the anonymous demo
supabase/migrations/     Versioned SQL schema, RLS, RPCs, and indexes
```

---

## How it works

- **Auth & session.** Google OAuth via Supabase; `proxy.ts` middleware refreshes
  session cookies on matched requests. The homepage allows signed-out browsing;
  protected routes require login and signed-in homepage users complete onboarding.
- **Posting, captions & voting.** Server actions re-check ownership on top of
  RLS. A post is inserted only for an authenticated owner, then the configured
  vision and caption steps run server-side. If a provider or configuration
  fails, the post is cleaned up and the actionable error remains visible so
  the user can retry. Remote image failures receive the same cleanup treatment.
  Voting is atomic via `toggle_vote`, with optimistic UI. The homepage renders
  one home caption per post; details is the management view for the full
  caption list.
- **Images.** Files go to Supabase Storage; only public URLs are stored in
  Postgres. Upload validation is shared by the client and server at 2 MB, while
  the Server Action request limit is 2.2 MB to allow multipart overhead.

## Database

Each generation saves the exact analysis and caption prompts in `vision_prompt`
and `caption_prompt`. Schema lives in
[`supabase/migrations/`](./supabase/migrations) and is the source of truth.

**Tables:** `profiles` (1:1 with `auth.users`), `images`, `captions` (many per
image, storing the AI output and both generation prompts), and `votes` (unique
per user+caption). `images.selected_caption_id` stores the owner's home-caption
choice. Foreign keys cascade on delete. The public feed RPC returns one
featured caption and its score; migrations `0015` and `0016` keep public and
signed-in Top rated behavior aligned with the caption shown on the home feed.

Apply `0014_delete_account.sql` before using account deletion. The protected
`delete_current_account` function removes only the currently authenticated
user. If PostgREST does not see the function after migration, run:

```sql
NOTIFY pgrst, 'reload schema';
```

**RLS** is enabled on every table with the strictest rules that don't break the
app: authenticated-only raw-table reads, owner-restricted writes, and one vote
per user per caption. A narrow public RPC exposes posts with only their
featured caption and aggregate score, never hidden captions or individual votes.
Caption inserts additionally require ownership of the associated post.

The account-deletion RPC is intentionally callable only by authenticated users.
Run `0014_delete_account.sql` in the connected Supabase project before using
the Delete account button. If PostgREST still reports that the function is
missing after the migration runs, refresh its schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

The admin app manages the shared LLM catalog and generation-step configuration.
Apply migrations `0022`, `0024`, `0026`, `0027`, and `0028` from the admin
project before using dynamic generation. Full setup, migration order, and RLS details are in
[`docs/setup.md`](./docs/setup.md) and
[`docs/conventions.md`](./docs/conventions.md).

## Recent change log

- **October 29, 2026:** Narrowed the product audience to Columbia University
  students, updated page copy and submission guidance, and tuned Gemini prompts
  toward Columbia campus and student-life context without forcing references
  unrelated to the photo.
- **October 29, 2026:** Added explicit handling for animated image formats so
  Next.js does not attempt to optimize GIF, APNG, or animated WebP assets.
- **October 29, 2026:** Added stale Supabase refresh-token cleanup so revoked
  session cookies are cleared and users can return to the login flow.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

You'll need a `.env.local` containing Supabase variables and the server-side
keys for any providers enabled in the shared admin configuration. The complete
checklist — env vars, bucket creation, migrations, Google OAuth, scripts, and
Vercel deployment — is in [`docs/setup.md`](./docs/setup.md).
