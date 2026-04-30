# Writing Bro

> 基于 Claude Code 的 SEO 写作系统。三层架构：编排 → 执行 → 能力。

## 核心理念

- **知识飞轮**：写作产出 → 沉淀知识 → 更好的写作
- **信任智能**：给原则不给步骤，约束底线不限制创造
- **确定性流程**：可控可预测，不是黑盒 AI
- **三位一体**：知识库 = 写作产出 = 可发布内容
- **编排与执行分离**：/write 只编排，子代理执行，skill 提供能力

## 三层架构

```
用户层（.claude/commands/）  → 用户看到的入口，/write 是核心
执行层（.claude/agents/）    → 子代理在隔离上下文中执行具体步骤
能力层（.claude/skills/）    → 专业能力被预加载到子代理，用户不可见
```

详细架构见 `docs/ARCHITECTURE.md`。

## 目录结构

```
writing_bro/
├── sites/{site}/                # 每个站点 = 完整写作系统
│   ├── config.md                # 站点配置
│   ├── author/
│   │   ├── persona.md           # 作者 Persona
│   │   └── wiki/                # 作者知识库（LLM 维护）
│   ├── searcher.md              # 目标搜索者
│   ├── content/                 # 内容知识库 = 文章 = 可发布内容
│   │   ├── INDEX.md
│   │   ├── knowledge/          # 全局知识库（按主题组织，跨 cluster 共享）
│   │   │   ├── INDEX.md        # 主题索引 + cluster 关联
│   │   │   └── {topic}.md      # 数据源、事实、框架、覆盖记录
│   │   └── {cluster}/
│   │       ├── INDEX.md
│   │       └── {entry}/         # 每篇文章一个目录
│   │           ├── {slug}.md    # 文章正文（文件名 = slug，Obsidian 图谱可识别）
│   │           ├── hero.jpg     # 配图（与文章同目录）
│   │           └── ...
│   └── raw/                     # 原始素材
│
└── .claude/
    ├── commands/                # Skills — 用户入口
    ├── agents/                  # Sub-agents — 子代理
    └── skills/                  # 专业能力 — 被子代理预加载
```

## 当前活跃站点

```
active_site: sites/your-site
```

Skills 读取此行解析活跃站点路径。`/init-site` 创建新站点时自动更新。

## config.md 格式

```markdown
# {站点名称}

---
language: zh
default_words: 3000
quality_threshold: 80
domain: example.com
created: YYYY-MM-DD
author_name: "Display Name"
author_bio_short: "1-2 句话简介，用于文章署名和 schema"
author_bio_long: "完整作者简介，用于 author page"
author_url: "https://example.com/about"
author_social:
  twitter: "handle"
  linkedin: "profile-url"
---

{站点领域描述}
```

E-E-A-T 字段用途：`/publish` 和 SEO skill 读取这些字段生成 schema author、meta author、byline。

CF Sites 发布配置（与 frontmatter 同级，在正文下方）：

```yaml
cf_cms_url: "https://your-cms.pages.dev"
cf_site_id: "your-site-id"
cf_auto_publish: true
```

API token 存在 `sites/{site}/.env`（不进 git）：`CF_CMS_TOKEN=xxx`

## Visual Style（可选 — illustration skill 使用）

在 config.md 中可添加 `visual_style` 块，控制 SVG 插图和数据图表的配色：

```yaml
visual_style:
  primary: "#hex"
  primary_dark: "#hex"
  accent: "#hex"
  bg_light: "#hex"
  bg_dark: "#hex"
  chart_palette: ["#hex", ...]  # 5-6 colors for data charts
  font_family: "system-ui, sans-serif"
```

如果 config.md 没有 `visual_style`，illustration skill 使用默认调色板（基于 blog CSS：`#4361ee` 为主色）。

## knowledge.md

可选的站点级知识管理配置，控制 `content/knowledge/` 的时效标签和新鲜度规则：

