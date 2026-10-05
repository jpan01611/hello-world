-- RLS policies for the `images` and `avatars` Storage buckets. These buckets
-- are created via the Supabase dashboard (not here), but `storage.objects`
-- has RLS enabled by default, so without these policies every upload fails
-- with "new row violates row-level security policy" regardless of the
-- policies already defined on public.images/public.profiles.

drop policy if exists "Images are publicly accessible" on storage.objects;
create policy "Images are publicly accessible"
on storage.objects for select
using (bucket_id = 'images');

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'images');

drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Avatars are publicly accessible"
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
using (bucket_id = 'avatars')
with check (bucket_id = 'avatars');
