# Writing Bro 架构文档

> 基于 Claude Code 的 SEO 写作系统。三层架构：编排 → 执行 → 能力。
>
> 相关文档：[[INDEX|文档首页]] · [[GETTING-STARTED|快速开始]] · [[COMMANDS|命令速查]] · [[CONCEPTS|核心概念]] · [[CONFIG-REFERENCE|配置参考]]

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│  用户层（.claude/commands/）                              │
│  /create-site  /init-site  /sites  /plan-site           │
│  /plan-trending  /list  /write  /write-batch            │
│  /publish  /rewrite  /evaluate  /ask  /compile-wiki     │
│  /lint  /evolve                                         │
│                                                          │
│  用户只跟这些交互。/write 是核心入口。                      │
└────────────┬────────────────────────────────────────────┘
             │ 调度
             ▼
┌─────────────────────────────────────────────────────────┐
│  执行层（.claude/agents/）                                │
│  analyzer   researcher   drafter   illustrator         │
│  evaluator                                              │
│                                                          │
│  子代理在隔离上下文中运行，只加载需要的知识。                 │
└────────────┬────────────────────────────────────────────┘
             │ 预加载
             ▼
┌─────────────────────────────────────────────────────────┐
│  能力层（.claude/skills/）                                │
│  illustration   link-builder   seo                      │
│                                                          │
│  user-invocable: false，被子代理预加载，用户不可见。         │
└─────────────────────────────────────────────────────────┘
```

## 目录结构

```
writing_bro/
├── CLAUDE.md                              # 项目入口配置
├── docs/                                  # 架构文档
│   └── ARCHITECTURE.md                    # 本文件
│
├── sites/                                 # 每个站点 = 完整写作系统
│   └── {site}/
│       ├── config.md                      # 站点配置
│       ├── .env                           # API tokens（不进 git）
│       ├── author/
│       │   ├── persona.md                 # 作者身份（身份/信念/声音/边界）
│       │   └── wiki/                      # 作者知识库（LLM 维护）
│       │       ├── INDEX.md
│       │       ├── voice.md               # 声音模式
│       │       ├── strengths.md           # 擅长什么
│       │       ├── improvements.md        # 改进历史
│       │       └── patterns/              # 高分可复用模式
│       │           ├── openings.md
│       │           ├── hooks.md
│       │           └── closings.md
│       ├── searcher.md                    # 目标搜索者 Persona
│       ├── content/                       # 内容知识库 = 文章 = 可发布内容
│       │   ├── INDEX.md                   # 站点全景图
│       │   ├── knowledge/                # 全局知识库（按主题，跨 cluster）
│       │   │   ├── INDEX.md              # 主题索引 + cluster 关联
│       │   │   └── {topic}.md            # 数据源、事实、框架
│       │   └── {cluster}/
│       │       ├── INDEX.md               # Cluster 索引
│       │       └── {entry}/               # 每篇文章一个目录
│       │           ├── {slug}.md         # 文章正文（文件名 = slug）
│       │           ├── hero.jpg           # 配图（同目录）
│       │           └── ...
│       └── raw/                           # 原始素材（待编译）
│           ├── sources/
│           ├── research/
│           └── feedback/
│
└── .claude/
    ├── commands/                          # Skills — 用户入口
    │   ├── create-site.md                 # 从零建站（CF Sites）
    │   ├── init-site.md                   # 导入已有站点
    │   ├── sites.md                       # CF Sites 站点管理
    │   ├── plan-site.md
    │   ├── plan-trending.md
    │   ├── list.md
    │   ├── write.md                       # 核心编排器
    │   ├── write-batch.md                 # 批量写作
    │   ├── publish.md                     # CF Sites 发布
    │   ├── rewrite.md
    │   ├── evaluate.md
    │   ├── ask.md
    │   ├── compile-wiki.md
    │   ├── lint.md
    │   └── evolve.md
    │
    ├── agents/                            # Sub-agents — 子代理
    │   ├── analyzer.md                    # SERP + 搜索意图分析（Searcher）
    │   ├── researcher.md                  # 调研收集素材（Author）
    │   ├── drafter.md                     # 撰写文章（Author）
    │   └── evaluator.md                   # 评估 + 反馈（Searcher）
    │
    └── skills/                            # 专业能力 — 被子代理预加载
        ├── illustration/SKILL.md          # 配图（Stock + SVG + Chart）
        ├── link-builder/SKILL.md          # 内外链
        └── seo/SKILL.md                   # SEO 元数据
