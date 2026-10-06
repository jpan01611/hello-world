# funfunfunsahur

A caption-contest web app: upload a photo, let AI generate a funny caption for
it, and vote on everyone's captions in a shared gallery feed. Built with
Next.js 16 (App Router) and Supabase.

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
- **Profiles** — a profile row is auto-created on first login (via an
  `auth.users` trigger). First-time users are prompted to complete their first
  and last name before entering the app. Users can edit their name and upload
  an avatar from the Profile page.
- **Gallery feed (homepage)** — a shared grid of every posted image and its
  featured caption, newest posts first. Anyone can browse; signed-in users
  can expand the remaining captions and vote.
- **New posts** — add a photo either by uploading a file (stored in Supabase
  Storage) or by pasting an image URL.
- **AI captions** — a two-step pipeline describes the image with a vision model
  and turns that description into a witty caption, with automatic fallback
  across three OpenAI-compatible providers (Groq → OpenRouter → Hugging Face).
  The exact prompts used for both steps are saved alongside each caption,
  but are not displayed or fetched by the feed UI.
  Only configured providers are initialized, on demand, and their clients
  are reused across calls.
- **Voting** — up/down vote captions with optimistic UI; votes toggle/flip
  atomically server-side. The top-rated caption is highlighted in place. Voting
  is restricted to logged-in users at both the server-action and database
  (RLS) level.
- **Owner controls** — only a post's creator can edit or delete it; deletes
  cascade to the post's captions and votes. Only the post owner can generate
  captions for that post.
- **Protected account page** — `/profile` requires sign-in and includes the
  account welcome, name editing, avatar upload, and sign-out.

---

## Tech stack

| Area      | Choice |
|-----------|--------|
| Framework | Next.js 16.3.5 (App Router, React 19, Turbopack) |
| Language  | TypeScript |
| Styling   | Tailwind CSS v4 (via `@tailwindcss/postcss`) |
| Backend   | Supabase (Postgres, Auth, Storage) |
| Auth glue | `@supabase/ssr`, `@supabase/supabase-js` |
| AI        | `openai` SDK pointed at Groq / OpenRouter / Hugging Face |
| Hosting   | Vercel |

---

## Project structure

```
app/
  page.tsx               Public featured feed; full captions after sign-in
  layout.tsx             Root layout, fonts
  globals.css            Tailwind + theme tokens
  actions.ts             Server actions (upload/update/delete/caption/vote)
  ImageCard.tsx          Client component: one image + captions + voting UI
  PostPhoto.tsx          Uncropped photo with a proportion-fitting inner frame
  NewPostTile.tsx        "+" grid tile linking to /new
  login/page.tsx         Google sign-in
  auth/callback/route.ts OAuth code→session exchange
  complete-profile/      First/last name onboarding
  profile/page.tsx       Server-side authentication gate
  profile/ProfileForm.tsx Account welcome, edit name/avatar, sign out
  new/
    page.tsx             New-post page
    NewPostForm.tsx      Upload-file vs paste-URL form

lib/
  groq.ts                AI caption pipeline + provider fallback
  supabase/
    client.ts            Browser Supabase client
    server.ts            Server Supabase client (Server Components/Actions)
    middleware.ts        Session-cookie refresh helper

proxy.ts                 Next.js middleware → refreshes auth session cookies
next.config.ts           Allowlists Supabase Storage host for next/image
supabase/migrations/     Versioned SQL schema (tables, RLS, functions, indexes)
```

---

## How it works

A quick map — see [`docs/architecture.md`](./docs/architecture.md) for the full
walkthrough with diagrams.

- **Auth & session.** Google OAuth via Supabase; `proxy.ts` middleware refreshes
  session cookies on matched requests. The homepage allows signed-out browsing;
  protected routes require login and signed-in homepage users complete onboarding.
- **Posting, captions & voting.** All mutations run through **server actions**
  (`app/actions.ts`) with ownership re-checked on top of RLS. Captions come from
  a two-step AI pipeline (`lib/groq.ts`) that persists the exact prompts used.
  Voting is atomic via the `toggle_vote` function, with optimistic UI.
- **Images.** Files go to Supabase Storage; only public URLs are stored in
  Postgres. `next.config.ts` allowlists the storage host for `next/image`.

## Database

### Behind the punchline

The vision model receives an image URL and this instruction:

> Describe this image factually in 1-2 sentences, focusing on the main subject, action, and setting.

The text model then receives this template, with `{description}` replaced by
the vision output:

```text
Here is a factual description of a photo: "{description}"

Write one short, witty, funny caption for this photo as if for a caption contest. Return only the caption text, no quotes, no extra commentary.
```

Each generation saves the exact instructions in `vision_prompt` and
`caption_prompt`, alongside its description and caption. Existing rows created
before prompt logging may have null prompt fields. This keeps prompt records
for the assignment without adding developer details to the browsing UI.

Schema lives in [`supabase/migrations/`](./supabase/migrations) (10 ordered,
idempotent SQL files) and is the source of truth.

**Tables:** `profiles` (1:1 with `auth.users`), `images`, `captions` (many per
image, storing the AI output *and* the prompts used to generate it), `votes`
(unique per user+caption). Foreign keys cascade on delete.

**RLS** is enabled on every table with the strictest rules that don't break the
app: authenticated-only raw-table reads, owner-restricted writes, and one vote
per user per caption. A narrow public RPC exposes posts with only their
featured caption and aggregate score, never hidden captions or individual votes.
Caption inserts additionally require ownership of the associated post.
Full breakdown and the migration table are in
[`docs/setup.md`](./docs/setup.md) and
[`docs/conventions.md`](./docs/conventions.md).

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

You'll need a `.env.local` (Supabase + AI keys) and a configured Supabase
project. The complete checklist — env vars, bucket creation, migrations, Google
OAuth, scripts, and Vercel deployment — is in [`docs/setup.md`](./docs/setup.md).
