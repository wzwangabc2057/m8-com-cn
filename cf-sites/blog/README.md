
# Cloudflare Sites

基于 **Cloudflare Pages + D1 + R2** 的高性能、低成本无头 CMS 与多站点渲染引擎。

本项目采用 **Hybrid 架构**：
*   **内容存储 (R2)**：存储文章正文 (JSON/HTML)、图片、静态资源，成本极低。
*   **索引数据库 (D1)**：存储文章元数据、标签关系、分类关系，支持实时 SQL 查询和筛选。
*   **渲染服务 (Pages Functions)**：在边缘节点动态渲染 HTML，速度极快。
*   **管理后台 (CMS)**：基于 Next.js 的可视化管理界面，支持多站点管理。

## 核心特性

- **混合存储架构** — D1 (SQL) 负责索引与筛选，R2 (Object Storage) 负责内容与大文件
- **实时一致性** — 文章发布即刻可见，告别静态生成的延迟与并发冲突
- **多站点支持** — 单次部署可服务无数个站点，数据完全隔离
- **完整 CMS** — 内置现代化管理后台，支持文章编辑、媒体库管理、站点配置
- **边缘渲染** — Cloudflare Workers 毫秒级响应，支持多主题切换
- **SEO 完备** — 自动生成 Sitemap、RSS、JSON-LD、Meta Tags
- **极低成本** — 利用 Cloudflare 免费额度，适合个人博客及中小型内容站

## 快速开始

### 1. 环境准备

确保已安装 Node.js 18+ 和 Wrangler CLI。

```bash
npm install
```

### 2. 数据库设置 (D1)

```bash
# 创建数据库
npx wrangler d1 create cloudflare-sites-db

# 将返回的 database_id 填入 wrangler.toml

# 初始化表结构
npx wrangler d1 execute cloudflare-sites-db --local --file=./schema.sql  # 本地开发
npx wrangler d1 execute cloudflare-sites-db --remote --file=./schema.sql # 生产环境
```

### 3. 本地开发

**启动主站点 (渲染服务):**
```bash
npm run dev
# 访问 http://localhost:8788
```

**启动 CMS 后台:**
```bash
cd cms
npm run dev
# 访问 http://localhost:3000
```

### 4. 部署上线

**部署主站点:**
```bash
npm run deploy
```

**部署 CMS 后台:**
```bash
cd cms
npm run pages:deploy
```

> **注意**：部署 CMS 后，请在 Cloudflare Dashboard 中为 CMS 项目绑定相同的 D1 数据库 (`DB`) 和 R2 存储桶 (`CONTENT_BUCKET`)。

## 数据重建 (Rebuild Index)

如果您的 R2 中已有数据，或者 D1 索引出现不一致，可以通过 CMS 重建索引：

1.  进入 CMS 后台 -> **Configuration**
2.  点击 **"Rebuild Index"** 按钮
3.  系统将扫描 R2 中的所有文章文件，并重新填充 D1 数据库。

## 项目结构

```
cloudflare-sites/
├── cms/                           # 管理后台 (Next.js)
│   ├── app/api/rebuild/           # 索引重建 API
│   └── lib/d1-utils.ts            # D1 写入逻辑
├── functions/                     # 渲染服务 (Pages Functions)
├── src/
│   ├── handlers/                  # 路由处理 (Home, Post, Tag...)
│   ├── services/d1-content.ts     # D1 读取逻辑 (SQL 查询)
│   └── renderer.ts                # Handlebars 渲染引擎
├── schema.sql                     # D1 数据库结构
└── wrangler.toml                  # Cloudflare 配置
```

## 数据架构 (Data Architecture)

### Posts & Pages
所有内容（文章和页面）均统一存储在 `posts/` 目录下的 JSON 文件中，并索引到 D1 `posts` 表。

*   **Posts**: `type: 'post'`，位于 `sites/{siteId}/posts/{slug}.json`
*   **Pages**: `type: 'page'`，位于 `sites/{siteId}/posts/{slug}.json`

### 字段说明
*   **layout**: 页面布局 (default, full_width, wide, withheader, sidebar, blank)
*   **showTitle**: 是否显示标题
*   **seo**: 自定义 SEO 配置 (Title, Description, Canonical, OG Image)

### 遗留数据迁移
系统包含自动迁移工具，可将旧版 R2 结构（`pages/*.html` 和 `_registry.json`）转换为标准 JSON 格式。
转换后请运行 **Rebuild Index** 以更新数据库。

## API 文档
详细的 API 使用指南请参考 [API_GUIDE.md](./API_GUIDE.md)。
或者在 CMS 中访问 `/openapi` 查看交互式文档。

