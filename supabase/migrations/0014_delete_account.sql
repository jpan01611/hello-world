-- Allows an authenticated user to permanently remove their own account.
-- Foreign keys from profiles, images, captions, and votes cascade from auth.users.
create or replace function public.delete_current_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users
  where id = auth.uid();
end;
$$;

revoke execute on function public.delete_current_account() from public;
revoke execute on function public.delete_current_account() from anon;
grant execute on function public.delete_current_account() to authenticated;
