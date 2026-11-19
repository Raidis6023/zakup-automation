#!/usr/bin/env bash
# GitHub-only drill: back up one harmless synthetic PostgreSQL table,
# drop it, restore it from pg_dump and verify exact values.
# This is NOT a complete production restore drill or backup configuration.
set -Eeuo pipefail

if [[ "$(printenv GITHUB_ACTIONS || true)" != "true" ||
      "$(printenv PANDA_CI_DISPOSABLE || true)" != "yes" ]]; then
  echo "Refusing backup drill outside an explicitly disposable GitHub test" >&2
  exit 78
fi
if [[ ! -f docker-compose.smoke.yml || ! -f .env ]]; then
  echo "Must be run from prepared isolated Supabase test directory" >&2
  exit 78
fi

compose() {
  docker compose -f docker-compose.yml -f docker-compose.panda.yml \
    -f docker-compose.smoke.yml --env-file .env "$@"
}

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
chmod 700 "$temp_dir"
BACKUP="$temp_dir/synthetic-db.dump"

# Never test destructive restore against working or copied user tables.
compose exec -T db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.panda_ci_backup_probe (
  id integer PRIMARY KEY, marker text NOT NULL
);
INSERT INTO public.panda_ci_backup_probe VALUES (7, 'only-synthetic-backup-test');
SQL

compose exec -T db pg_dump -U postgres -d postgres \
  --format=custom --no-owner --no-acl \
  --table=public.panda_ci_backup_probe > "$BACKUP"
test -s "$BACKUP"
# A backup is meaningless if it cannot be read by pg_restore.
compose exec -T db pg_restore -l < "$BACKUP" > "$temp_dir/list"
grep -q 'panda_ci_backup_probe' "$temp_dir/list"

compose exec -T db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
  -c 'DROP TABLE public.panda_ci_backup_probe;'
compose exec -T db pg_restore -U postgres -d postgres \
  --no-owner --no-acl --single-transaction --exit-on-error < "$BACKUP"
actual=$(compose exec -T db psql -U postgres -d postgres -At \
  -v ON_ERROR_STOP=1 -c \
  "SELECT id||':'||marker FROM public.panda_ci_backup_probe;")
test "$actual" = "7:only-synthetic-backup-test"
compose exec -T db psql -U postgres -d postgres -q \
  -v ON_ERROR_STOP=1 -c 'DROP TABLE public.panda_ci_backup_probe;'

echo "PASS: synthetic PostgreSQL custom-format dump was restored and verified"