```

## 三层关系

### 用户层 → 执行层

Skills 通过 Agent 工具调度子代理。子代理在隔离上下文中运行，结果返回主对话。

```
/write（skill，主对话中运行）
  │
  │  读取 config.md、content/INDEX.md，确定任务
  │
  ├─ Agent: analyzer        ← 传入 searcher 路径 + target_keywords
  │   └─ 返回: SERP 分析 + 内容缺口
  │
  │  主上下文：基于分析制定策略（轻量，留在主上下文）
  │
  ├─ Agent: researcher      ← 传入策略 + wiki 路径
  │   └─ 返回: 调研素材 + ref_ids
  │
  │  主上下文：整理素材，准备写作
  │
  ├─ Agent: drafter         ← 传入 persona + wiki + 素材 + searcher
  │   └─ 预加载 skills: [illustration, link-builder, seo]
  │   └─ 返回: 完整文章（含配图、链接、SEO 元数据）
  │
  ├─ Agent: evaluator       ← 传入 searcher + 文章
  │   └─ 返回: 评估分数 + 反馈
  │   └─ 如 <80 分，主上下文修改后重新评估（≤3 轮）
  │
  └─ 主上下文：更新文件 + 反思沉淀到 raw/
```

### 执行层 → 能力层

子代理通过 `skills:` frontmatter 预加载专业能力：

| 子代理 | 预加载 Skills | 运行时读取 |
|--------|-------------|-----------|
| analyzer | — | searcher.md, config.md, content/INDEX.md |
| researcher | — | author/wiki/, content/（避免重复研究） |
| drafter | link-builder, seo | author/persona.md, author/wiki/, content/（内链）, searcher.md |
| illustrator | illustration | 文章路径 + IMAGE 占位符 |
| evaluator | — | searcher.md, author/wiki/patterns/ |

### 运行时注入

Persona 和知识库是每个站点不同的，通过运行时读取注入：

```
子代理 prompt 示例（drafter）：

---
name: drafter
skills: [illustration, link-builder, seo]
---
你是 Author。

1. 先读取 {persona_path}，理解你的身份和声音
2. 读取 {wiki_path}/INDEX.md，了解你过去的经验和模式
3. 基于以下素材和策略撰写文章：
   {strategy}
   {materials}
   {existing_entries}
4. 使用预加载的 illustration、link-builder、seo 能力完成配图、链接和 SEO
```

编排器（`/write`）在生成子代理时替换 `{persona_path}` 等占位符为实际路径。

## 知识飞轮

```
                    ┌──────────────────────────────┐
                    │   知识库（持久化）              │
                    │                              │
                    │  author/wiki/                │
                    │  写作经验、高分模式             │
                    │                              │
                    │  content/knowledge/          │
                    │  领域知识（按主题，跨 cluster） │
                    │  数据源、事实、框架             │
                    │                              │
                    │  content/{cluster}/           │
                    │  已发布文章                    │
                    └─────┬──────────┬────────┬────┘
                          │          │        │
                  写作经验 │   领域知识 │        │ 写作后沉淀
                          ▼          ▼        │
                    ┌──────────────────────┐   │
                    │      /write 管线      │───┘
                    │  researcher 读+写知识  │
                    └──────────────────────┘
                          │
                    产出文章 + metrics + 知识更新
                          │
                          ▼
                    ┌──────────────┐
                    │   raw/       │
                    │   反馈、评分  │
                    └──────┬───────┘
                           │
                    /compile-wiki 编译
                           │
                           ▼
                    wiki 更新 → 下次写作更好
```

### 进化机制

| 操作 | 触发 | 做什么 |
|------|------|--------|
| `/write` | 每次 | 自动将经验沉淀到 `raw/feedback/` |
| `/compile-wiki` | 按需 | 编译 `raw/` → 更新 `author/wiki/` 和 `content/` |
| `/lint` | 周度 | 检查知识库健康（backlinks、孤立条目、过时内容） |
| `/evolve` | 月度 | 分析 metrics 趋势 → 改进 persona、agents、skills |

## 内容条目格式

每个 `content/` 下的 .md 文件，分为 evergreen 和 trending 两种类型：

### Evergreen 条目

```markdown
# 标题

---
status: planned | completed
priority: P0 | P1 | P2
cluster: cluster-slug
target_keywords: [keyword1, keyword2]
estimated_words: 3000
actual_words: 3021
created: 2024-04-15
updated: 2024-04-15
last_reviewed: 2024-04-15
score: 87
revision_rounds: 1
seo_title: "..."
seo_description: "..."
corrections:
  - date: 2024-05-01
    description: "修正了 X 数据点，原文为 Y，实际为 Z"
---

## 规划笔记

（planned 时填写，completed 后保留作为策略记录）

## 正文

（completed 时有，含 `[[slug]]` 内链和 `[^ref_id]` 引用）

## 相关条目

- 引用: [[entry-a]], [[entry-b]]
- 被引用于: [[entry-c]]
- 所属 cluster: [[cluster-slug]]

## 来源

- 调研: raw/research/YYYY-MM-DD-slug.md
- 最后更新: YYYY-MM-DD
```

### Trending 条目

```markdown
# 标题

