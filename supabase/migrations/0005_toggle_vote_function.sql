-- Atomic vote toggle: avoids the race condition in the old
-- select-then-insert/update/delete approach, where two fast clicks could
-- both read "no existing vote" before either write landed, so neither ever
-- reached the delete (undo) branch. `for update` locks the row for the
-- duration of the transaction, serializing concurrent calls.
create or replace function public.toggle_vote(p_caption_id uuid, p_value int)
returns void
language plpgsql
security invoker
as $$
declare
  existing_value int;
begin
  select value into existing_value
  from public.votes
  where caption_id = p_caption_id and user_id = auth.uid()
  for update;

  if existing_value is null then
    insert into public.votes (caption_id, user_id, value)
    values (p_caption_id, auth.uid(), p_value);
  elsif existing_value = p_value then
    delete from public.votes
    where caption_id = p_caption_id and user_id = auth.uid();
  else
    update public.votes
    set value = p_value
    where caption_id = p_caption_id and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.toggle_vote(uuid, int) to authenticated;
