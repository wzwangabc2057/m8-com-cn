# 定时发布 Cron Worker

每天 **8:00 UTC** 调用 CMS 的「定时发布」接口，按各站点在 Settings → 定时发布 中配置的「每日自动发布篇数」，将草稿按更新时间从早到晚顺序改为已发布。

## 配置环境

与写作同步 Cron 共用同一套 CMS URL 和密钥即可：

- `CMS_URL`: CMS 站点地址，如 `https://cloudflare-sites-cms.pages.dev`
- `CRON_SECRET`: 与 CMS 环境变量 `CRON_SECRET` 一致

**方式一：用项目根目录 .env（推荐）**

在项目根目录的 `.env` 中设置 `CMS_URL` 和 `CRON_SECRET`，然后执行：

```bash
./scripts/configure-cron-publish.sh
```

**方式二：手动写入 secret**

```bash
cd cron-publish
npx wrangler secret put CMS_URL    # 按提示输入
npx wrangler secret put CRON_SECRET
```

**方式三：本地开发用 .dev.vars**

```bash
cp cron-publish/.dev.vars.example cron-publish/.dev.vars
# 编辑 .dev.vars 填入真实值
```

## 部署

在项目根目录执行：

```bash
npm run deploy:cron-publish
```

或进入目录部署：

```bash
cd cron-publish
npm install
npm run deploy
```

## 手动触发

```bash
curl -X POST "https://<scheduled-publish-cron-worker>.<account>.workers.dev/trigger" \
  -H "X-Cron-Secret: <CRON_SECRET>"
```

或直接调 CMS：

```bash
curl "https://<cms>/api/cron/scheduled-publish" \
  -H "X-Cron-Secret: <CRON_SECRET>"
```

## CMS 配置

在 **Settings → 定时发布** 中设置「每日自动发布篇数」，默认 10。设为 0 的站点不会参与本次定时发布。
