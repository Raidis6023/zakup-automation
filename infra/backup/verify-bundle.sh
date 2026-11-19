#!/usr/bin/env bash
# Verify an extracted Panda backup bundle. READ-ONLY: never restores SQL.
set -Eeuo pipefail
umask 077
bundle="${1:-}"
[[ "$bundle" == /* && -d "$bundle" && ! -L "$bundle" ]] || {
  echo "Provide an absolute extracted backup directory" >&2
  exit 64
}
for path in postgres.dump postgres-globals.sql postgres-objects.txt storage.tar \
  host-config/supabase.env host-config/panda.env \
  db-config/pgsodium_root.key panda-secrets/supabase-secret-key \
  panda-secrets/cron-secret SHA256SUMS manifest.txt; do
  [[ -s "$bundle/$path" && ! -L "$bundle/$path" ]] || {
    echo "INCOMPLETE: missing or symlinked backup component $path" >&2
    exit 2
  }
done
grep -qx 'PANDA_BACKUP_FORMAT=1' "$bundle/manifest.txt" || {
  echo "Unsupported backup format" >&2
  exit 2
}
# SHA256 checks every protected component without printing its contents.
(cd "$bundle" && sha256sum --check --quiet SHA256SUMS)
[[ "$(head -c 5 "$bundle/postgres.dump")" == "PGDMP" ]] || {
  echo "Postgres dump is not a custom-format archive" >&2
  exit 2
}
tar -tf "$bundle/storage.tar" >/dev/null
printf 'PASS: all required backup components and checksums verified\n'
