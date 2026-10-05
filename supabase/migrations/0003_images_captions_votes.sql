-- Documents the images / captions / votes schema that was already applied
-- via the Supabase SQL editor (mirrors 0001_profiles.sql's approach: kept
-- here so the schema is versioned and reproducible for a fresh project).
-- This is the "Crackd.ai" caption-contest pipeline: users upload an image,
-- Gemini generates a caption for it, and other users vote on captions.

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  description text not null,
  caption text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  caption_id uuid not null references public.captions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value int not null,
  created_at timestamp with time zone default now(),
  constraint unique_vote_per_caption unique (user_id, caption_id)
);

alter table public.images enable row level security;

drop policy if exists "Logged-in users can read images" on public.images;
create policy "Logged-in users can read images"
on public.images for select to authenticated using (true);

drop policy if exists "Users can insert their own images" on public.images;
create policy "Users can insert their own images"
on public.images for insert to authenticated with check (auth.uid() = created_by);

alter table public.captions enable row level security;

drop policy if exists "Logged-in users can read captions" on public.captions;
create policy "Logged-in users can read captions"
on public.captions for select to authenticated using (true);

drop policy if exists "Users can insert their own captions" on public.captions;
create policy "Users can insert their own captions"
on public.captions for insert to authenticated with check (auth.uid() = created_by);

alter table public.votes enable row level security;

drop policy if exists "Logged-in users can read votes" on public.votes;
create policy "Logged-in users can read votes"
on public.votes for select to authenticated using (true);

drop policy if exists "Users can insert their own votes" on public.votes;
create policy "Users can insert their own votes"
on public.votes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own votes" on public.votes;
create policy "Users can update their own votes"
on public.votes for update to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can delete their own votes" on public.votes;
create policy "Users can delete their own votes"
on public.votes for delete to authenticated using (auth.uid() = user_id);
