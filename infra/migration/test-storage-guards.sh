#!/usr/bin/env bash
# Fake rclone: validate migration safety without a real S3 transfer.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == "true" && "$(id -u)" == "0" ]] || exit 78
repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/rclone.conf" <<'CONF'
[platform]
type = s3
endpoint = https://zlkluzcjppefelgwihyz.supabase.co/storage/v1/s3
[self-hosted]
type = s3
endpoint = http://127.0.0.1:8000/storage/v1/s3
CONF
chmod 600 "$tmp/rclone.conf"
cat > "$tmp/bin/rclone" <<'MOCK'
#!/usr/bin/env bash
set -e
case "$1 $2" in
  "config show")
    case "$3" in
      platform) printf 'endpoint = https://zlkluzcjppefelgwihyz.supabase.co/storage/v1/s3\n' ;;
      self-hosted) printf 'endpoint = http://127.0.0.1:8000/storage/v1/s3\n' ;;
      *) exit 1 ;;
    esac ;;
  "lsf self-hosted:"*) [[ "${PANDA_TEST_DEST_NOT_EMPTY:-}" != "yes" ]] ||
      printf 'some-private-file.png\n' ;;
  "lsf platform:"*) printf 'synthetic-image.png\n' ;;
  "copy "*) echo copy >> "$PANDA_TEST_CALLS" ;;
  "check "*) echo check >> "$PANDA_TEST_CALLS" ;;
  *) echo "Unexpected rclone command" >&2; exit 1 ;;
esac
MOCK
chmod 700 "$tmp/bin/rclone"
export PATH="$tmp/bin:$PATH"
export RCLONE_CONFIG="$tmp/rclone.conf"
export PANDA_SOURCE_REMOTE=platform
export PANDA_TARGET_REMOTE=self-hosted
export PANDA_SCHEDULER_DISABLED=YES
export PANDA_TEST_CALLS="$tmp/calls"
script="$repo/infra/migration/copy-verify-private-storage.sh"

assert_blocked() {
  rm -f "$PANDA_TEST_CALLS"
  local status=0
  bash "$script" >"$tmp/out" 2>"$tmp/err" || status=$?
  [[ "$status" -eq 78 && ! -e "$PANDA_TEST_CALLS" ]] || {
    echo "Unsafe S3 migration was not blocked" >&2; exit 1;
  }
}
unset PANDA_TARGET_DISPOSABLE
assert_blocked
export PANDA_TARGET_DISPOSABLE=CONFIRMED_EMPTY_TEST_DATABASE
export PANDA_TEST_DEST_NOT_EMPTY=yes
assert_blocked
unset PANDA_TEST_DEST_NOT_EMPTY
bash "$script" >"$tmp/out" 2>"$tmp/err"
[[ "$(grep -c '^copy$' "$PANDA_TEST_CALLS")" -eq 3 ]] || exit 1
[[ "$(grep -c '^check$' "$PANDA_TEST_CALLS")" -eq 3 ]] || exit 1
echo "PASS: private bucket migration blocks unsafe destinations and verifies all three buckets"
