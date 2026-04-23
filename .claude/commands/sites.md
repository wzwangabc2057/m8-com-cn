---
description: CF Sites 站点管理 — 查看所有站点、连接、配置、批量操作
---

统一管理所有 CF Sites 部署站点。查看状态、导入 Writing Bro、编辑配置、管理域名和分类。

## 输入

$ARGUMENTS — 可选：
- 空：仪表盘，所有站点概览
- `{siteId}`：单站详情
- `--link {siteId}`：将 CF Sites 站点导入 Writing Bro
- `--config {siteId}`：交互式编辑站点配置
- `--domains {siteId}`：管理域名绑定
- `--meta {siteId}`：管理分类/标签/作者
- `--rename {siteId} {newId}`：重命名站点
- `--rebuild {siteId}`：重建 D1 索引
- `--assets {siteId}`：查看资源文件
- `--disabled`：只看已禁用站点
- `--unlinked`：只看未连接 Writing Bro 的站点
- `--bulk-rebuild`：批量重建所有活跃站点
- `--analytics {siteId}`：查看站点流量（默认 7 天）

## 公共

### API 配置

所有模式共享：

```
cf_cms_url: "https://cloudflare-sites-cms.pages.dev"
cf_token: 从 sites/coinalx-com/.env 读取 CF_CMS_TOKEN
```

请求头：`Authorization: Bearer {cf_token}`

### 连接状态判定

读取所有 `sites/*/config.md`，提取 `cf_site_id` 字段，与 API 返回的 siteId 对比：
- 匹配 → 已连接，显示对应本地路径
- 无匹配 → 未连接

## 流程

### 模式 A：仪表盘（无参数）

#### A1：获取所有站点

```bash
GET {cf_cms_url}/api/sites
```

#### A2：判定连接状态

Glob `sites/*/config.md`，读取每个 config.md 的 `cf_site_id`，建立 siteId → 本地路径映射。

#### A3：分组展示

```
CF Sites 站点仪表盘（N 站）

已连接 Writing Bro（X 站）：
  ● coinalx          CoinALX          en    coinalx.com

未连接 — 活跃（Y 站）：
  ○ m8.com.cn         跨市场资讯        zh    m8.com.cn
  ○ petloving.me      宠爱食刻          zh    petloving.me
  ...

已禁用（Z 站）：
  ✕ ai-ball.xyz       AI-Ball          vi    —
  ...

提示: /sites {siteId} 查看详情 | /sites --link {siteId} 导入站点
```

#### A4：交互

用 AskUserQuestion 询问下一步：
- 选择一个站点查看详情
- 导入某个站点
- 批量操作

### 模式 B：单站详情（`/sites {siteId}`）

#### B1：并行获取数据

同时调用：
- `GET /api/config?siteId={id}` — 站点配置
- `GET /api/meta/count?siteId={id}` — 文章/页面数
- `GET /api/posts?siteId={id}&limit=5` — 最近文章
- `GET /api/sites/{id}/domains` — 域名列表

#### B2：展示

```
站点: {siteId}（{name}）
状态: 活跃/禁用 | 语言: {language} | 主题: {theme}
域名: {domains 或 "未绑定"}
Writing Bro: 已连接 → sites/{slug} / 未连接

内容: {posts} 文章, {pages} 页面
分类: {categories} | 标签: {tags} | 作者: {authors}

最近文章:
  1. {title} ({status})
  2. ...

导航: {nav items 或 "未设置"}
SEO: {seo config 摘要}

操作: --config / --domains / --meta / --rebuild / --assets / --link
```

#### B3：交互

AskUserQuestion 选择操作。

### 模式 C：连接站点（`/sites --link {siteId}`）

将已有 CF Sites 站点导入 Writing Bro。**Link 后自动执行 init-site 流程**，生成完整的 persona、searcher、知识库。

#### C1：获取站点信息

并行调用：
- `GET /api/config?siteId={id}` — 配置
- `GET /api/meta?siteId={id}&withCounts=true` — 分类/标签/作者
- `GET /api/posts?siteId={id}&limit=100` — 文章列表

#### C2：确认导入

AskUserQuestion：
- 展示站点信息（名称、描述、语言、域名、文章数）
- 确认本地 slug（默认 domain 转 slug，如 `m8-com-cn`）

#### C3：创建基础连接

```
sites/{slug}/
├── config.md          # 从 CF Sites 配置生成（见 C4）
└── .env               # CF_CMS_TOKEN
```

#### C4：生成 config.md

从 CF Sites 配置提取字段，生成标准 Writing Bro config.md 格式：

```yaml
---
language: {从 config.language}
default_words: 3000
quality_threshold: 80
domain: {从 domains[0] 或 siteId}
created: {今天日期}
author_name: "{从 meta.authors[0] 或 config.name}"
author_bio_short: "{从 config.description 截取}"
---
{从 config.description}

## CF Sites 发布配置
cf_cms_url: "https://cloudflare-sites-cms.pages.dev"
cf_site_id: "{siteId}"
cf_auto_publish: true
```

#### C5：执行 init-site 流程

在已创建的 config.md 基础上，执行 `/init-site` 的 Step 2-6：

1. **抓取首页**：用 WebFetch 访问站点 URL（从 config.siteBaseUrl 或 domain 推断），提取：
   - 站点定位和风格
   - 已有内容结构（导航、分类）
   - 文风和写作特点

2. **生成 Persona**（`author/persona.md`）：
   - 基于首页内容推断作者身份、专业领域、写作风格
   - 生成 identity + belief + voice + boundaries + samples
   - AskUserQuestion 让用户确认 persona 草案

3. **生成 Searcher**（`searcher.md`）：
   - 从站点定位推断目标读者
   - 生成完整 searcher persona（identity, needs, judgment, patience, behavior）
   - AskUserQuestion 让用户确认

