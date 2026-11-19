#!/usr/bin/env bash
# Disposable rehearsal: restore a full SQL dump into a separate empty DB.
# Never run against working or migrated user data.
set -Eeuo pipefail
umask 077
die() { printf 'RESTORE TEST BLOCKED: %s\n' "$*" >&2; exit 78; }
[[ "${GITHUB_ACTIONS:-}" == "true" && "${PANDA_CI_DISPOSABLE:-}" == "yes" ]] ||
  die "Use only disposable GitHub runner"
[[ "${PANDA_RESTORE_BUNDLE:-}" == /* && -d "${PANDA_RESTORE_BUNDLE:-}" ]] ||
  die "Set PANDA_RESTORE_BUNDLE to verified extracted archive"
[[ -s "$PANDA_RESTORE_BUNDLE/postgres.dump" ]] || die "Missing full database dump"
[[ -f ./docker-compose.smoke.yml && -f ./.env ]] ||
  die "Run only inside disposable Supabase checkout"

db="panda_ci_restore_$(date +%s)"
[[ "$db" =~ ^panda_ci_restore_[0-9]{10,11}$ ]] || die "Invalid test database"
compose() {
  docker compose -f docker-compose.yml -f docker-compose.panda.yml \
    -f docker-compose.smoke.yml --env-file .env "$@"
}
cleanup() {
  compose exec -T db dropdb -U postgres --if-exists "$db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Ordinary "postgres" is not a superuser in Supabase.
# Restore protected Vault schema with the privileged administrative role.
admin="$(compose exec -T db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT CASE WHEN rolsuper THEN 'yes' ELSE 'no' END FROM pg_roles WHERE rolname='supabase_admin'")"
[[ "$admin" == "yes" ]] || die "Supabase administrative superuser is missing"
source_auth_owner="$(compose exec -T db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='auth.users'::regclass")"
source_storage_owner="$(compose exec -T db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='storage.objects'::regclass")"
[[ -n "$source_auth_owner" && -n "$source_storage_owner" ]] || die "Missing source object owners"
compose exec -T db createdb -U postgres -T template0 "$db"
log="$(mktemp)"
trap 'rm -f "$log"; cleanup' EXIT
echo "CHECK: attempting full database restore into isolated temporary DB"
if ! timeout 240s docker compose -f docker-compose.yml -f docker-compose.panda.yml \
    -f docker-compose.smoke.yml --env-file .env exec -T db \
    pg_restore -U supabase_admin --dbname="$db" \
    --single-transaction --exit-on-error \
    < "$PANDA_RESTORE_BUNDLE/postgres.dump" > "$log" 2>&1; then
  echo "FAIL: full backup cannot yet be restored into a clean PostgreSQL database" >&2
  grep -m 1 -E '^(pg_restore: error:|ERROR:)' "$log" | cut -c 1-180 >&2 || true
  exit 1
fi
checks="$(compose exec -T db psql -U postgres -d "$db" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'people='||count(*) FROM auth.users;
SELECT 'photos='||count(*) FROM storage.objects;
SELECT 'acl_fixture='||count(*) FROM public.panda_ci_acl_probe WHERE marker='fixture-only';
SELECT 'acl_grant='||has_table_privilege('panda_ci_backup_reader','public.panda_ci_acl_probe','SELECT');
SELECT 'vault_secret='||EXISTS(
  SELECT 1 FROM vault.decrypted_secrets
  WHERE name='panda_ci_restore_fixture'
    AND decrypted_secret='synthetic-only-ci-secret-2026'
);
SELECT 'auth_owner='||pg_get_userbyid(relowner)
  FROM pg_class WHERE oid='auth.users'::regclass;
SELECT 'storage_owner='||pg_get_userbyid(relowner)
  FROM pg_class WHERE oid='storage.objects'::regclass;
SQL
)"
# The SQL above returns counts and one boolean only, never real records.
echo "CHECK: post-restore synthetic counts and grant flags:"
printf '%s\n' "$checks"
printf '%s\n' "$checks" | grep -qx 'people=1'
printf '%s\n' "$checks" | grep -qx 'photos=1'
printf '%s\n' "$checks" | grep -qx 'acl_fixture=1'
printf '%s\n' "$checks" | grep -qx 'acl_grant=true'
printf '%s\n' "$checks" | grep -qx 'vault_secret=true'
printf '%s\n' "$checks" | grep -Fqx "auth_owner=$source_auth_owner"
printf '%s\n' "$checks" | grep -Fqx "storage_owner=$source_storage_owner"
echo "PASS: full dump restored to independent database, with synthetic Auth, Storage, ACL, ownership and Vault decryption"
