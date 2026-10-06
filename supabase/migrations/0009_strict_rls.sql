-- HW4: tighten RLS to the strictest rules that don't break the app.
--
-- Migration 0007 opened reads up to everyone (anon included) for a "public
-- homepage" idea, but the app actually gates every page behind login (the
-- homepage redirects signed-out visitors to /login). Since nothing reads
-- these tables anonymously, we restrict SELECT back to authenticated users.
--
-- Full RLS posture after this migration:
--   profiles  : owner-only read + update (0001); rows created by the
--               security-definer signup trigger.
--   images    : authenticated read; owner-only insert/update/delete.
--   captions  : authenticated read; owner-only insert/update/delete.
--   votes     : authenticated read; owner-only insert/update/delete,
--               one row per (user, caption) via a unique constraint.

drop policy if exists "Anyone can read images" on public.images;
create policy "Authenticated users can read images"
on public.images for select to authenticated using (true);

drop policy if exists "Anyone can read captions" on public.captions;
create policy "Authenticated users can read captions"
on public.captions for select to authenticated using (true);

drop policy if exists "Anyone can read votes" on public.votes;
create policy "Authenticated users can read votes"
on public.votes for select to authenticated using (true);
