#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
release="${1:?usage: set_release_version.sh release-YYYYMMDD}"

if [[ ! "${release}" =~ ^release-[0-9]{8}$ ]]; then
  printf 'invalid release version: %s\n' "${release}" >&2
  exit 2
fi

printf '%s\n' "${release}" >"${repo_root}/deploy/release-version.txt"

values_path="${repo_root}/deploy/environments/oilan/values.yaml"
temporary_path="$(mktemp "${values_path}.tmp.XXXXXX")"
trap 'rm -f "${temporary_path}"' EXIT
awk -v release="${release}" '
  /^imageTag: / && !updated {
    if ($0 ~ /&releaseTag/) {
      print "imageTag: &releaseTag " release
    } else {
      print "imageTag: " release
    }
    updated = 1
    next
  }
  { print }
' "${values_path}" >"${temporary_path}"
mv "${temporary_path}" "${values_path}"
trap - EXIT

printf 'release version set to %s\n' "${release}"
