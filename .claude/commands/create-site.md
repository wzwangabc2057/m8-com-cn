---
description: 从零创建 CF Sites 站点 — 定位分析、品牌设计、视觉风格、页面配置，一键建站
---

从零创建一个完整的 CF Sites 站点。不涉及内容系统（persona、searcher 等），专注建站本身。

## 输入

$ARGUMENTS — 可选：
- 空：纯交互式
- 站点名称：如 `"全球美食指南"`
- 域名：如 `food-guide.com`（自动推断站点名）

## 建站要素清单

一个完整的站点需要覆盖以下要素。`/create-site` 应全部处理：

| 类别 | 要素 | CF Sites 配置字段 |
|------|------|------------------|
| **定位** | 站点定位、slogan、调性 | name, description |
| **品牌** | Logo、Favicon、作者名 | header.logo, header.logoText, favicon |
| **品牌** | 社交媒体 | site.social[] |
| **视觉** | 主题选择 | theme |
| **视觉** | 文章列表布局 | blog.postsLayout, blog.featuredCount |
| **视觉** | Header 行为 | header.sticky, header.transparent |
| **视觉** | 图片优化 | imageResizing |
| **架构** | 导航结构 | nav[] |
| **架构** | 初始分类 | POST /api/meta categories |
| **架构** | URL 结构 | routes {blog, post, category, tag} |
| **架构** | 每页文章数 | postsPerPage |
| **首页** | Hero 标题 + 副标题 | home.title, home.subtitle |
| **首页** | Hero 背景图 | home.heroImage |
| **首页** | 首页模块开关 | home.showCategories, showTags, showStats |
| **博客** | 栏目名称 | blog.title |
| **页面** | 页脚（版权、链接） | footer.copyright, footer.links[] |
| **页面** | About 页面 | CMS pages API |
| **图片** | 默认封面图 | defaults {post, category, tag, author} |
| **SEO** | 标题分隔符 | seo.titleSeparator |
| **SEO** | 搜索引擎验证 | seo.googleVerification, bingVerification |
| **多语言** | 界面标签定制 | labels {} |
| **技术** | 站点 URL（RSS 等） | url |

## 流程

### Step 1：收集基本信息

用 AskUserQuestion 收集（如果参数已提供则跳过）：

- 站点名称（如 "全球美食指南"）
- 领域描述（一段话说清站点要做什么）
- 语言（zh-CN / en / ja 等）
- 目标域名（如 `food-guide.com`，也用作 CF Sites siteId）
- 作者名（用于文章署名展示，不是 persona）

### Step 2：定位分析

基于站点名称和领域描述，用 WebSearch 研究定位：

**2.1 竞品研究**

搜索 3-5 个竞品或同领域站点，分析：
- 他们怎么定位自己（slogan、title、tagline）
- 导航结构（分了哪些栏目）
- 视觉风格（正式/轻松/专业/生活方式）
- 首页结构（hero 说什么、突出什么）
- 内容分类方式

**2.2 定位建议**

```
站点定位建议：

名称展示: {header.logoText}
一句话定位: {slogan，用于 home.subtitle}
核心差异化: 与竞品最大的不同是什么
目标读者: 一句话描述（建站层面的受众定位）
内容调性: 专业权威 / 轻松有趣 / 数据驱动 / 故事化 / ...
```

用 AskUserQuestion 展示建议，用户确认或修改。

### Step 3：全面建站方案

基于定位分析 + 竞品研究，一次性给出完整方案（不是逐项问，而是一次出方案让用户审阅）：

**3.1 品牌标识**

```
Logo 方案: 文字 Logo "{站点名称}" / 需要图片 Logo
Favicon: {建议风格描述}
作者展示名: "{author_name}"
社交媒体: {从用户信息推断或询问}
```

**3.2 视觉设计**

```
主题: default / minimal（附理由）
文章布局: grid / list
精选文章: N 篇
Header: 固定悬浮 / 普通 / 透明（hero 页）
图片优化: 开启 / 关闭（Cloudflare Image Resizing）
```

CF Sites 内置主题对比：

| 主题 | 特点 | 适合 |
|------|------|------|
| **default** | Hero 大图 + 精选网格 + 分类卡片 + 标签云 + 侧边栏 | 内容丰富、需要视觉冲击力 |
| **minimal** | 极简居中、纯文字列表、无 hero、无侧边栏 | 个人博客、深度阅读 |

