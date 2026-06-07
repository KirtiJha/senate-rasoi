-- RPC: delete_own_account
-- Called from profile/me.tsx when user taps "Delete my account".
-- Runs as SECURITY DEFINER so it can reach auth.users.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete profile (cascades to listings, inquiries, posts, comments via FK)
  delete from public.profiles where id = auth.uid();
  -- Delete the Supabase auth user
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
