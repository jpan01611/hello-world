-- Authenticated users may see display names on community posts.
drop policy if exists "Authenticated users can read profile names" on public.profiles;
create policy "Authenticated users can read profile names"
on public.profiles for select to authenticated using (true);
