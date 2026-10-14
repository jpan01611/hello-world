-- Rank posts by the caption displayed on the home feed:
-- the owner's selected caption, or the highest-rated caption when unset.
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
  select
    i.id,
    i.image_url,
    featured.caption,
    coalesce(featured.score, 0)::bigint
  from public.images i
  left join lateral (
    select
      c.caption,
      coalesce(sum(v.value), 0)::bigint as score
    from public.captions c
    left join public.votes v on v.caption_id = c.id
    where c.image_id = i.id
    group by c.id
    order by
      (c.id = i.selected_caption_id) desc,
      score desc,
      c.created_at desc nulls last,
      c.id desc
    limit 1
  ) featured on true
  order by i.created_at desc nulls last, i.id desc;
$$;

revoke all on function public.public_featured_feed() from public;
grant execute on function public.public_featured_feed() to anon, authenticated;
