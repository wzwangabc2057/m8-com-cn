#!/usr/bin/env zsh
# Add GSC verification TXT to Cloudflare DNS for all sites.
# Usage: ./scripts/gsc-dns-verify.sh "google-site-verification=xxxxxxxx"
# CF token is read from cms/.dev.vars (CF_API_TOKEN).

set -e
SCRIPT_DIR="${0:A:h}"
ROOT="${SCRIPT_DIR:A:h}"
CMS_VARS="${ROOT}/cms/.dev.vars"
VERIFICATION_TXT="${1:?Usage: $0 \"google-site-verification=xxxx\"\"}"

if [[ ! -f "$CMS_VARS" ]]; then
  echo "Missing $CMS_VARS (need CF_API_TOKEN)"
  exit 1
fi

# Load CF_API_TOKEN from cms/.dev.vars (no export of other vars)
source "$CMS_VARS" 2>/dev/null || true
export CF_API_TOKEN
export GSC_VERIFICATION_TXT="$VERIFICATION_TXT"

if [[ -z "$CF_API_TOKEN" ]]; then
  echo "CF_API_TOKEN not set in $CMS_VARS"
  exit 1
fi

cd "$ROOT"
npx tsx scripts/gsc-dns-verify.ts
