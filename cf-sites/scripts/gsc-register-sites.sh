#!/usr/bin/env zsh
# Register GSC unverified sites: get token from Google, add TXT to CF, verify.
# Requires in cms/.dev.vars: CF_API_TOKEN, GSC_SERVICE_ACCOUNT_JSON
# Usage: ./scripts/gsc-register-sites.sh [--dry-run]

set -e
SCRIPT_DIR="${0:A:h}"
ROOT="${SCRIPT_DIR:A:h}"
CMS_VARS="${ROOT}/cms/.dev.vars"

if [[ ! -f "$CMS_VARS" ]]; then
  echo "Missing $CMS_VARS (need CF_API_TOKEN and GSC_SERVICE_ACCOUNT_JSON)"
  exit 1
fi

source "$CMS_VARS" 2>/dev/null || true
export CF_API_TOKEN
export GSC_SERVICE_ACCOUNT_JSON

if [[ -z "$CF_API_TOKEN" ]]; then
  echo "CF_API_TOKEN not set in $CMS_VARS"
  exit 1
fi
if [[ -z "$GSC_SERVICE_ACCOUNT_JSON" ]]; then
  GSC_JSON_FILE="${ROOT}/cms/config/poised-lens-472416-d2-c0a6b8bf1d7d.json"
  if [[ -f "$GSC_JSON_FILE" ]]; then
    export GSC_SERVICE_ACCOUNT_JSON="$(cat "$GSC_JSON_FILE")"
  fi
fi
if [[ -z "$GSC_SERVICE_ACCOUNT_JSON" ]]; then
  echo "GSC_SERVICE_ACCOUNT_JSON not set in $CMS_VARS and no cms/config/*.json found"
  exit 1
fi

cd "$ROOT"
npx tsx scripts/gsc-register-sites.ts "$@"
