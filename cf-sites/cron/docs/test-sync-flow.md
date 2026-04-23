# 写作同步流程测试

## 测试方式

### 1. 远程 dry-run（推荐，不写入数据）

部署包含 `dryRun` 的 CMS 后，执行：

```bash
CRON_SECRET=wr-sync-cron-5f8a2b1c ./scripts/test-sync-dry-run.sh
# 或指定 URL
CRON_SECRET=xxx ./scripts/test-sync-dry-run.sh remote https://cloudflare-sites-cms.pages.dev
```

`?dryRun=true` 时：不写入 R2、D1、writing_sync，仅执行完整流程并返回统计。

### 2. 远程完整同步（会写入数据）

```bash
curl -X POST "https://cloudflare-sites-cms.pages.dev/api/cron/sync-writing-tasks" \
  -H "X-Cron-Secret: wr-sync-cron-5f8a2b1c" \
  -H "Content-Type: application/json"
```

### 3. 本地 dry-run

```bash
# 确保 cms/.dev.vars 含 CRON_SECRET、ARTICLE_WRITING_SYSTEM_API_TOKEN
CRON_SECRET=wr-sync-cron-5f8a2b1c ./scripts/test-sync-dry-run.sh local
```

## 响应示例

```json
{
  "sitesProcessed": 1,
  "sitesSkipped": 3,
  "jobsSaved": 0,
  "jobsSkipped": 0,
  "jobsStopped": 0,
  "errors": [],
  "dryRun": true
}
```

- `sitesProcessed`: 成功处理的站点数
- `sitesSkipped`: 跳过（无匹配 project）
- `jobsSaved`: 新保存为草稿的文章数
- `jobsSkipped`: 跳过的 job（超时、slug 已存在等）
- `jobsStopped`: 遇到 pending/running 时停止
- `dryRun`: 为 true 表示未写入任何数据
