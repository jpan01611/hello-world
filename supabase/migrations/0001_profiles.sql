-- Profiles table + auth trigger (already applied in this project's Supabase
-- instance via the SQL editor). Kept here so the schema is versioned and
-- reproducible for a fresh Supabase project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Insert a blank profile row automatically whenever a new user is created
-- (e.g. after their first Google OAuth login).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage bucket for profile photos. We only ever store a public URL in
-- profiles.avatar_url - never the binary image data itself.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- RLS is off for the profiles table per assignment instructions, but the
-- storage.objects table is managed by Supabase and keeps RLS enabled, so we
-- add permissive policies scoped to the avatars bucket.
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars');

drop policy if exists "Authenticated users can update their avatars" on storage.objects;
create policy "Authenticated users can update their avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars');
