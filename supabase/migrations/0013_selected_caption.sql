alter table public.images
    add column if not exists selected_caption_id uuid references public.captions(id) on delete set null;

create index if not exists images_selected_caption_id_idx
    on public.images(selected_caption_id);
