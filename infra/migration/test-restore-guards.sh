#!/usr/bin/env bash
# Unit tests for RESTORE fail-closed controls. Uses fake psql/rclone ONLY.
# Never connects to any database and never copies any real file.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || { echo "CI-only guard test"; exit 78; }
[[ "$(id -u)" == "0" ]] || { echo "Guard tests require root in CI"; exit 78; }
repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
temp="$(mktemp -d)"
trap 'rm -rf -- "$temp"' EXIT
mkdir -p "$temp/bin" "$temp/dumps"
printf 'SELECT 1;\n' > "$temp/dumps/roles.sql"
printf 'CREATE TABLE public.example(id integer);\n' > "$temp/dumps/schema.sql"
printf 'COPY auth.users (id) FROM stdin;\n1\n\\.\n' > "$temp/dumps/data.sql"
printf '[panda_test]\nhost=127.0.0.1\n' > "$temp/pgservice.conf"
chmod 600 "$temp/pgservice.conf"
export PGSERVICEFILE="$temp/pgservice.conf"
export PANDA_TEST_DUMP_DIR="$temp/dumps"
export PANDA_TARGET_PGSERVICE=panda_test
export PANDA_SCHEDULER_DISABLED=YES
export PANDA_EXPECT_AUTH_USERS=3
export PANDA_EXPECT_TABLES=123

# fake psql strictly records calls, never opens a network socket
cat > "$temp/bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -e
printf '%s\n' "psql" >> "$PANDA_TEST_CALL_LOG"
if [[ "$*" == *"--single-transaction"* ]]; then
  touch "$PANDA_TEST_RESTORED"
elif [[ -f "$PANDA_TEST_RESTORED" ]]; then
  printf '123|3|0|0\n'
else
  printf '17|127.0.0.1|0|0|0|0|0\n'
fi
MOCK
chmod 700 "$temp/bin/psql"
export PATH="$temp/bin:$PATH"
export PANDA_TEST_CALL_LOG="$temp/calls"
export PANDA_TEST_RESTORED="$temp/did-restore"

assert_blocked() {
  rm -f "$PANDA_TEST_RESTORED" "$PANDA_TEST_CALL_LOG"
  local status=0
  bash "$repo/infra/migration/restore-platform-test.sh" >"$temp/out" 2>"$temp/err" || status=$?
  [[ "$status" -eq 78 ]] || {
    echo "Expected safe restore refusal (78); got $status" >&2; exit 1;
  }
  [[ ! -e "$PANDA_TEST_RESTORED" ]] || {
    echo "Blocked restore still wrote to DB" >&2; exit 1;
  }
}

unset PANDA_TARGET_DISPOSABLE
assert_blocked
export PANDA_TARGET_DISPOSABLE=CONFIRMED_EMPTY_TEST_DATABASE
printf 'SELECT cron.schedule(1,2,3);\n' >> "$temp/dumps/schema.sql"
assert_blocked
printf 'CREATE TABLE public.example(id integer);\n' > "$temp/dumps/schema.sql"
export PANDA_TARGET_PGSERVICE=invalid/target
assert_blocked
export PANDA_TARGET_PGSERVICE=panda_test

rm -f "$PANDA_TEST_RESTORED" "$PANDA_TEST_CALL_LOG"
bash "$repo/infra/migration/restore-platform-test.sh" >"$temp/out" 2>"$temp/err"
[[ -f "$PANDA_TEST_RESTORED" ]] || { echo "Safe mocked restore was not invoked" >&2; exit 1; }
echo "PASS: backup restore refuses unapproved target, cron schedules and invalid connection; valid mock passes"
