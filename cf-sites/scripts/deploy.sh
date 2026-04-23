#!/usr/bin/env bash
# Deploy all services. Loads .env from project root before running.
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
npm run deploy:edge-services && npm run deploy:blog && npm run deploy:store && npm run deploy:router && npm run deploy:cms
