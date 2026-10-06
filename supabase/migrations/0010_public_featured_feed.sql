-- Anonymous visitors receive only one featured caption per post through this
-- narrow RPC. Raw captions, prompts and individual votes remain private.
create or replace function public.public_featured_feed()
returns table (
  id uuid,
  image_url text,
  caption text,
  score bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.image_url, featured.caption, featured.score
  from public.images i
  left join lateral (
    select c.caption, coalesce(sum(v.value), 0)::bigint as score
    from public.captions c
    left join public.votes v on v.caption_id = c.id
    where c.image_id = i.id
    group by c.id
    order by score desc, c.created_at desc nulls last, c.id desc
    limit 1
  ) featured on true
  order by i.created_at desc nulls last, i.id desc;
$$;

revoke all on function public.public_featured_feed() from public;
grant execute on function public.public_featured_feed() to anon, authenticated;

drop policy if exists "Users can insert their own captions" on public.captions;
create policy "Post owners can generate captions"
on public.captions for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.images i
    where i.id = image_id and i.created_by = auth.uid()
  )
);
