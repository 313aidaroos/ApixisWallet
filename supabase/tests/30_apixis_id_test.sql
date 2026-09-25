-- Apixis ID: codes are single-use, expire, are bound to client + redirect_uri, and create links.
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'sso@example.com') on conflict do nothing;
insert into public.wallet_api_clients (id, name, app_slugs, key_prefix, key_hash, redirect_uris)
values ('66666666-6666-4666-8666-666666666666', 'renoxis', array['renoxis'], 'apx_test_x', repeat('a', 64), array['https://renoxis.dev/auth/apixis/callback']),
       ('77777777-7777-4777-8777-777777777777', 'socixis', array['socixis'], 'apx_test_y', repeat('b', 64), array['https://socixis.dev/auth/apixis/callback'])
on conflict do nothing;

insert into public.sso_codes (code_hash, client_id, user_id, email, redirect_uri) values
  (repeat('1', 64), '66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'sso@example.com', 'https://renoxis.dev/auth/apixis/callback'),
  (repeat('2', 64), '66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'sso@example.com', 'https://renoxis.dev/auth/apixis/callback'),
  (repeat('3', 64), '66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'sso@example.com', 'https://renoxis.dev/auth/apixis/callback');
update public.sso_codes set expires_at = now() - interval '1 second' where code_hash = repeat('3', 64);

do $$
declare n int; r record;
begin
  if has_table_privilege('anon', 'public.sso_codes', 'select') or has_table_privilege('authenticated', 'public.sso_links', 'select')
     or has_function_privilege('anon', 'public.consume_sso_code(text,uuid,text)', 'execute') then
    raise exception 'SECURITY: Apixis ID tables/functions exposed to customers';
  end if;

  -- wrong client cannot use another site's code
  select count(*) into n from public.consume_sso_code(repeat('1', 64), '77777777-7777-4777-8777-777777777777', 'https://renoxis.dev/auth/apixis/callback');
  if n <> 0 then raise exception 'code accepted for the wrong client'; end if;
  -- wrong redirect_uri
  select count(*) into n from public.consume_sso_code(repeat('1', 64), '66666666-6666-4666-8666-666666666666', 'https://evil.test/cb');
  if n <> 0 then raise exception 'code accepted for the wrong redirect_uri'; end if;
  -- right one works once
  select * into r from public.consume_sso_code(repeat('1', 64), '66666666-6666-4666-8666-666666666666', 'https://renoxis.dev/auth/apixis/callback');
  if r.user_id is distinct from '55555555-5555-4555-8555-555555555555'::uuid or r.email <> 'sso@example.com' then
    raise exception 'valid code rejected: %', r;
  end if;
  select count(*) into n from public.consume_sso_code(repeat('1', 64), '66666666-6666-4666-8666-666666666666', 'https://renoxis.dev/auth/apixis/callback');
  if n <> 0 then raise exception 'code replayed'; end if;
  -- expired code
  select count(*) into n from public.consume_sso_code(repeat('3', 64), '66666666-6666-4666-8666-666666666666', 'https://renoxis.dev/auth/apixis/callback');
  if n <> 0 then raise exception 'expired code accepted'; end if;
  -- link created for renoxis only
  if not exists (select 1 from public.sso_links where client_id = '66666666-6666-4666-8666-666666666666' and user_id = '55555555-5555-4555-8555-555555555555') then
    raise exception 'sso link missing';
  end if;
  if exists (select 1 from public.sso_links where client_id = '77777777-7777-4777-8777-777777777777') then
    raise exception 'link leaked to another client';
  end if;
end $$;

\echo 'apixis id tests: ok'

do $$
begin
  begin
    insert into public.wallet_api_clients (name, app_slugs, key_prefix, key_hash) values ('renoxis', array['renoxis'], 'apx_test_z', repeat('c', 64));
    raise exception 'duplicate active client name accepted';
  exception when unique_violation then null;
  end;
end $$;
\echo 'apixis id client-name uniqueness: ok'
