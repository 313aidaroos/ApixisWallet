-- audit_events: service_role only, sequential references, idempotent, append-only.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then raise exception 'expected SQLSTATE %, got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql; end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.audit_events', 'select') or has_table_privilege('authenticated', 'public.audit_events', 'select')
     or has_table_privilege('authenticated', 'public.audit_events', 'insert') then
    raise exception 'SECURITY: audit_events readable/writable by customers';
  end if;
  if has_table_privilege('service_role', 'public.audit_events', 'update') or has_table_privilege('service_role', 'public.audit_events', 'delete') then
    raise exception 'audit_events must not be updatable by service_role';
  end if;
end $$;

set role service_role;
insert into public.audit_events (event_type, dedupe_key, actor, amount_ixis, amount_cents, currency, stripe_event_id)
values ('purchase', 'purchase:evt_audit_1', 'stripe', 1000, 1000, 'usd', 'evt_audit_1');
insert into public.audit_events (event_type, dedupe_key, actor, amount_ixis, amount_cents, currency, stripe_event_id)
values ('purchase', 'purchase:evt_audit_1', 'stripe', 1000, 1000, 'usd', 'evt_audit_1')
on conflict (dedupe_key) do nothing;
insert into public.audit_events (event_type, actor, app_slug, amount_ixis) values ('reserve', 'key:renoxis', 'renoxis', 5000);
reset role;

do $$
declare n int; refs text[];
begin
  select count(*) into n from public.audit_events where dedupe_key = 'purchase:evt_audit_1';
  if n <> 1 then raise exception 'dedupe failed: % rows', n; end if;
  select array_agg(reference order by id) into refs from public.audit_events;
  if refs[1] !~ '^APX-[0-9]{8}$' or refs[1] = refs[2] then raise exception 'bad references %', refs; end if;
end $$;

select pg_temp.expect_error($q$update public.audit_events set amount_ixis = 1$q$, 'WA403');
select pg_temp.expect_error($q$delete from public.audit_events$q$, 'WA403');
select pg_temp.expect_error($q$insert into public.audit_events (event_type) values ('made_up')$q$, '23514');

\echo 'audit tests: ok'
