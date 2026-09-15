#!/usr/bin/env bash
# Deploy Firestore rules/indexes to staging only.
# Storage rules live in croww-admin. Functions must be invoked with the same
# explicit --project flag after billing is enabled.
set -euo pipefail

TARGET="${1:-}"
if [[ "${TARGET}" != "croww-staging-2026" ]]; then
  echo "Usage: $0 croww-staging-2026" >&2
  echo "Refusing to guess the Firebase project. Production is not accepted." >&2
  exit 1
fi

if [[ "${TARGET}" == "croww-live-2026" ]]; then
  echo "Refusing production deploy." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

echo "=== Deploying Firestore rules + indexes to ${TARGET} ==="
firebase deploy --only firestore:rules,firestore:indexes --project "${TARGET}" --non-interactive

echo
echo "Storage: cd ../croww-admin && firebase deploy --only storage --project ${TARGET} --non-interactive"
echo "Functions: firebase deploy --only functions --project ${TARGET} --non-interactive"
echo "Do not omit --project. Do not target croww-live-2026 from this script."
