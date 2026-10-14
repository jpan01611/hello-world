-- Rank the anonymous Top rated filter by the combined net votes of every
-- caption on a post, rather than by the score of one caption.
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
    coalesce(post_score.score, 0)::bigint
  from public.images i
  left join lateral (
    select c.caption
    from public.captions c
    left join public.votes v on v.caption_id = c.id
    where c.image_id = i.id
    group by c.id
    order by coalesce(sum(v.value), 0) desc, c.created_at desc nulls last, c.id desc
    limit 1
  ) featured on true
  left join lateral (
    select coalesce(sum(v.value), 0)::bigint as score
    from public.captions c
    left join public.votes v on v.caption_id = c.id
    where c.image_id = i.id
  ) post_score on true
  order by i.created_at desc nulls last, i.id desc;
$$;

revoke all on function public.public_featured_feed() from public;
grant execute on function public.public_featured_feed() to anon, authenticated;
