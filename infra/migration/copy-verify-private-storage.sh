#!/usr/bin/env bash
# Copy the three private Panda buckets through S3 and compare every byte.
# Source is READ ONLY. Destination must be an EMPTY protected test instance.
set -Eeuo pipefail
umask 077
die() { echo "STORAGE COPY BLOCKED: $*" >&2; exit 78; }
[[ "$(id -u)" == "0" ]] || die "Run on protected test host as root"
[[ "${PANDA_TARGET_DISPOSABLE:-}" == "CONFIRMED_EMPTY_TEST_DATABASE" ]] ||
  die "Protected test target not approved"
[[ "${PANDA_SCHEDULER_DISABLED:-}" == "YES" ]] || die "Background jobs not disabled"
[[ "${RCLONE_CONFIG:-}" == /* && -s "$RCLONE_CONFIG" && ! -L "$RCLONE_CONFIG" ]] ||
  die "Protected rclone configuration required"
[[ "$(stat -c %a "$RCLONE_CONFIG")" == "600" ]] ||
  die "rclone configuration must be mode 0600"
for t in rclone grep stat; do command -v "$t" >/dev/null || die "Missing $t"; done

# Names must match dedicated remotes created for this migration only.
# Never use a destination remote that points to the production platform.
[[ "${PANDA_SOURCE_REMOTE:-}" == "platform" &&
   "${PANDA_TARGET_REMOTE:-}" == "self-hosted" ]] ||
  die "Expected two distinct remotes: platform -> self-hosted"
rclone config show platform | grep -q 'zlkluzcjppefelgwihyz' ||
  die "Source is not the expected Panda Supabase project"
rclone config show self-hosted | grep -Eiq 'endpoint[[:space:]]*=[[:space:]]*http://(127[.]0[.]0[.]1|localhost):8000/storage/v1/s3' ||
  die "Destination must be the LOCAL test Supabase gateway on port 8000"

buckets=(avatars ved-commercial-offers ved-product-photos)
for bucket in "${buckets[@]}"; do
  rclone lsf "platform:$bucket" --recursive --files-only >/dev/null ||
    die "Cannot read source bucket: $bucket"
  rclone lsf "self-hosted:$bucket" --recursive --files-only >/dev/null ||
    die "Destination bucket does not exist: $bucket"
  # Refuse destination rows/files that could be overwritten.
  [[ -z "$(rclone lsf "self-hosted:$bucket" --recursive --files-only)" ]] ||
    die "Destination bucket already has files: $bucket"
done

for bucket in "${buckets[@]}"; do
  rclone copy "platform:$bucket" "self-hosted:$bucket" \
    --transfers 4 --checkers 8 --quiet ||
    die "Copy failed for $bucket"
  # Hash-free S3 sources require downloading both sides to verify bytes.
  # With 44 small current objects this is worthwhile.
  rclone check "platform:$bucket" "self-hosted:$bucket" --download --quiet ||
    die "Byte-for-byte comparison failed for $bucket"
  echo "PASS: $bucket copied and contents verified"
done
echo "PASS: all private Panda Storage buckets verified; real site links still require checking"
