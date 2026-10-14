-- checkout_payment_failed is an audit label only. It must not be writable by customers.
\set ON_ERROR_STOP 1

set role service_role;
insert into public.audit_events (event_type, dedupe_key, actor, outcome, stripe_checkout_session_id)
values ('checkout_payment_failed', 'checkout_payment_failed:cs_test', 'stripe', 'failed', 'cs_test');
insert into public.audit_events (event_type, dedupe_key, actor, outcome, stripe_checkout_session_id)
values ('checkout_payment_failed', 'checkout_payment_failed:cs_test', 'stripe', 'failed', 'cs_test')
on conflict (dedupe_key) do nothing;
reset role;

do $$
declare n int;
begin
  select count(*) into n from public.audit_events where dedupe_key = 'checkout_payment_failed:cs_test';
  if n <> 1 then raise exception 'failed-payment audit dedupe got % rows', n; end if;
  if has_table_privilege('anon', 'public.audit_events', 'insert')
     or has_table_privilege('authenticated', 'public.audit_events', 'insert') then
    raise exception 'SECURITY: customers can insert audit_events';
  end if;
end $$;
