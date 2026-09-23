-- 009_apixis_id.sql
-- Apixis ID: one login for the whole family. Safe to re-run. Apply after 008.
--
-- The Wallet's Supabase project is the identity provider. A sister site sends the browser to
-- Wallet /sso/authorize; the signed-in Wallet user is redirected back with a one-time code; the
-- site's SERVER exchanges it (with its own apx_ API key) at /api/sso/token for the Wallet user id
-- and verified email, then signs that person into its own Supabase project.
--
--  * wallet_api_clients.redirect_uris — exact callback URLs a client may receive codes on.
--  * wallet_api_clients.require_sso — once true, that site may only redeem for users who signed in
--    through Apixis ID (owner_id from the token), never a bare email.
--  * sso_codes — single-use, 2-minute codes, stored hashed.
--  * sso_links — which Wallet users signed in to which site. A site's key may only read balances
--    and redeem for users linked to it (proof the person actually logged in there).

begin;

alter table public.wallet_api_clients
  add column if not exists redirect_uris text[] not null default '{}',
  add column if not exists require_sso boolean not null default false;

create table if not exists public.sso_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id uuid not null references public.wallet_api_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  used_at timestamptz
);
create index if not exists sso_codes_expires_idx on public.sso_codes (expires_at);

create table if not exists public.sso_links (
  client_id uuid not null references public.wallet_api_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

alter table public.sso_codes enable row level security;
alter table public.sso_links enable row level security;
revoke all on public.sso_codes, public.sso_links from public, anon, authenticated;

-- Atomically consume a code: exactly once, unexpired, same client and redirect_uri.
create or replace function public.consume_sso_code(p_code_hash text, p_client_id uuid, p_redirect_uri text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_user uuid; v_email text;
begin
  update sso_codes c set used_at = now()
   where c.code_hash = p_code_hash and c.client_id = p_client_id and c.redirect_uri = p_redirect_uri
     and c.used_at is null and c.expires_at > now()
  returning c.user_id, c.email into v_user, v_email;
  if v_user is null then return; end if;
  insert into sso_links (client_id, user_id) values (p_client_id, v_user)
  on conflict (client_id, user_id) do update set last_login_at = now();
  delete from sso_codes where expires_at < now() - interval '1 day';
  user_id := v_user; email := v_email;
  return next;
end $$;

revoke all on function public.consume_sso_code(text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_sso_code(text, uuid, text) to service_role;

commit;