4. **初始化知识库**：
   - `author/wiki/INDEX.md`
   - `author/wiki/voice.md`、`strengths.md`、`improvements.md`
   - `content/INDEX.md`
   - `content/knowledge/INDEX.md`

5. **创建 raw/ 目录结构**（sources/、research/、feedback/）

6. **同步已有内容**：对 CF Sites 上的每篇 post：
   - 创建 `content/{cluster-or-general}/{slug}/{slug}.md`
   - Frontmatter 标记 `status: completed`，`source: cf-sites-import`
   - 正文保留 HTML（不转 markdown，避免信息丢失）
   - 更新 `content/INDEX.md`

7. **更新 CLAUDE.md**：将 `active_site:` 指向新站点

#### C6：输出

```
✓ 已连接 {siteId} → sites/{slug}
✓ Persona 已生成（待确认）
✓ Searcher 已生成（待确认）
✓ 已同步 N 篇已有文章
✓ active_site 已更新

下一步: /plan-site 规划内容 | /write "主题" 开始写作
```

展示创建结果，提示下一步。

### 模式 D：站点配置（`/sites --config {siteId}`）

#### D1：获取当前配置

```bash
GET /api/config?siteId={id}
```

#### D2：选择配置区域

AskUserQuestion 展示可编辑区域（每个带当前值预览）：

| 区域 | 包含字段 |
|------|---------|
| 基本信息 | name, displayName, description, language |
| 导航 | nav[] |
| Header | logo, logoText, showNav, sticky |
| Footer | copyright, links[], social[] |
| 首页 | title, subtitle, heroImage, showCategories |
| 博客 | title, postsLayout, featuredCount |
| SEO | googleVerification, titleSeparator, defaultOgImage |
| 路由 | routes (blog, post, category, tag, author) |
| 主题 | theme |

#### D3：交互编辑

对所选区域：
1. 展示当前值
2. AskUserQuestion 或直接让用户在 Other 中输入新值
3. 支持批量修改（JSON 格式输入）

#### D4：推送更新

```bash
PUT /api/config?siteId={id}
Content-Type: application/json

{修改的字段}
```

#### D5：同步本地

如本地有对应 `config.md`，同步更新相关字段。

### 模式 E：域名管理（`/sites --domains {siteId}`）

#### E1：获取域名

```bash
GET /api/sites/{id}/domains
```

#### E2：展示和操作

展示当前绑定域名。

AskUserQuestion 选择：
- **绑定新域名**：输入域名 → `POST /api/sites/{id}/domains {"domain": "..."}`
- **解绑域名**：选择要解绑的 → `DELETE /api/sites/{id}/domains {"domain": "..."}`
- **完成**

注意：域名必须已添加到 Cloudflare 账户，否则绑定会失败。

### 模式 F：Meta 管理（`/sites --meta {siteId}`）

#### F1：获取当前 meta

```bash
GET /api/meta?siteId={id}&withCounts=true
```

#### F2：展示

```
分类 (N):
  tech (Technology) — 25 文章
  science — 10 文章

标签 (M):
  coding — 15 文章
  ai — 8 文章

作者 (K):
  admin (Admin) — 42 文章
```

#### F3：交互操作

AskUserQuestion 选择操作类型：
- 添加分类/标签/作者
- 编辑已有分类/标签/作者
- 清理空分类（`POST /api/meta/categories-cleanup`）

#### F4：推送

```bash
POST /api/meta?siteId={id}
Content-Type: application/json

{
  "categories": [...],
  "tags": [...],
  "authors": [...]
}
```

### 模式 G：重命名（`/sites --rename {siteId} {newId}`）

```bash
POST /api/sites/{id}/rename
Content-Type: application/json

{"newSiteId": "{newId}"}
```

同步更新本地 config.md 的 `cf_site_id`（如有）。

### 模式 H：重建索引（`/sites --rebuild {siteId}`）

```bash
POST /api/rebuild?siteId={id}
```

展示结果：scanned、indexed、errors。

### 模式 I：资源管理（`/sites --assets {siteId}`）

#### I1：列出资源

```bash
GET /api/assets?siteId={id}
```

展示列表（文件名、大小、上传时间）。

#### I2：操作

AskUserQuestion：
- 上传新资源（指定本地文件路径）
- 删除资源（选择文件）
- 返回

### 模式 J：批量重建（`/sites --bulk-rebuild`）

#### J1：获取站点列表

`GET /api/sites`，过滤 `disabled: false`。

#### J2：确认

展示活跃站点列表和数量，AskUserQuestion 确认开始。

#### J3：执行

依次对每个活跃站点调用 `POST /api/rebuild?siteId={id}`。

展示进度和结果：
```
✓ coinalx — 5 scanned, 5 indexed
✓ m8.com.cn — 12 scanned, 11 indexed, 1 error
✗ ai-football.news — 失败: timeout
...
完成: 35/36 | 总计: 420 scanned, 415 indexed
```

### 模式 K：流量（`/sites --analytics {siteId}`）

```bash
GET /api/analytics?siteId={id}&range=7d
```

展示每日访问量和浏览量。

### 模式 L：筛选列表（`--disabled` / `--unlinked`）

`--disabled`：获取所有站点，过滤 `disabled: true`，展示列表。
`--unlinked`：获取所有站点 + 本地 config.md，展示没有本地连接的活跃站点。

## 错误处理

- **API 401**：提示检查 .env 中的 CF_CMS_TOKEN
- **站点不存在**：提示检查 siteId
- **域名绑定失败**：提示域名需先添加到 Cloudflare 账户
- **网络错误**：提示稍后重试

## 输出

根据模式输出对应结果，末尾提示可用操作。
