#!/usr/bin/env zsh
# Test writing sync flow with dryRun (no writes to R2/D1)
#
# Mode 1 - Test against deployed CMS (requires dryRun in deployed code):
#   CRON_SECRET=xxx ./scripts/test-sync-dry-run.sh
#
# Mode 2 - Test locally (run CMS with pages:dev, then curl):
#   CRON_SECRET=xxx ./scripts/test-sync-dry-run.sh local
#   Requires: cms/.dev.vars with CRON_SECRET, ARTICLE_WRITING_SYSTEM_API_TOKEN

set -e
MODE="${1:-remote}"
CMS_URL="${2:-https://cloudflare-sites-cms.pages.dev}"
CRON_SECRET="${CRON_SECRET}"

if [[ -z "$CRON_SECRET" ]]; then
  echo "Error: CRON_SECRET required."
  echo "Usage: CRON_SECRET=xxx ./scripts/test-sync-dry-run.sh [local|remote] [CMS_URL]"
  exit 1
fi

if [[ "$MODE" == "local" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  echo "Building CMS..."
  (cd "$ROOT/cms" && npm run pages:build)
  echo "Starting CMS (pages:dev on port 8788)..."
  (cd "$ROOT/cms" && npx wrangler pages dev .vercel/output/static --port 8788 --compatibility-flag=nodejs_compat) &
  PID=$!
  for i in {1..60}; do
    sleep 1
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8788/" 2>/dev/null || echo "000")
    [[ "$CODE" =~ ^(200|304)$ ]] && break
  done
  CMS_URL="http://localhost:8788"
  trap "kill $PID 2>/dev/null; exit" EXIT INT TERM
fi

echo "Testing sync (dryRun) at $CMS_URL ..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "${CMS_URL}/api/cron/sync-writing-tasks?dryRun=true" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "FAIL: Expected 200"
  exit 1
fi

if echo "$BODY" | jq -e '.dryRun == true' >/dev/null 2>&1; then
  echo ""
  echo "OK: Sync dry-run completed (no data written)"
else
  echo ""
  echo "OK: Sync completed (dryRun not in response - may be older deployment)"
fi
