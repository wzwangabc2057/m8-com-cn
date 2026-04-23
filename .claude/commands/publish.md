---
description: 将文章发布到 CF Sites CMS，写完即上线
---

将 Writing Bro 的文章推送到 CF Sites CMS，实现即时上线。

## 输入

$ARGUMENTS — 必填，文章 slug。

可选：
- `--draft`：发布为草稿（默认直接 published）
- `--force`：强制覆盖已有文章

## 流程

### Step 0：加载配置

1. 读取 CLAUDE.md → `{site}`
2. 读取 `{site}/config.md` → 提取：
   - `cf_cms_url` — CMS API 地址
   - `cf_site_id` — CF Sites 中的 siteId
   - `author_name`、`author_bio_short`
   - `domain`
3. 读取 `{site}/.env` → 提取 `CF_CMS_TOKEN`
4. 验证三个配置都存在，缺任何一个则报错并提示配置方法

### Step 1：读取文章

1. Glob `content/**/{slug}/{slug}.md` 找到文章
2. 读取文章，解析 frontmatter 和正文
3. 提取：
   - `seo_title` / `seo_description`
   - `cluster`
   - `target_keywords`
   - `status`（只发布 status: completed 的文章，除非 `--force`）
   - `type`（trending / evergreen）
   - `created` / `updated`

### Step 2：转换格式

#### 2.1 Markdown → HTML

将文章正文（跳过 frontmatter）转换为 HTML：
- 使用 `marked` 库或简单的正则转换
- 处理顺序**必须**：**先图片 `![...](...)` 再链接 `[...](...)`**，否则图片语法会被错误匹配为链接
- 处理标题、段落、列表、加粗、图片、链接
- 保留 `[[slug]]` wiki-link（CF Sites 不解析这些，但保留作为原文标记）
- 所有本地图片路径已在上传步骤替换为 `/site-assets/...` 路径
- **从正文中移除 hero 图**：如果设置了 `coverImage`（通常是第一张图/hero 图），CF Sites 模板会自动渲染为文章头图，正文里再出现一次就会重复。转换 HTML 后删除正文中与 coverImage 相同的那张图片（含其 figure/figcaption 标签和图片来源说明）

#### 2.2 构建 post JSON

映射关系：

| Writing Bro | CF Sites |
|-------------|----------|
| H1 标题 | `title` |
| slug | `slug` |
| HTML body | `content` |
| seo_title | `seo.title` |
| seo_description | `seo.description` |
| cluster | `categories[0]`（用 display name，如 "Market Structure"） |
| target_keywords | `tags[]` |
| author_name | `author` |
| hero.jpg 的本地路径 | 先上传到 `/api/assets`，得到 `publicUrl`，设为 `coverImage` |
| created | `publishedAt` |
| `--draft` ? | `status: "draft"` : `status: "published"` |

#### 2.3 Cluster → Category 映射

默认映射表（可在 config.md 中覆盖）：

| cluster slug | category display name |
|-------------|---------------------|
| market-structure | Market Structure |
| geopolitical-risk | Geopolitical Risk |
| macro-crypto | Macro & Crypto |
| bitcoin-cycle | Bitcoin Cycle |
| on-chain-analysis | On-Chain Analysis |
| regulation-policy | Regulation & Policy |
| defi-risk | DeFi Risk |
| ethereum-ecosystem | Ethereum Ecosystem |
| stablecoin-systemic | Stablecoin & Systemic Risk |
| tokenomics | Tokenomics |
| narrative-cycles | Narrative Cycles |
| prediction-markets | Prediction Markets |

### Step 3：上传所有配图

扫描文章中引用的所有本地图片文件（正则匹配 `![...](filename)` 中的本地文件名），逐个上传：

1. **收集图片列表**：从文章目录中找所有被引用的图片文件（.jpg, .jpeg, .png, .webp, .svg, .gif）
2. **逐个上传**：每个文件调用 `POST /api/assets?siteId={siteId}` 上传，拿到 `publicUrl`
3. **替换引用**：在转换为 HTML 的过程中，将所有本地文件名替换为对应的 `publicUrl`
4. **设置 coverImage**：
   - 优先用 `hero.jpg` / `hero.webp` 的 publicUrl
   - 没有则用文章中第一张图片的 publicUrl
   - 都没有则不设 coverImage

**所有图片类型都要上传**：Stock 照片、SVG 插图、数据图表，无一例外。CF Sites 不会自动下载本地路径的图片。

上传结果记录映射表供 Step 4 使用：
```
本地文件名 → publicUrl
hero.jpg → /site-assets/2026/04/hero.jpg
flowchart.svg → /site-assets/2026/04/flowchart.svg
```

### Step 4：发布到 CF Sites

调用 API：

```bash
POST {cf_cms_url}/api/posts?siteId={siteId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "...",
  "slug": "...",
  "content": "<html>",
  "coverImage": "/site-assets/...",
  "author": "CoinALX",
  "categories": ["Market Structure"],
  "tags": ["keyword1", "keyword2"],
  "status": "published",
  "publishedAt": "2026-04-19T00:00:00Z",
  "seo": {
    "title": "...",
    "description": "..."
  }
}
```

这是 **upsert** 操作（slug 已存在则覆盖），所以 `/write` 更新文章后再发布也是安全的。

### Step 5：确认发布

- 检查 API 返回 `success: true`
- 调用 `GET /api/posts/{slug}?siteId={siteId}` 确认文章已存在
- 生成文章 URL：`{blog_domain}/{slug}`（如果 `routes.post` 为空则是 `/{slug}`）

### Step 6：更新 frontmatter

在文章的 frontmatter 中增加：
```yaml
published_url: "https://{domain}/{slug}"
published_at: "2026-04-19T12:00:00Z"
```

### Step 7：输出

```
✓ 已发布到 CF Sites
  URL: https://{domain}/{slug}
  Status: published
  Cover: /site-assets/2026/04/hero.jpg
  Categories: Market Structure
  Tags: keyword1, keyword2
```

## 错误处理

- **配置缺失**：缺少 cf_cms_url / cf_site_id / CF_CMS_TOKEN → 提示配置方法
- **文章未完成**：status 不是 completed → 提示用 `--force` 或先完成文章
- **API 401**：token 无效 → 提示检查 .env 中的 CF_CMS_TOKEN
- **API 404**：siteId 不存在 → 提示先创建站点（`POST /api/sites`）
- **网络错误**：CF Sites 不可达 → 文章保存在本地，可稍后 `/publish slug` 重试
