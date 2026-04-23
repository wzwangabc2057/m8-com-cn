#!/usr/bin/env bash
# 配置 scheduled-publish-cron 的环境变量（CMS_URL、CRON_SECRET）
# 用法：在项目根目录执行
#   .env 中已配置 CMS_URL、CRON_SECRET 时：  ./scripts/configure-cron-publish.sh
#  或直接传入：  CMS_URL=https://xxx CRON_SECRET=xxx ./scripts/configure-cron-publish.sh
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
if [ -z "$CMS_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "请设置 CMS_URL 和 CRON_SECRET（可放在项目根目录 .env 中）"
  echo "示例："
  echo "  CMS_URL=https://cloudflare-sites-cms.pages.dev"
  echo "  CRON_SECRET=与 CMS 后台相同的密钥"
  exit 1
fi
cd cron-publish
echo -n "$CMS_URL" | npx wrangler secret put CMS_URL
echo -n "$CRON_SECRET" | npx wrangler secret put CRON_SECRET
echo "已配置 CMS_URL 和 CRON_SECRET。"
