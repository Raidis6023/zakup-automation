#!/usr/bin/env bash
# PANDA full quiesced backup to an external encrypted restic repository.
# No working-system commands are executed unless the operator opts in.
set -Eeuo pipefail
umask 077
die() { printf 'BACKUP BLOCKED: %s\n' "$*" >&2; exit 78; }
for tool in docker restic tar sha256sum mktemp find cp tr; do
  command -v "$tool" >/dev/null 2>&1 || die "Missing dependency: $tool"
done
[[ "$(id -u)" == "0" ]] || die "Root required to read protected server keys"
[[ "${PANDA_WRITES_PAUSED:-}" == "YES" ]] || die "Pause ALL web, storage and scheduled writes before running"
[[ -n "${RESTIC_REPOSITORY:-}" && -n "${RESTIC_PASSWORD_FILE:-}" ]] || die "Configure remote encrypted restic"
[[ -s "$RESTIC_PASSWORD_FILE" ]] || die "Missing restic encryption password"
case "$RESTIC_REPOSITORY" in
  sftp:*|s3:*|b2:*|gs:*|azure:*|rest:*|rclone:*) ;;
  *) [[ "${GITHUB_ACTIONS:-}" == "true" && "${PANDA_CI_DISPOSABLE:-}" == "yes" ]] ||
    die "Refusing backup to the same host; configure an external repository" ;;
esac
for var in PANDA_SUPABASE_DIR PANDA_APP_DIR PANDA_SECRETS_DIR; do
  value="${!var:-}"
  [[ "$value" == /* && -d "$value" && ! -L "$value" ]] ||
    die "$var must point to a real absolute directory"
done
root="$PANDA_SUPABASE_DIR"
[[ -s "$root/.env" ]] || die "Supabase .env missing"
[[ -s "$PANDA_APP_DIR/.env.docker" ]] || die "Panda .env.docker missing"
[[ -d "$root/volumes/storage" ]] || die "Local Storage directory missing"
[[ -s "$PANDA_SECRETS_DIR/supabase-secret-key" ]] || die "Panda Supabase key missing"
[[ -s "$PANDA_SECRETS_DIR/cron-secret" ]] || die "Panda cron key missing"
temp_root="${PANDA_BACKUP_STAGE_DIR:-/var/tmp}"
[[ "$temp_root" == /* && -d "$temp_root" && ! -L "$temp_root" ]] ||
  die "Staging path must be an existing local directory"
[[ "$temp_root" != "$RESTIC_REPOSITORY" ]] || die "Staging equals backup target"
stage="$(mktemp -d "$temp_root/panda-backup.XXXXXXXX")"
trap 'rm -rf -- "$stage"' EXIT
chmod 700 "$stage"

compose() {
  (cd "$root"; docker compose -f docker-compose.yml -f docker-compose.panda.yml --env-file .env "$@")
}
version="$(compose exec -T db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c 'SHOW server_version_num;' | tr -d '\r\n')"
[[ "$version" =~ ^17[0-9]{4}$ ]] || die "Unexpected PostgreSQL version"
# Full dump includes Auth, Storage metadata, Vault ciphertext and database functions.
# Do NOT suppress owner/grants: Panda uses explicit database permissions.
# The full backup must preserve role-specific privileges on restored data.
compose exec -T db pg_dump -U postgres -d postgres --format=custom \
  > "$stage/postgres.dump"
[[ -s "$stage/postgres.dump" ]] || die "Postgres dump is empty"
compose exec -T db pg_restore --list < "$stage/postgres.dump" > "$stage/postgres-objects.txt"
[[ -s "$stage/postgres-objects.txt" ]] || die "Postgres dump cannot be inspected"
compose exec -T db pg_dumpall -U postgres --globals-only > "$stage/postgres-globals.sql"
[[ -s "$stage/postgres-globals.sql" ]] || die "Roles dump is empty"

tar --create --file="$stage/storage.tar" -C "$root/volumes/storage" .
mkdir -m 700 "$stage/db-config"
docker cp "supabase-db:/etc/postgresql-custom/." "$stage/db-config/" >/dev/null
[[ -s "$stage/db-config/pgsodium_root.key" ]] ||
  die "CRITICAL: pgsodium root encryption key missing from db-config!"
mkdir -m 700 "$stage/host-config" "$stage/panda-secrets"
cp -- "$root/.env" "$stage/host-config/supabase.env"
cp -- "$PANDA_APP_DIR/.env.docker" "$stage/host-config/panda.env"
cp -a -- "$PANDA_SECRETS_DIR/." "$stage/panda-secrets/"
printf 'PANDA_BACKUP_FORMAT=1\nUTC=%s\nPOSTGRES=%s\n' \
  "$(date -u +%FT%TZ)" "$version" > "$stage/manifest.txt"
(cd "$stage"; find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z |
  xargs -0 -r sha256sum > SHA256SUMS)
restic backup --tag panda --tag full-quiesced "$stage" >/dev/null
printf 'PASS: encrypted bundle uploaded to the configured restic repository\n'
printf 'NOTE: Restic snapshot still requires a separate full restore rehearsal\n'
