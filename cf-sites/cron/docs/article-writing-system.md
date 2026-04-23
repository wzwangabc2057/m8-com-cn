| 文档类型     | 地址                                                      |
|-------------|-----------------------------------------------------------|
| Swagger UI   | https://web-production-0084b.up.railway.app/docs         |
| ReDoc        | https://web-production-0084b.up.railway.app/redoc        |
| OpenAPI JSON | https://web-production-0084b.up.railway.app/openapi.json |

## Generate 接口（生成文章）

`POST /api/v1/generate` 提交一篇生成任务。请求体除 `project_id`、`title`、`topic`、`keyword`、`language`、`word_count`、`options` 外，**支持可选参数 `meta`**，用于预填 SEO/元数据，供生成与结果回填使用：

- **meta**（可选）：`{ title?: string; description?: string; keywords?: string[]; category?: string; author?: string }`
  - **category**：分类 slug，同步时若站点不存在该 slug 会新建分类并指定。
  - **author**：作者 id，同步时若站点不存在该 id 会新建作者并指定。
  - 与顶层 `title` 等可同时存在；结果中 `job.result.metadata.meta` 会回填这些字段，CMS 同步时据此直接指定帖子的分类与作者（可新建）。

完整请求/响应以 Swagger、ReDoc、OpenAPI JSON 为准。

## 写作任务同步

Cron Worker 定期调用 CMS `POST /api/cron/sync-writing-tasks` 执行同步。

**CMS 需配置**（.dev.vars 或 Secrets）：
- `ARTICLE_WRITING_API_KEY` 或 `ARTICLE_WRITING_SYSTEM_API_TOKEN`
- `CRON_SECRET`

**Cron Worker 需配置**（.dev.vars 或 Secrets）：
- `CMS_URL`：CMS 部署地址
- `CRON_SECRET`：与 CMS 一致

**首次部署**：执行 D1 迁移创建 `writing_sync` 表：
```bash
wrangler d1 execute cloudflare-sites-db --remote --file=cron/migrations/0001_writing_sync.sql
```

文档功能：
- 详细的 API 描述和快速开始指南
- 按功能分组（Generate, Projects, Analyze, Health）
- 交互式测试界面（Swagger UI 支持直接发送请求）
- 认证说明（X-API-Key header）
- 请求/响应示例