```markdown
---
freshness_rules:
  event: 7d     # 事件类知识 7 天后标记为需审查
  regime: 90d   # 政策/制度类 90 天
  framework: 1y # 框架类 1 年
  permanent: null  # 永久事实不标记
---
```

如果没有此文件，`/write` 使用默认新鲜度规则。

## Wiki-Link 约定

- 格式：`[[slug]]`，解析：`Glob("content/**/slug/slug.md")`
- `/write` 实时维护 backlinks，`/compile-wiki` 全量重建

## 内容条目格式

只用一对 `---` frontmatter，"相关条目"用普通 H2。详见 `docs/ARCHITECTURE.md`。

Frontmatter 可选字段：
- `last_reviewed: YYYY-MM-DD` — 上次内容审查日期（与 `updated` 不同：updated 是内容修改，last_reviewed 是验证内容仍准确）
- `corrections:` — 更正记录列表，每条含 `date` + `description`

## 双轨内容策略

| 维度 | Evergreen (`/plan-site`) | Trending (`/plan-trending`) |
|------|--------------------------|---------------------------|
| 频率 | 季度 | 周级/事件驱动 |
| 规模 | 100+ 篇 | 5-15 篇 |
| Frontmatter | `type: evergreen` | `type: trending` + `linked_pillar` |
| 价值 | 永久，建立领域权威 | 时效性，引流到 evergreen |
| Cluster | 拥有 cluster 目录 | 映射到已有 evergreen cluster |

Trending 文章**必须**通过 `linked_pillar` 链接到 evergreen pillar，形成热点→常青的内容飞轮。

## Cluster 归属规则

1. Stub 已指定 → frontmatter 中的 cluster
2. 推断 → 搜索 content/ 中最相关 cluster
3. 确认 → 询问用户
4. 兜底 → `content/general/`

## 双角色体系

| 角色 | 加载 | 何时 |
|------|------|------|
| **Author** | persona.md + author/wiki/ | drafter、researcher 子代理 |
| **Searcher** | searcher.md | analyzer、evaluator 子代理 |
| **配图专家** | — | illustrator 子代理 |

你不是在模仿，你就是这个身份。

## 配图体系

三种类型，优先选信息增量高的：

| 类型 | 适用 | 实现 |
|------|------|------|
| Stock 照片 | 氛围 | `site:unsplash.com` 搜索 |
| SVG 插图 | 流程/概念 | 直接生成 SVG |
| 数据图表 | 对比/趋势 | TS + Chart.js → SVG |

配图能力由 `illustration` skill 提供。drafter 用占位符标记位置，illustrator 子代理负责替换为实际图片。

## Sub-agents

| 子代理 | 角色 | 预加载 Skills |
|--------|------|-------------|
| analyzer | Searcher | — |
| researcher | Author | — |
| drafter | Author | link-builder, seo |
| illustrator | — | illustration |
| evaluator | Searcher | — |

每个子代理在运行时读取 persona 和知识库。

## Skills（用户入口）

| 命令 | 用途 | 频率 |
|------|------|------|
| `/init-site` | 导入已有站点（抓取首页） | 一次性 |
| `/deploy` | 部署 CF Sites CMS 到 Cloudflare | 一次性 |
| `/create-site` | 从零创建新站点（含 CF Sites） | 一次性 |
| `/plan-site` | 常青内容体系规划（100+篇，季度） | 季度 |
| `/plan-trending` | 热点内容规划（5-15篇，周级） | 周级 |
| `/sites` | CF Sites 站点管理（查看、连接、配置、批量操作） | 按需 |
| `/publish` | 发布文章到 CF Sites CMS | 每篇写完后 |
| `/list` | 查询 entries 状态 | 随时 |
| `/write` | 写作（核心编排器） | **日度** |
| `/rewrite` | 改写外部内容 | 按需 |
| `/evaluate` | 独立评估文章 | 按需 |
| `/ask` | 对知识库提问 | 随时 |
| `/compile-wiki` | 编译 raw → wiki | 按需 |
| `/lint` | 知识库健康检查 | 周度 |
| `/evolve` | 系统性进化 | 月度 |
