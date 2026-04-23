# Minimal 主题

极简风格博客主题，专注内容阅读体验。窄幅排版、大量留白、无多余装饰。

## 设计理念

- **阅读优先** — 窄幅容器（max-w-2xl / 672px），行宽适合长文阅读
- **极简排版** — 无背景色差异，纯白底 + 灰色文字
- **轻量交互** — 细微的悬停变色，无阴影和动画
- **无干扰** — 简洁导航，只保留核心元素

## 文件结构

```
minimal/
├── layouts/
│   └── base.html              # HTML 骨架
├── partials/
│   ├── header.html            # 简约头部（站名 + 导航）
│   ├── footer.html            # 简约底部（版权 + 社交链接）
│   ├── pagination.html        # 分页
│   ├── post-card.html         # 文章条目（紧凑列表式）
│   └── sidebar.html           # 侧边栏
├── home.html                  # 首页
├── post.html                  # 文章详情
├── page.html                  # 静态页面（支持 6 种布局）
├── collection.html            # 合集列表
├── category.html              # 分类列表
├── tag.html                   # 标签列表
└── author.html                # 作者页面
```

## 视觉风格

### 色彩

此主题不定义自定义 CSS 变量，直接使用 Tailwind 默认色阶：

| 元素 | 颜色 |
|------|------|
| 标题 | `text-gray-900` |
| 正文 | `text-gray-600` |
| 辅助文字 | `text-gray-400` / `text-gray-500` |
| 链接 | `text-gray-900`，悬停 `text-blue-600` |
| 分隔线 | `border-gray-200` |
| 标签 | `bg-gray-100` / `text-gray-600` |

### 排版

| 元素 | 样式 |
|------|------|
| 内容容器 | `max-w-2xl mx-auto px-4 py-12` |
| 文章标题 | `text-2xl font-bold` |
| 文章日期 | `text-sm text-gray-400` |
| 正文 | `prose prose-gray`（Tailwind Typography 插件） |

## Header 特点

```html
<header class="max-w-2xl mx-auto px-4 pt-8 pb-4 border-b border-gray-200">
  <a href="/">站名</a>
  <nav>导航链接</nav>
</header>
```

- 无背景色，与内容区域同宽
- 底部细线分隔
- 支持 `logo`、`logoText`、社交链接等配置
- 支持 `customHtml: true` 覆盖

## Footer 特点

```html
<footer class="max-w-2xl mx-auto text-center text-sm text-gray-400">
  社交链接 + 版权
</footer>
```

- 居中对齐
- 极小字体
- 顶部细线分隔

## 文章卡片风格

与 default 主题的卡片式不同，minimal 主题使用**列表式**展示：

```html
<article class="py-4">
  <h3>文章标题</h3>        <!-- 链接式 -->
  <div>日期 · 分类</div>    <!-- 灰色小字 -->
  <p>摘要</p>              <!-- 可选 -->
</article>
```

- 无卡片边框和阴影
- 紧凑排列
- 标题链接悬停变蓝

## 页面布局支持

| 布局 | 支持 | 特色 |
|------|------|------|
| `default` | ✅ | 窄幅容器（max-w-2xl） |
| `full_width` | ✅ | 全宽 |
| `wide` | ✅ | 宽容器（max-w-4xl） |
| `withheader` | ✅ | 带图片/标题 header + 窄幅内容 |
| `sidebar` | ❌ | 不含 sidebar partial |
| `blank` | ✅ | 纯 HTML |

> **注意：** minimal 主题没有默认 sidebar 内容，使用 `sidebar` 布局时侧边栏为空。如需侧边栏，请通过自定义 partial 或使用 default 主题。

## 适合场景

- 个人博客
- 技术笔记
- 写作平台
- 简约风产品博客

## 与 default 主题的区别

| 对比 | Default | Minimal |
|------|---------|---------|
| 容器宽度 | 896px (max-w-4xl) | 672px (max-w-2xl) |
| Header 风格 | 深色背景吸顶 | 无背景、底线分隔 |
| 文章展示 | 卡片式（阴影、圆角） | 列表式（紧凑） |
| 色彩体系 | 自定义 CSS 变量 | Tailwind 默认色阶 |
| 视觉复杂度 | 中等 | 极简 |
| 适合场景 | 技术博客、内容站 | 个人博客、笔记 |
