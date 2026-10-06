-- HW4: persist the exact prompts used to generate each caption, so every
-- piece of AI-generated media is traceable to the inputs that produced it.
-- The pipeline makes two model calls (vision -> description, then text ->
-- caption), so we record both prompts.

alter table public.captions
  add column if not exists vision_prompt text;

alter table public.captions
  add column if not exists caption_prompt text;
