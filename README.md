# funfunfunsahur

A caption-contest web app: upload a photo, add context, let Gemini generate a
NYC/Columbia-themed meme caption, and vote on the community's captions. Built
with Next.js 16 and Supabase.

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
- **Gallery feed (homepage)** — a shared grid of posts with filters for all
  posts, your posts, unvoted posts, and posts without captions. Each post shows
  exactly one caption: the owner's selected caption, or the highest-rated
  caption when no selection has been made.
- **Anonymous demo** — signed-out visitors can open a local six-photo slideshow,
  generate prewritten captions, vote with reversible up/down controls, jump
  between photos with the segmented progress bar, and continue to the
  `/intrigued` sign-up prompt.
- **Post details** — signed-in users can click any post to open `/posts/[id]`.
  The details page preserves caption creation order and exposes all generated
  captions, voting, owner editing, caption generation, deletion, and the
  checkbox for choosing the caption shown on the homepage.
- **New posts** — add a photo either by uploading a file (stored in Supabase
  Storage) or by pasting an image URL. A slider switch selects the input mode.
  The file flow supports drag-and-drop, preview, changing/removing the selected
  photo, and inline validation. Non-image files, multiple files, and files over
  2 MB are rejected before submission.
- **AI captions** — Gemini first analyzes the photo and creator context, then
  generates a meme statement grounded in the photo, context, New York City,
  and Columbia University. The exact prompts are saved with each caption.
- **Voting** — up/down vote captions with optimistic UI; votes toggle/flip
  atomically server-side. The top-rated caption is highlighted in place. Voting
  is restricted to logged-in users at both the server-action and database
  (RLS) level.
- **Owner controls** — owners can edit context, generate captions, delete
  captions, choose the homepage caption, and delete posts. Deletes cascade to
  related votes.
- **Creator dashboard** — `/dashboard` shows your posts, caption count, vote
  count, and shortcuts to upload and edit your profile.
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
| AI        | Gemini via the OpenAI-compatible `openai` SDK |
| Hosting   | Vercel |

---

## Project structure

```
app/
  page.tsx               Shared feed with post filters
  layout.tsx             Root layout, fonts
  globals.css            Tailwind + theme tokens
  _actions/
    posts.ts            Server actions for posts, captions, context, and votes
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
  profile/ProfileForm.tsx Account welcome, edit name/avatar, sign out
  dashboard/page.tsx      Personal post and activity dashboard
  new/
    page.tsx             New-post page
    NewPostForm.tsx      Upload-file vs paste-URL form

lib/
  ai/captions.ts         Two-step Gemini caption pipeline
  upload-limits.ts       Shared upload size validation
  supabase/
    client.ts            Browser Supabase client
    server.ts            Server Supabase client (Server Components/Actions)
    middleware.ts        Session-cookie refresh helper

proxy.ts                 Next.js middleware → refreshes auth session cookies
next.config.ts           Storage host and 2.2 MB Server Action body limit
public/demo-photos/      Six local images used by the anonymous demo
supabase/migrations/     Versioned SQL schema (tables, RLS, functions, indexes)
```

---

## How it works

- **Auth & session.** Google OAuth via Supabase; `proxy.ts` middleware refreshes
  session cookies on matched requests. The homepage allows signed-out browsing;
  protected routes require login and signed-in homepage users complete onboarding.
- **Posting, captions & voting.** Server actions re-check ownership on top of
  RLS. Gemini analyzes the image/context, then generates one meme caption.
  Voting is atomic via `toggle_vote`, with optimistic UI. The homepage renders
  one featured caption per post; the details page is the management view for
  the complete caption list.
- **Images.** Files go to Supabase Storage; only public URLs are stored in
  Postgres. Upload validation is shared by the client and server at 2 MB, while
  the Server Action request limit is 2.2 MB to allow multipart overhead.

## Database

Each generation saves the exact analysis and caption prompts in `vision_prompt`
and `caption_prompt`. Schema lives in
[`supabase/migrations/`](./supabase/migrations) and is the source of truth.

**Tables:** `profiles` (1:1 with `auth.users`), `images`, `captions` (many per
image, storing the AI output *and* the prompts used to generate it), `votes`
(unique per user+caption). `images.selected_caption_id` stores the owner's
homepage choice. Foreign keys cascade on delete.

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