**3.3 信息架构**

```
导航:
  - "首页" → /
  - "{栏目名}" → /blog
  - "{分类1}" → /category/{slug}
  - "{分类2}" → /category/{slug}
  - "关于" → /about

初始分类: {基于领域建议 3-8 个初始分类}
URL 结构: /blog/{slug} 或 /{slug}（无前缀）
每页文章: 10 篇
博客栏目名: "文章" / "资讯" / "博客" / "指南" / ...
```

**3.4 首页**

```
Hero 标题: {不超过 60 字}
Hero 副标题: {不超过 120 字}
Hero 背景图: 需要描述风格 → 搜索 Unsplash
首页模块: 分类卡片 ON / 标签云 OFF / 统计数据 ON
```

**3.5 页面**

```
页脚版权: "© {{year}} {站点名称}"
页脚链接: 关于 / 隐私政策 / 联系我们
About 页面:
  标题: "关于{站点名称}"
  内容: {基于定位生成一段简介}
```

**3.6 默认图片**

```
文章默认封面: {基于领域推荐（如美食类用食物图、科技类用抽象图）}
分类默认封面: {同上}
作者默认头像: {风格描述}
```

**3.7 SEO 与技术**

```
标题分隔符: " - " / " | " / " · "
站点 URL: https://{domain}（用于 RSS、OG 绝对 URL）
搜索引擎验证: {提示用户后续在 Google/Bing 添加}
```

**3.8 i18n 标签**

如果语言非英语，定制所有界面标签：

```
labels:
  featured: "推荐" / "精选"
  latestPosts: "最新文章" / "最新资讯"
  readMore: "阅读全文" / "查看详情"
  browseCategories: "浏览分类"
  blog: "文章" / "资讯" / "指南"
  prevPage: "上一页"
  nextPage: "下一页"
  ...
```

**3.9 用户确认**

将以上完整方案整合展示，用 AskUserQuestion 让用户确认：

> "以上是完整的建站方案，确认？"
> - 确认，开始建站
> - 需要调整部分内容（在 Other 中说明）

### Step 4：获取 CF Sites 连接信息

1. Glob `sites/*/.env`，读取任一获取 `CF_CMS_TOKEN`
2. Glob `sites/*/config.md`，读取任一获取 `cf_cms_url`

如果找不到，AskUserQuestion 询问 CMS URL 和 API Key。

### Step 5：创建 CF Sites 站点

**5.1 创建站点**

```bash
POST {cf_cms_url}/api/sites
Authorization: Bearer {CF_CMS_TOKEN}

{
  "siteId": "{domain 或 slug}",
  "name": "{站点名称}",
  "displayName": "{站点名称}",
  "description": "{定位描述}",
  "language": "{language}",
  "theme": "{theme}"
}
```

**5.2 上传资源**

如方案中涉及图片，先上传：

```bash
# Hero 背景图（如需要）
POST /api/assets?siteId={siteId}
Content-Type: multipart/form-data
file: hero.jpg

# Favicon（如需要）
POST /api/assets?siteId={siteId}
file: favicon.ico

# 默认封面图（如需要）
POST /api/assets?siteId={siteId}
file: default-post.jpg
```

**5.3 推送完整配置**

```bash
PUT {cf_cms_url}/api/config?siteId={siteId}
Authorization: Bearer {CF_CMS_TOKEN}
Content-Type: application/json

{
  "name": "{站点名称}",
  "description": "{定位描述}",
  "language": "{language}",
  "url": "https://{domain}",
  "theme": "{theme}",
  "postsPerPage": 10,
  "imageResizing": false,
  "favicon": "{favicon_url}",

  "nav": [
    { "label": "首页", "href": "/" },
    { "label": "{栏目名}", "href": "/blog" },
    { "label": "{分类}", "href": "/category/{slug}" },
    { "label": "关于", "href": "/about" }
  ],

  "routes": {
    "blog": "blog",
    "post": "blog",
    "category": "category",
    "tag": "tag",
    "author": "author"
  },

  "social": [
    { "platform": "twitter", "url": "..." }
  ],

  "header": {
    "logo": "{logo_url}",
    "logoText": "{名称}",
    "showNav": true,
    "sticky": true
  },

  "footer": {
    "copyright": "© {{year}} {名称}",
    "links": [
      { "label": "关于", "href": "/about" },
      { "label": "隐私政策", "href": "/privacy" }
    ],
    "social": []
  },

  "home": {
    "title": "{hero 标题}",
    "subtitle": "{hero 副标题}",
    "heroImage": "{hero_image_url}",
    "showCategories": true,
    "showTags": false,
    "showStats": true
  },

  "blog": {
    "title": "{栏目名}",
    "postsLayout": "grid",
    "featuredCount": 3,
    "showFeatured": true
  },

  "defaults": {
    "post": "{default_post_image_url}",
    "category": "{default_category_image_url}",
    "author": "{default_author_avatar_url}"
  },

  "seo": {
    "titleSeparator": " - "
  },

  "labels": {
    "featured": "推荐",
    "latestPosts": "最新文章",
    "readMore": "阅读全文",
    "blog": "文章",
    ...
  }
}
```

