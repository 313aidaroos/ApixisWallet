-- Monthly seats: one live row per person and product, source switch cancels the other, customers cannot write.
\set ON_ERROR_STOP 1

-- Not 66666666-…: scripts/test-sql.sh inserts that id later for the welcome-grant race.
insert into auth.users (id, email) values ('88888888-8888-4888-8888-888888888888', 'sub-test@example.com')
on conflict do nothing;

set role service_role;

do $$
declare n int; live_source text; live_id uuid;
begin
  perform public.enroll_subscription(
    '88888888-8888-4888-8888-888888888888', 'renoxis.agent.monthly', 'ixis', 5000, now() + interval '30 days'
  );
  perform public.enroll_subscription(
    '88888888-8888-4888-8888-888888888888', 'renoxis.agent.monthly', 'ixis', 5000, now() + interval '30 days'
  );
  select count(*) into n from public.subscriptions
   where owner_id = '88888888-8888-4888-8888-888888888888' and status in ('active', 'past_due');
  if n <> 1 then raise exception 'expected 1 live subscription, got %', n; end if;

  perform public.enroll_subscription(
    '88888888-8888-4888-8888-888888888888', 'renoxis.agent.monthly', 'card', 5000,
    now() + interval '30 days', 'sub_test_card', 'cus_test'
  );
  select count(*), max(source) into n, live_source from public.subscriptions
   where owner_id = '88888888-8888-4888-8888-888888888888' and status in ('active', 'past_due');
  if n <> 1 or live_source <> 'card' then
    raise exception 'card switch left % live rows source %', n, live_source;
  end if;

  select id into live_id from public.subscriptions where stripe_subscription_id = 'sub_test_card' and status = 'active';
  perform public.mark_subscription_past_due(live_id);
  if not exists (
    select 1 from public.subscriptions where id = live_id and status = 'past_due'
  ) then raise exception 'past_due did not stick'; end if;

  perform public.request_subscription_cancel('88888888-8888-4888-8888-888888888888', 'renoxis.agent.monthly');
  if not exists (
    select 1 from public.subscriptions where id = live_id and cancel_at_period_end
  ) then raise exception 'cancel_at_period_end did not stick'; end if;

  insert into public.audit_events (event_type, dedupe_key, actor, outcome)
  values ('subscription_renewed', 'subscription_renewed:test', 'cron', 'ok');

  if has_table_privilege('anon', 'public.subscriptions', 'insert')
     or has_table_privilege('authenticated', 'public.subscriptions', 'select')
     or has_function_privilege('anon', 'public.enroll_subscription(uuid,text,text,bigint,timestamptz,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.enroll_subscription(uuid,text,text,bigint,timestamptz,text,text)', 'execute')
  then
    raise exception 'SECURITY: customers can touch subscriptions';
  end if;
end $$;

reset role;
