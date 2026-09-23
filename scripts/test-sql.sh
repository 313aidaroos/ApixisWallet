#!/usr/bin/env bash
# Runs every migration plus supabase/tests/*.sql against a throwaway Postgres database, then a
# concurrency check. Needs a reachable Postgres superuser (psql). Configure with the usual libpq
# env vars, e.g. PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres.
# NEVER point this at the real Supabase project: it creates and drops its own database.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${WALLET_TEST_DB:-apixis_wallet_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done
for f in supabase/tests/[1-9]*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f"
done

# Concurrency: 20 parallel 1,000 Ixis reserves against a 5,000 Ixis wallet. Exactly 5 may succeed.
OWNER=33333333-3333-4333-8333-333333333333
"${PSQL[@]}" -d "$DB" -c "insert into auth.users (id, email) values ('${OWNER}', 'race@example.com')" \
  -c "select public.credit_xp('${OWNER}', 5000, 'paid', 'race pack', 'evt_race')" >/dev/null
for i in $(seq 1 20); do
  "${PSQL[@]}" -d "$DB" -c "select public.reserve_xp('${OWNER}', 1000, 'race', 'race-key-${i}')" >/dev/null 2>&1 &
done
wait
"${PSQL[@]}" -d "$DB" -At -c "
  do \$\$
  declare v record; holds int;
  begin
    select * into v from public.wallet_balances where owner_id = '${OWNER}';
    select count(*) into holds from public.ledger_transactions where external_id like 'race-key-%';
    if v.available_xp < 0 or v.reserved_xp <> 5000 or holds <> 5 then
      raise exception 'RACE: available % reserved % holds %', v.available_xp, v.reserved_xp, holds;
    end if;
  end \$\$;" >/dev/null
echo "concurrency test: ok (5 of 20 parallel reserves held, no overdraw)"

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}"
echo "sql tests: ok"
