-- The gallery feed is now the public homepage: anyone (including
-- signed-out visitors) can view images/captions/votes, but only
-- authenticated users can vote (insert/update/delete on votes, already
-- restricted since 0003/0005), and only a post's original owner can
-- edit or delete it.

drop policy if exists "Logged-in users can read images" on public.images;
create policy "Anyone can read images"
on public.images for select using (true);

drop policy if exists "Logged-in users can read captions" on public.captions;
create policy "Anyone can read captions"
on public.captions for select using (true);

drop policy if exists "Logged-in users can read votes" on public.votes;
create policy "Anyone can read votes"
on public.votes for select using (true);

-- Owner-only edit/delete on posts. Captions/votes already cascade-delete
-- via their FK `on delete cascade`, so deleting an image removes its
-- captions and votes automatically.
drop policy if exists "Users can update their own images" on public.images;
create policy "Users can update their own images"
on public.images for update to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "Users can delete their own images" on public.images;
create policy "Users can delete their own images"
on public.images for delete to authenticated
using (auth.uid() = created_by);

drop policy if exists "Users can update their own captions" on public.captions;
create policy "Users can update their own captions"
on public.captions for update to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "Users can delete their own captions" on public.captions;
create policy "Users can delete their own captions"
on public.captions for delete to authenticated
using (auth.uid() = created_by);
