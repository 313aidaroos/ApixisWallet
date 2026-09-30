-- Run ONCE in the Supabase SQL editor of project "313aidaroos's Project" (ref myfclypikkcvfurrlsko).
-- Claude's MCP user has no write permission on that project, so this one is manual.
-- Advisor findings only; no behaviour change. Same SQL was applied by Claude on Contraxis, Lyrixis, Ominix.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
       and p.proname in ('handle_new_user', 'rls_auto_enable', 'set_updated_at', 'update_subscriptions_updated_at')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('set_updated_at', 'current_contractor_id', 'current_homeowner_id', 'cleanup_old_snapshots', 'update_subscriptions_updated_at')
  loop
    execute format('alter function %s set search_path = public', f);
  end loop;

  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'awad_command' and p.proname = 'claim_queued_task'
  loop
    execute format('alter function %s set search_path = awad_command, public', f);
  end loop;
end $$;
