-- Adds an avatar_url column to profiles so users can attach a profile
-- picture uploaded to the `avatars` storage bucket.
-- (Bucket itself is created/configured via the Supabase dashboard, not here.)

alter table public.profiles
  add column if not exists avatar_url text;
