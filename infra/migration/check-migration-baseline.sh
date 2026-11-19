#!/usr/bin/env bash
# Confirm that the GitHub migration chain is DELTAS, not a complete baseline.
# Run only against a disposable, empty official self-hosted Supabase database.
set -Eeuo pipefail
if [[ "$(printenv GITHUB_ACTIONS || true)" != "true" ||
      "$(printenv PANDA_CI_DISPOSABLE || true)" != "yes" ]]; then
  echo "Refusing schema rehearsal outside isolated GitHub runner" >&2
  exit 78
fi
if [[ ! -e docker-compose.smoke.yml || ! -e .env ]]; then
  echo "Run from isolated Supabase Docker checkout" >&2
  exit 78
fi
if [[ -z "$(printenv GITHUB_WORKSPACE || true)" ]]; then
  echo "Missing GitHub workspace" >&2
  exit 78
fi

compose() {
  docker compose -f docker-compose.yml -f docker-compose.panda.yml \
    -f docker-compose.smoke.yml --env-file .env "$@"
}

migration="$GITHUB_WORKSPACE/supabase/migrations/20261016_ozon_fbo_supply_automation.sql"
if [[ ! -s "$migration" ]]; then
  echo "Expected repository migration absent" >&2
  exit 1
fi
found=$(find "$GITHUB_WORKSPACE/supabase/migrations" -maxdepth 1 -name '*.sql' -type f | wc -l)
if (( found < 80 )); then
  echo "Unexpectedly small migration chain" >&2
  exit 1
fi
existing=$(compose exec -T db psql -U postgres -d postgres -Aqt -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.ozon_fbo_replenishment_runs') IS NOT NULL;")
if [[ "$existing" != "f" ]]; then
  echo "Expected a fresh database without the original custom table" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
# --single-transaction protects against partially applied schema changes.
if compose exec -T db psql -U postgres -d postgres --single-transaction \
  -v ON_ERROR_STOP=1 -f /dev/stdin < "$migration" > "$tmpdir/output" 2> "$tmpdir/error"; then
  echo "Unexpected: first migration succeeded on missing base schema" >&2
  exit 1
fi
if ! grep -q 'relation "public.ozon_fbo_replenishment_runs" does not exist' "$tmpdir/error"; then
  echo "Migration failed for an unexpected reason; review isolated log privately" >&2
  exit 1
fi
after=$(compose exec -T db psql -U postgres -d postgres -Aqt -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.ozon_fbo_supply_runs') IS NULL;")
if [[ "$after" != "t" ]]; then
  echo "Migration rehearsal left partial schema changes" >&2
  exit 1
fi
echo "PASS: repository migrations are incomplete without an initial schema snapshot; failed rehearsal rolled back"
