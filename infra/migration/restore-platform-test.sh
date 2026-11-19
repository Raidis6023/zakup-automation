#!/usr/bin/env bash
# Restore managed Supabase CLI dumps to a NEW empty local PostgreSQL 17.
# This script NEVER connects to a cloud source and never starts cron jobs.
set -Eeuo pipefail
umask 077
die() { echo "RESTORE BLOCKED: $*" >&2; exit 78; }
[[ "$(id -u)" == "0" ]] || die "Requires root on the isolated test machine"
[[ "${PANDA_TARGET_DISPOSABLE:-}" == "CONFIRMED_EMPTY_TEST_DATABASE" ]] ||
  die "Explicit approval of empty disposable target required"
[[ "${PANDA_SCHEDULER_DISABLED:-}" == "YES" ]] ||
  die "Background jobs and external writes must be disabled"
[[ "${PANDA_TEST_DUMP_DIR:-}" == /* && -d "$PANDA_TEST_DUMP_DIR" &&
   ! -L "$PANDA_TEST_DUMP_DIR" ]] || die "Absolute protected dump directory required"
[[ "${PGSERVICEFILE:-}" == /* && -s "$PGSERVICEFILE" && ! -L "$PGSERVICEFILE" ]] ||
  die "Provide local libpq service file, not a database URL with password"
[[ "$(stat -c %a "$PGSERVICEFILE")" == "600" ]] || die "PGSERVICEFILE requires mode 600"
[[ "${PANDA_TARGET_PGSERVICE:-}" =~ ^[A-Za-z0-9_-]+$ ]] || die "Invalid local service name"
[[ "${PANDA_EXPECT_AUTH_USERS:-}" =~ ^[1-9][0-9]*$ ]] || die "Source staff count required"
[[ "${PANDA_EXPECT_TABLES:-}" =~ ^[1-9][0-9]*$ ]] || die "Source table count required"
for t in psql node grep stat; do command -v "$t" >/dev/null || die "Missing $t"; done
for name in roles schema data; do
  [[ -s "$PANDA_TEST_DUMP_DIR/$name.sql" && ! -L "$PANDA_TEST_DUMP_DIR/$name.sql" ]] ||
    die "Missing $name.sql"
  # Fail closed: never restore dangerous old cloud schedules.
  if grep -Eiq 'vercel[.]app|cron[.]schedule[[:space:]]*\(' "$PANDA_TEST_DUMP_DIR/$name.sql"; then
    die "A dump includes old URLs or cron schedules: $name.sql"
  fi
done
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
node "$repo_dir/scripts/storage-dump-preflight.mjs" "$PANDA_TEST_DUMP_DIR/data.sql" >/dev/null ||
  die "Unsafe data dump (Auth/Storage/Vault/cron guard failed)"

conn="service=$PANDA_TARGET_PGSERVICE"
psqltest() { psql -X -w -q -At -v ON_ERROR_STOP=1 -d "$conn" "$@"; }
before="$(psqltest -c "
SELECT current_setting('server_version_num')::integer/10000, inet_server_addr()::text,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
  WHERE n.nspname='public' AND c.relkind IN('r','p')),
 (SELECT count(*) FROM auth.users),(SELECT count(*) FROM storage.objects),
 (SELECT count(*) FROM vault.secrets),(SELECT count(*) FROM cron.job);")"
IFS='|' read -r major host tables users objects secrets cron <<< "$before"
[[ "$major" == "17" && "$host" == "127.0.0.1" &&
  "$tables" == "0" && "$users" == "0" && "$objects" == "0" &&
  "$secrets" == "0" && "$cron" == "0" ]] ||
  die "Refusing to modify nonempty/non-local/non-PG17 database"
echo "CHECK: new private localhost PostgreSQL 17 target is empty"

# Supabase CLI role/schema/data restoration as documented by Supabase.
# Keep it atomic: failure must not leave partial migrated data.
psql -X -w -q --single-transaction --set ON_ERROR_STOP=1 \
 --dbname "$conn" \
 --file "$PANDA_TEST_DUMP_DIR/roles.sql" \
 --file "$PANDA_TEST_DUMP_DIR/schema.sql" \
 --command 'SET session_replication_role = replica;' \
 --file "$PANDA_TEST_DUMP_DIR/data.sql" >/dev/null

after="$(psqltest -c "
SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='public' AND c.relkind IN('r','p')),
 (SELECT count(*) FROM auth.users), (SELECT count(*) FROM storage.objects),
 (SELECT count(*) FROM cron.job);")"
IFS='|' read -r tables users objects cron <<< "$after"
[[ "$tables" == "$PANDA_EXPECT_TABLES" && "$users" == "$PANDA_EXPECT_AUTH_USERS" &&
 "$objects" == "0" && "$cron" == "0" ]] ||
 die "Restored schema/staff counts mismatch, or old Storage/cron rows present"
echo "PASS: platform schema and staff restored on protected local test instance"
echo "STOP: photos, external integration keys and full app testing are still required"
