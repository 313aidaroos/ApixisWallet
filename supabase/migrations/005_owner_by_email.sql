-- 005_owner_by_email.sql
-- Every sister site runs its own Supabase project, so the same human has a DIFFERENT
-- auth user id on every site. wallets.owner_id references THIS project's auth.users,
-- so any owner_id a sister site sends is unknown here → FK violation → every redeem 500s.
-- The one identifier that is identical across the family is the verified email.
-- Sister sites now send owner_email; the API resolves it to the Wallet's own user
-- (creating a confirmed passwordless user on first sight, so when that person later
-- signs in to the Wallet with the same email they land on the same wallet).
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