---
status: planned | completed | expired
type: trending
cluster: cluster-slug
linked_pillar: pillar-slug
target_keywords: [keyword1, keyword2]
estimated_words: 2500
time_sensitivity: days | weeks | months
window_expires: YYYY-MM-DD
actual_words: 2487
created: 2024-04-15
updated: 2024-04-15
score: 82
seo_title: "..."
seo_description: "..."
---

## 规划笔记

**Hook**: 为什么这件事比表面看起来更重要
**Angle**: CoinALX 的差异化视角
**Evergreen link**: [[pillar-slug]]

## 正文

## 相关条目

- 引用: [[pillar-slug]], [[evergreen-entry]]
- 被引用于: [[other-trending]]
- 所属 cluster: [[cluster-slug]]

## 来源

- 调研: raw/research/trending-scan-YYYY-MM-DD.md
- 最后更新: YYYY-MM-DD
```

### 双轨策略

Trending 文章通过 `linked_pillar` 链接到 evergreen pillar，形成内容飞轮：

```
热点事件 → trending 文章 → evergreen pillar → 整个 cluster
              ↑                              |
              └── 搜索流量 ──────────────────┘
```

## Wiki-Link 约定

- 格式：`[[slug]]`，如 `[[keyword-research]]`
- 解析：`Glob("content/**/slug/slug.md")`
- Backlinks 维护：
  - `/write` — 实时更新被引用条目的 backlinks
  - `/compile-wiki` — 全量重建所有 backlinks

## 双角色体系

| 角色 | 加载什么 | 何时 |
|------|---------|------|
| **Author** | persona.md + author/wiki/ | drafter 子代理 |
| **Searcher** | searcher.md | analyzer、evaluator 子代理 |

原则：你不是在模仿，你就是这个身份。

## 配图体系

三种类型，按信息增量排序：

| 类型 | 适用场景 | 实现方式 | 质量 | 独特性 |
|------|---------|---------|------|--------|
| Stock 照片 | 氛围、视觉呼吸 | `site:unsplash.com` 搜索 | 中 | 低 |
| SVG 插图 | 流程图、概念图 | 直接生成 SVG 代码 | 中 | 高 |
| 数据图表 | 对比、趋势、分布 | TS + Chart.js/D3 → SVG/PNG | 高 | 高 |

优先选信息增量高的类型。独特图表 > SVG 插图 > Stock 照片。

配图能力由 `illustration` skill 提供，预加载到 drafter 子代理中。

## Cluster 归属规则

`/write` 创建新 entry 时按以下顺序确定 cluster：

1. Stub 已指定 → 读取 frontmatter 中的 `cluster` 字段
2. 从已有内容推断 → 搜索 content/ 中最相关的 cluster
3. 用户确认 → 以上都不确定时询问
4. 兜底 → `content/general/`

## 技术约束

### Claude Code 限制

- **子代理不能再生成子代理** — 只有一层深度
- **子代理不继承 skills** — 必须显式声明 `skills: [...]`
- **子代理隔离上下文** — 看不到主对话历史，需要传参
- **Skills 不能互相调用** — 通过文件引用或预加载变通

### 设计原则

- **编排与执行分离** — `/write` 只编排，不写内容
- **知识能力分离** — Persona 运行时读取，专业能力 skill 预加载
- **定义一次** — 每个能力只在一个文件中定义
- **KISS** — 不过度抽象，能直接做的不要拆

## CF Sites 发布

文章写完自动发布到 CF Sites CMS（Cloudflare 边缘托管），实现"写完即上线"。

### 发布配置

每个站点在 `config.md` 中配置：

```yaml
cf_cms_url: "https://cloudflare-sites-cms.pages.dev"  # CMS API 地址
cf_site_id: "coinalx"                                   # CF Sites 中的 siteId
cf_auto_publish: true                                    # /write 后自动发布
```

API token 存在站点级 `.env`（不进 git）：
```
CF_CMS_TOKEN=xxx
```

### 发布流程

`/write` Step 8.5 或 `/publish` 命令执行：

1. 文章 markdown → HTML
2. 上传配图到 `/api/assets`
3. 构建 post JSON（frontmatter 映射到 CF Sites 字段）
4. `POST /api/posts?siteId={id}` 创建/更新文章
5. 更新 frontmatter 的 `published_url`

### 字段映射

| Writing Bro | CF Sites |
|-------------|----------|
| H1 标题 | `title` |
| slug | `slug` |
| HTML body | `content` |
| seo_title | `seo.title` |
| seo_description | `seo.description` |
| cluster | `categories[0]` |
| target_keywords | `tags[]` |
| author_name | `author` |
| hero 配图 | `coverImage`（先上传到 R2） |
| created | `publishedAt` |