**5.4 创建初始分类**

```bash
POST /api/meta?siteId={siteId}
Content-Type: application/json

{
  "categories": [
    { "name": "{分类1}", "slug": "{slug1}" },
    { "name": "{分类2}", "slug": "{slug2}" },
    ...
  ]
}
```

**5.5 创建 About 页面**

```bash
POST /api/pages?siteId={siteId}
Content-Type: application/json

{
  "slug": "about",
  "title": "关于{站点名称}",
  "content": "{HTML 内容}",
  "layout": "default",
  "showTitle": true
}
```

**5.6 验证**

```bash
GET {cf_cms_url}/api/config?siteId={siteId}
```

确认所有配置已生效。

### Step 6：创建本地配置

```
sites/{slug}/
├── config.md
└── .env
```

**config.md**：

```markdown
# {站点名称}

---
language: {language}
domain: {domain}
created: {今天日期}
author_name: "{author_name}"
cf_cms_url: "{cf_cms_url}"
cf_site_id: "{siteId}"
cf_auto_publish: true
---

{定位描述}
```

**.env**：

```
CF_CMS_TOKEN={token}
```

### Step 7：更新 CLAUDE.md

将 `active_site: sites/{slug}` 写入 CLAUDE.md。

### Step 8：输出

```
✓ CF Sites 站点已创建：{站点名称}

站点 ID: {siteId}
CMS: {cf_cms_url}
主题: {theme}
语言: {language}

品牌:
  Logo: {文字/图片}
  Favicon: ✓
  作者: {author_name}

首页:
  Hero: "{hero 标题}"
  副标题: "{hero 副标题}"
  背景: ✓ / 无
  模块: 分类卡片 ✓ | 标签云 ✗ | 统计 ✓

架构:
  导航: {nav items}
  分类: {initial categories}
  布局: {postsLayout}, {featuredCount} 篇精选, {postsPerPage} 篇/页
  URL: /blog/{slug}

页面:
  About: ✓
  Footer: ✓

SEO:
  分隔符: "{separator}"
  验证: 待配置

下一步（按顺序）：
  1. /sites --domains {siteId}  — 配置自定义域名
  2. /init-site https://{domain} — 初始化内容系统（persona、searcher、知识库）
  3. /plan-site                 — 规划内容体系
  4. /write "第一篇文章"         — 开始写作

提示：
  - 自定义域名需先在 Cloudflare Dashboard 添加，然后 /sites --domains 绑定
  - 域名确定后再 /init-site 完成内容系统初始化
  - Google/Bing 验证可在 /sites --config {siteId} 中后续添加
```

## 与其他命令的关系

| 命令 | 做什么 | 何时用 |
|------|--------|--------|
| `/create-site` | 定位 + 品牌 + 视觉 + 架构 + 页面 + SEO → CF Sites 建站 | 从零建站 |
| `/sites --domains` | 配置自定义域名 | `/create-site` 之后 |
| `/init-site` | persona + searcher + 知识库 | 域名确定后 |
| `/sites --link` | 导入已有 CF Sites 站点 + 自动 init | 已有站点 |
| `/sites --config` | 修改站点配置（含 Google 验证等） | 建站后微调 |

## 错误处理

- **CF Sites 不可达**：提示稍后重试或检查 CMS 部署状态
- **API Key 无效**：提示检查 `.env` 中的 `CF_CMS_TOKEN`
- **siteId 冲突**：站点已存在，建议用 `/sites --link` 导入
- **图片上传失败**：跳过图片，使用主题默认样式，后续通过 `/sites --assets` 补传
