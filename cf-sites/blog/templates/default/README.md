# Default 主题

现代化博客主题，深色导航栏 + 白色内容区域，响应式多列布局，适合技术博客和内容站点。

## 预览

- **Header**：毛玻璃吸顶导航栏，Logo + 导航 + 社交链接 + 移动端汉堡菜单
- **首页 Hero**：暗色渐变（或自定义背景图），支持统计数字、精选推荐
- **文章卡片**：多列网格布局（1/2/3 列响应式），支持封面图、无图占位符、hover 动效
- **集合页 Hero**：封面图 + 渐变遮罩，或纯色渐变兜底
- **分页**：图标 + 文字按钮，圆角现代风
- **Footer**：品牌 + 导航 + 社交 + 版权双栏布局

## 文件结构

```
default/
├── layouts/
│   └── base.html              # HTML 骨架（head + body）
├── partials/
│   ├── header.html            # 站点头部（含移动端抽屉菜单）
│   ├── footer.html            # 站点底部（双栏布局）
│   ├── pagination.html        # 分页组件（图标按钮）
│   ├── post-card.html         # 文章卡片（封面图 + 无图兜底）
│   ├── sidebar.html           # 侧边栏
│   ├── seo-head.html          # OG/Twitter/Article meta
│   └── schema.html            # JSON-LD 结构化数据
├── home.html                  # 首页模板
├── post.html                  # 文章详情
├── page.html                  # 静态页面（支持 6 种布局）
├── collection.html            # 合集/博客列表
├── category.html              # 分类列表
├── tag.html                   # 标签列表
└── author.html                # 作者页面
```

## 可配置项

此主题的所有外观和行为均可通过站点 `config.json` 配置，无需修改模板代码。

### 首页配置 (`home`)

控制首页 Hero 区域和各板块的显示。

