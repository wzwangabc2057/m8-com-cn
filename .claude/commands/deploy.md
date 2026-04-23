---
description: 部署 CF Sites CMS 到 Cloudflare — 创建资源、更新配置、一键部署
---

将 CF Sites CMS 部署到你的 Cloudflare 账户。全自动：创建基础设施资源 → 更新配置 → 按序部署 → 验证。

## 输入

$ARGUMENTS — 可选：
- 空：交互式全新部署
- `--skip-create`：跳过资源创建（已部署过，只需重新部署代码）
- `--skip-deploy`：只创建资源，不部署（先创建资源，稍后手动部署）

## 前置条件

- Node.js 18+
- Wrangler CLI（`npm install -g wrangler`）
- Cloudflare 账户

## 流程

### Step 1：认证检查

```bash
wrangler whoami
```

如果未认证，提示用户运行：

```
请在终端执行: wrangler login
认证完成后继续。
```

用 AskUserQuestion 确认认证完成。

### Step 2：收集配置

用 AskUserQuestion 收集：

- **CMS API Key**：用于保护管理接口（自定义一个强随机字符串，或让系统生成）
- **是否部署 Store**：电商前端（可选，大部分站点不需要）
- **是否部署 Cron**：定时任务（可选，定时发布和写作同步）

### Step 3：创建 Cloudflare 资源

如参数含 `--skip-create`，跳过此步。

按顺序创建，记录每个命令输出的 ID：

**3.1 D1 数据库**

```bash
wrangler d1 create cloudflare-sites-db
```

记录输出中的 `database_id`。

**3.2 R2 存储桶**

```bash
wrangler r2 bucket create blog-content
```

**3.3 KV 命名空间**

```bash
wrangler kv namespace create CACHE
```

记录输出中的 `id`。

**3.4 Queue**

```bash
wrangler queues create storefront-events
```

**3.5 初始化 D1 Schema**

```bash
wrangler d1 execute cloudflare-sites-db --remote --file=shared/schema.sql
```

如果 `shared/` 下有额外的 migration 文件，也依次执行：

```bash
wrangler d1 execute cloudflare-sites-db --remote --file=shared/migrations/001_platform_settings.sql
wrangler d1 execute cloudflare-sites-db --remote --file=shared/migrations/002_page_custom_assets.sql
```

### Step 4：更新配置文件

用 Edit 工具更新各 `wrangler.toml` 中的资源 ID：

| 文件 | 需要更新的字段 |
|------|--------------|
| `cf-sites/blog/wrangler.toml` | `d1_databases.database_id`, `r2_buckets.bucket_name`, `kv_namespaces.id` |
| `cf-sites/cms/wrangler.toml` | `d1_databases.database_id`, `r2_buckets.bucket_name` |
| `cf-sites/store/wrangler.toml` | `kv_namespaces.id` |
| `cf-sites/workers/edge-services/wrangler.toml` | `kv_namespaces.id` |

### Step 5：设置 API Key

```bash
cd cf-sites/cms && echo "{api_key}" | wrangler secret put API_KEY
```

API Key 同时写入 `cf-sites/.env`（供脚本使用）和全局共享。

### Step 6：安装依赖

```bash
cd cf-sites && npm install
```

### Step 7：部署

如参数含 `--skip-deploy`，跳过此步。

按以下顺序部署（顺序很重要，有依赖关系）：

**7.1 Edge Services**（Durable Objects + Queue Consumer）

```bash
cd cf-sites && npm run deploy:edge-services
```

**7.2 Blog**（博客引擎，CF Pages）

```bash
npm run deploy:blog
```

**7.3 Router**（请求路由，可选 — 仅多域名时需要）

```bash
npm run deploy:router
```

**7.4 CMS**（管理后台，CF Pages）

```bash
npm run deploy:cms
```

**7.5 可选服务**（如果 Step 2 用户选择了）：

```bash
# 电商前端（可选）
npm run deploy:store

# 定时任务（可选）
npm run deploy:cron
npm run deploy:cron-publish
```

每步执行后检查退出码，失败则停止并提示。

### Step 8：验证

**8.1 测试 CMS API**

```bash
curl -s -H "Authorization: Bearer {api_key}" \
  https://cloudflare-sites-cms.pages.dev/api/sites
```

应返回 `[]`（空站点列表，因为还没创建站点）。

**8.2 测试博客前端**

```bash
curl -s -o /dev/null -w "%{http_code}" https://cloudflare-sites-bth.pages.dev
```

应返回 200 或 301。

### Step 9：更新 Router 域名映射

如果部署了 Router，更新其环境变量指向实际部署的 blog 和 store URL：

```bash
cd cf-sites/workers/router
wrangler secret put BLOG_ORIGIN   # 输入 blog 的 pages.dev URL
wrangler secret put STORE_ORIGIN  # 输入 store 的 pages.dev URL（如部署了）
```

### Step 10：记录部署信息

将部署信息写入项目级文件，供 `/create-site` 和 `/sites` 读取：

**更新 `cf-sites/.env`：**

```bash
CLOUDFLARE_ACCOUNT_ID={从 wrangler whoami 获取}
CLOUDFLARE_API_TOKEN={如用 token 认证}
CRON_SECRET={自定义}

# 部署产出（自动记录）
CMS_URL=https://cloudflare-sites-cms.pages.dev
BLOG_URL=https://cloudflare-sites-bth.pages.dev
ROUTER_URL=https://site-router.{subdomain}.workers.dev
API_KEY={api_key}
```

### Step 11：输出

```
✓ CF Sites CMS 已部署到你的 Cloudflare 账户

基础设施:
  D1: cloudflare-sites-db ({database_id})
  R2: blog-content
  KV: CACHE ({kv_id})
  Queue: storefront-events

部署服务:
  ✓ Edge Services — cloudflare-edge-services
  ✓ Blog Engine — {blog_url}
  ✓ CMS Admin — {cms_url}
  ✓ Router — {router_url}（可选）

API Key: {api_key}
  → 已设置为 CMS Worker secret
  → 也是 Writing Bro 的 CF_CMS_TOKEN

下一步:
  /create-site          — 创建你的第一个站点
  /sites                — 管理已有站点

提示:
  - 如果需要绑定自定义域名，先在 Cloudflare Dashboard 添加域名
  - 然后 /sites --domains {siteId} 绑定
```

## 增量部署（`--skip-create`）

已部署过的账户，代码更新后重新部署：

```bash
cd cf-sites
npm install                 # 更新依赖
npm run deploy:edge-services
npm run deploy:blog
npm run deploy:cms          # 不需要每次都部署 router/store/cron
```

`/deploy --skip-create` 自动执行以上步骤。

## 错误处理

- **`wrangler whoami` 失败**：提示 `wrangler login` 认证
- **资源已存在**：提示资源名冲突，建议检查是否重复部署，或使用 `--skip-create`
- **D1 创建失败**：可能是账户权限问题，提示检查 Cloudflare plan
- **Pages 部署超时**：首次部署较慢，等待后重试
- **API Key 设置失败**：提示手动执行 `wrangler secret put API_KEY`
- **npm install 失败**：检查 Node.js 版本（需要 18+）

## 与其他命令的关系

| 命令 | 关系 |
|------|------|
| `/deploy` | 部署 CMS 基础设施（一次性，或代码更新时重新部署） |
| `/create-site` | 在已部署的 CMS 上创建站点（依赖 `/deploy`） |
| `/init-site` | 初始化站点内容系统（依赖 `/create-site`） |
| `/sites` | 管理已部署的站点（依赖 `/deploy`） |
| `/publish` | 发布文章（依赖 `/deploy`） |
