-- Performance: the gallery feed query joins images -> captions -> votes and
-- sorts by created_at on both images and captions. Without indexes on the
-- foreign keys and sort columns, these joins/sorts degrade to sequential
-- scans as the tables grow. Run this in the Supabase SQL Editor.

create index if not exists images_created_at_idx
  on public.images (created_at desc);

create index if not exists captions_image_id_idx
  on public.captions (image_id);

create index if not exists captions_created_at_idx
  on public.captions (created_at asc);

create index if not exists votes_caption_id_idx
  on public.votes (caption_id);

-- Already covered by the unique_vote_per_caption constraint's implicit
-- index, but explicit for clarity/documentation:
-- unique (user_id, caption_id) on public.votes
