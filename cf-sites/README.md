# Cloudflare Sites CMS

多站点内容管理系统，运行在 Cloudflare 边缘（Workers + Pages + R2 + D1 + KV）。

## 架构

```
cloudflare-sites/
├── blog/           # Handlebars 博客引擎（CF Pages）
├── store/          # Next.js 电商前端（CF Pages，可选）
├── cms/            # Next.js CMS 管理后台（CF Pages）
├── workers/        # 边缘基础设施（Router + Durable Objects + Queue）
├── cron/           # 定时任务
├── shared/         # 共享资源（数据库 schema、设计 token）
└── scripts/        # 部署和运维脚本
```

## 新账户部署指南

### 前置条件

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（`npm install -g wrangler`）
- Cloudflare 账户

### Step 1：认证

```bash
# 方式 A：交互式登录（推荐）
wrangler login

# 方式 B：API Token（适合 CI/CD）
# 在 Cloudflare Dashboard → My Profile → API Tokens 创建
# 权限需要：Workers Scripts (Edit), D1 (Edit), R2 (Edit), KV (Edit), Pages (Edit)
```

### Step 2：创建 Cloudflare 资源

在新账户下，需要先创建 wrangler.toml 中引用的基础设施资源：

```bash
# 创建 D1 数据库
wrangler d1 create cloudflare-sites-db
# 记下输出的 database_id

# 创建 R2 存储桶
wrangler r2 bucket create blog-content

# 创建 KV 命名空间
wrangler kv namespace create CACHE
# 记下输出的 id

# 创建 Queue
wrangler queues create storefront-events
```

### Step 3：更新配置文件

将 Step 2 中创建的资源 ID 替换到对应的 `wrangler.toml`：

| 文件 | 需要更新的字段 |
|------|--------------|
| `cms/wrangler.toml` | `d1_databases.database_id`, `r2_buckets.bucket_name` |
| `workers/edge-services/wrangler.toml` | `kv_namespaces.id`, `queues.consumers.queue` |

### Step 4：配置环境变量

```bash
# 复制模板
cp .env.example .env

# 编辑填入你的值
# CLOUDFLARE_ACCOUNT_ID — Dashboard 首页右侧可见
# CLOUDFLARE_API_TOKEN — Step 1 创建的 Token
# CRON_SECRET — 自定义一个随机字符串
```

### Step 5：设置 CMS API Key

CMS 需要一个 API Key 来保护管理接口。部署后设置：

```bash
cd cms
wrangler secret put API_KEY
# 输入一个强随机字符串，这就是 Writing Bro 的 CF_CMS_TOKEN
```

### Step 6：安装依赖并部署

```bash
# 安装依赖
npm install

# 按顺序部署（deploy.sh 会自动加载 .env）
npm run deploy
```

部署顺序很重要：
1. `workers/edge-services` — 边缘服务（Durable Objects、Queue Consumer）
2. `blog` — 博客引擎
3. `store` — 电商前端（可选，不需要可跳过）
4. `workers/router` — 请求路由
5. `cms` — CMS 管理后台

### Step 7：验证

部署完成后会得到以下 URL：
- **CMS**: `https://cloudflare-sites-cms.pages.dev`（管理后台 + API）
- **Blog**: `https://cloudflare-sites-blog.pages.dev`（博客前端）
- **Router**: `https://cloudflare-sites-router.你的子域.workers.dev`

测试 API 连通性：

```bash
curl -H "Authorization: Bearer 你的API_KEY" \
  https://cloudflare-sites-cms.pages.dev/api/sites
```

### Step 8：在 Writing Bro 中配置

将 CMS URL 和 API Key 写入站点配置：

```bash
# sites/{your-site}/.env
CF_CMS_TOKEN=Step5中设置的API_KEY
```

```yaml
# sites/{your-site}/config.md
cf_cms_url: "https://cloudflare-sites-cms.pages.dev"
cf_site_id: "your-site-id"
cf_auto_publish: true
```

然后通过 `/sites` 命令创建站点、绑定域名、开始写作。

## 本地开发

```bash
# 安装依赖
npm install

# 分别启动各服务
cd cms && npm run dev      # CMS 管理后台
cd blog && npm run dev     # 博客前端
cd store && npm run dev    # 电商前端（可选）
```

## 绑定自定义域名

在 CMS 管理后台或通过 `/sites --domains` 命令绑定。域名必须已添加到 Cloudflare Dashboard。

## 不使用 CF Sites

Writing Bro 的写作管线完全独立运行，不使用 CF Sites 也可以。文章保存在本地 `sites/` 目录，你可以用其他方式发布。

## 许可

MIT
