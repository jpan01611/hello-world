# Crackd 🥚 — the short version

A caption-contest app: upload a photo, AI writes a funny caption, everyone
votes. Built with **Next.js 16** + **Supabase**.

> This is the quick tour. For the full write-up see [`README.md`](../README.md)
> and the [`docs/`](.) folder.

## What it does

- Sign in with **Google**.
- Fill in your name + avatar the first time (**profiles**).
- **Post a photo** (upload a file or paste a URL).
- On your own posts, hit **Generate Caption** — AI writes something funny.
- **Upvote / downvote** captions. Best one floats to the top.
- Anyone can browse posts and their featured captions. Sign in to expand all
  captions and vote; only owners can edit, delete, or generate on their posts.

## How it's built (30 seconds)

- **Next.js 16 App Router** with Server Components + server actions.
- **Supabase** for auth, Postgres, and file storage.
- **AI** via the OpenAI SDK pointed at Groq (with OpenRouter + Hugging Face as
  backups), run entirely server-side.
- **Row Level Security** on every table so only logged-in users can post or
  vote, and only owners can edit/delete.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

You'll need a `.env.local` with your Supabase + AI keys and a configured
Supabase project — see [`docs/setup.md`](./setup.md) for the full checklist.

## Where things live

| Thing | File |
|-------|------|
| Homepage / gallery feed | `app/page.tsx` |
| One image + captions + voting | `app/_components/posts/ImageCard.tsx` |
| All the post mutations | `app/_actions/posts.ts` |
| AI caption pipeline | `lib/ai/captions.ts` |
| Database schema | `supabase/migrations/` |

Want the deep dive? → [`docs/architecture.md`](./architecture.md)