```json
{
  "home": {
    "title": "欢迎来到我的博客",
    "subtitle": "分享技术与生活",
    "heroImage": "/site-assets/hero-bg.jpg",
    "showCategories": true,
    "showTags": true,
    "showStats": true
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | `site.name` | Hero 区大标题 |
| `subtitle` | string | `site.description` | Hero 区副标题 |
| `heroImage` | string | 无（纯色渐变） | Hero 背景图 URL，设置后叠加半透明渐变 |
| `showCategories` | boolean | `true` | 是否显示"分类浏览"板块 |
| `showTags` | boolean | `true` | 是否显示"热门标签"板块 |
| `showStats` | boolean | `true` | 是否在 Hero 区显示文章/分类/标签统计数字 |

### 博客配置 (`blog`)

控制博客列表页和文章展示方式。

```json
{
  "blog": {
    "title": "技术博客",
    "description": "记录开发中的所见所想",
    "coverImage": "/site-assets/blog-cover.jpg",
    "postsLayout": "grid",
    "featuredCount": 3,
    "showFeatured": true
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | string | Collection name 或 `"Blog"` | 博客列表页标题（Hero 区和 SEO title） |
| `description` | string | Collection description | 博客列表页描述 |
| `coverImage` | string | 无 | 博客列表页 Hero 封面图 |
| `postsLayout` | `"grid"` \| `"list"` | `"grid"` | 文章布局模式，影响博客列表、分类、标签页 |
| `featuredCount` | number | `3` | 首页"精选推荐"显示文章数量 |
| `showFeatured` | boolean | `true` | 是否在首页显示精选推荐区 |

**布局模式说明**：
- `"grid"`：多列网格（手机 1 列、平板 2 列、桌面 3 列），卡片纵向排列
- `"list"`：单列列表，卡片横向排列（左图右文），适合阅读型博客

### 默认图片 (`defaults`)

为没有设置图片的内容提供兜底图片，避免空白区域。

```json
{
  "defaults": {
    "post": "/site-assets/default-post.jpg",
    "category": "/site-assets/default-category.jpg",
    "tag": "/site-assets/default-tag.jpg",
    "collection": "/site-assets/default-collection.jpg",
    "author": "/site-assets/default-avatar.jpg"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `post` | string | 文章没有 `coverImage` 时的默认封面图 |
| `category` | string | 分类没有 `featuredImage` 时的默认封面 |
| `tag` | string | 标签没有 `featuredImage` 时的默认封面 |
| `collection` | string | 集合没有 `coverImage` 时的默认封面 |
| `author` | string | 作者没有 `avatar` 时的默认头像 |

**图片优先级**（以文章卡片为例）：
1. 文章自身的 `coverImage` — 最高
2. `defaults.post` — 默认兜底图
3. 渐变占位符 + SVG 图标 — 无任何图片时

### 路由配置 (`routes`)

```json
{
  "routes": {
    "blog": "blog",
    "post": "",
    "category": "category",
    "tag": "tag",
    "author": "author"
  }
}
```

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `blog` | `"blog"` | 博客列表 URL 前缀 → `/blog` |
| `post` | `"blog"` | 文章 URL 前缀 → `/blog/:slug`；设为 `""` 则 → `/:slug` |
| `category` | `"category"` | 分类页前缀 |
| `tag` | `"tag"` | 标签页前缀 |
| `author` | `"author"` | 作者页前缀 |

> **推荐**：设置 `"post": ""` 可以让文章直接通过 `/{slug}` 访问，更短更友好。

### SEO 配置 (`seo`)

```json
{
  "seo": {
    "titleSeparator": " - ",
    "defaultOgImage": "/site-assets/og-default.jpg",
    "twitterHandle": "@mysite",
    "googleVerification": "xxx",
    "bingVerification": "xxx",
    "robotsExtra": "Disallow: /private/"
  }
}
```

| 字段 | 说明 |
|------|------|
| `titleSeparator` | 页面标题分隔符（如 `"文章标题 - 站点名"` 中的 `" - "`） |
| `defaultOgImage` | 没有封面图时的默认 OG 社交分享图 |
| `twitterHandle` | Twitter `@handle` |
| `googleVerification` | Google Search Console 验证码 |
| `bingVerification` | Bing Webmaster 验证码 |
| `robotsExtra` | 追加到 `robots.txt` 的额外规则 |

**SEO 自动行为**：
- 分类/标签/集合页的封面图会自动设为该页面的 OG 分享图
- 分页第 2 页及以后自动添加 `noindex`
- 文章自动生成 `article:published_time`、`article:author` 等 meta
- JSON-LD 自动生成 WebSite、BlogPosting、BreadcrumbList、Organization schema

## 色彩体系

主题通过 Tailwind CSS `@theme` 定义语义化颜色变量：

| 变量 | 色值 | 用途 |
|------|------|------|
| `--color-primary` | `#4361ee` | 主色调（链接、按钮、渐变） |
| `--color-primary-dark` | `#3a0ca3` | 主色调深色（悬停态） |
| `--color-primary-light` | `#6b82f7` | 主色调浅色 |
| `--color-surface` | `#f8fafc` | 页面背景色 |
| `--color-surface-raised` | `#ffffff` | 卡片/浮层背景 |
| `--color-heading` | `#0f172a` | 标题文字 |
| `--color-text` | `#334155` | 正文文字 |
| `--color-text-muted` | `#64748b` | 辅助文字 |
| `--color-text-faint` | `#94a3b8` | 弱化文字 |
| `--color-border` | `#e2e8f0` | 分隔线、卡片边框 |
| `--color-border-light` | `#f1f5f9` | 浅色分隔线 |
| `--color-tag-bg/text` | 紫色系 | 标签徽章 |
| `--color-cat-bg/text` | 蓝色系 | 分类徽章 |
| `--color-nav-bg` | `#0f172a` | 导航栏/Footer 背景 |

## 响应式断点

| 断点 | 宽度 | 文章网格列数 |
|------|------|-------------|
| 手机 | < 640px | 1 列 |
| 平板 | 640px+ | 2 列 |
| 桌面 | 1024px+ | 3 列 |

移动端优化：
- 汉堡菜单 + 抽屉式导航
- Hero 区字号自适应缩小
- 卡片图片比例自适应
- 分类网格 2 列 → 4 列

## 页面布局支持

| 布局 | 支持 | 特色 |
|------|------|------|
| `default` | ✅ | 标准容器 + prose 排版 |
| `full_width` | ✅ | 全宽，适合落地页 |
| `wide` | ✅ | 宽幅容器（max-w-6xl） |
| `withheader` | ✅ | Hero 横幅（支持 featuredImage 背景图） |
| `sidebar` | ✅ | 双栏（内容 + sidebar partial） |
| `blank` | ✅ | 纯 HTML，无 header/footer |

## 添加新主题时参考

基于此主题创建新主题：

1. 复制 `templates/default/` 到 `templates/{新主题名}/`
2. 创建 `src/styles/{新主题名}.css`
3. 在 `package.json` 添加 `build:css:{新主题名}` 脚本
4. 修改模板 HTML 和 CSS 样式
5. 运行 `npm run build` 重新编译
