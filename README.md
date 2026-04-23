# Writing Bro

> 基于 Claude Code 的 SEO 写作系统。写完即发布，网上的文章就是知识库本身。

## 这是什么

Writing Bro 是一个 Claude Code 驱动的写作工作流。它通过 slash 命令编排分析、调研、写作、配图、评估、发布全流程，让一篇 SEO 文章从选题到上线完全自动化。

核心能力：

- **完整写作管线**：SERP 分析 → 策略制定 → 素材调研 → 文章撰写 → 配图 → 质量评估 → 发布上线
- **双角色体系**：Author Persona（写作者）+ Searcher Persona（搜索者），子代理在隔离上下文中运行
- **双轨内容策略**：Evergreen（常青，季度级 100+ 篇）+ Trending（热点，周级 5-15 篇）
- **知识飞轮**：写作产出沉淀为知识库，知识库反哺下一次写作
- **CF Sites 集成**：写完自动发布到 Cloudflare 边缘站点

## 快速开始

### 前置条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- 一个 Cloudflare Sites CMS 实例（可选，用于自动发布）

### 1. Clone 并进入项目

```bash
git clone https://github.com/your-repo/writing_bro.git
cd writing_bro
```

### 2. 部署 CF Sites CMS（可选，用于自动发布）

如果你需要一个内容托管平台来发布文章，项目内置了 CF Sites CMS 源码：

```bash
cd cf-sites
cp .env.example .env        # 填入 Cloudflare 凭证
npm install
npm run deploy               # 部署到你的 Cloudflare 账户
```

详细步骤见 [cf-sites/README.md](cf-sites/README.md)，包括创建 D1/R2/KV 资源、配置 API Key 等。

### 3. 初始化站点

在 Claude Code 中运行：

```
/init-site https://your-site.com
```

这会自动抓取首页、分析内容定位、生成 Author/Searcher Persona、创建站点目录结构。

### 3. 规划内容体系

```
/plan-site          # 常青内容体系（8-15 个 cluster，100+ 篇）
/plan-trending      # 热点内容（周级，事件驱动）
```

### 4. 写作

```
/write "文章标题"    # 单篇写作（核心命令）
/write-batch        # 交互选择多篇，并行写作
```

### 5. 发布

在 `sites/{your-site}/config.md` 中配置 CF Sites 连接信息，`cf_auto_publish: true` 时写完自动发布。

也可以手动发布：

```
/publish article-slug
```

## 命令一览

| 命令 | 用途 | 频率 |
|------|------|------|
| `/init-site` | 导入已有站点（抓取首页） | 一次性 |
| `/create-site` | 从零创建新站点（含 CF Sites） | 一次性 |
| `/plan-site` | 常青内容体系规划 | 季度 |
| `/plan-trending` | 热点内容规划 | 周级 |
| `/write` | 写一篇文章（核心命令） | 日度 |
| `/write-batch` | 交互选择多篇，并行写作 | 日度 |
| `/sites` | CF Sites 站点管理 | 按需 |
| `/publish` | 发布文章到 CF Sites | 每篇后 |
| `/list` | 查看内容状态 | 随时 |
| `/rewrite` | 改写外部内容 | 按需 |
| `/evaluate` | 独立评估文章质量 | 按需 |
| `/ask` | 对知识库提问 | 随时 |
| `/compile-wiki` | 编译写作经验到知识库 | 按需 |
| `/lint` | 知识库健康检查 | 周度 |
| `/evolve` | 系统性进化 | 月度 |

## 项目结构

```
writing_bro/
├── CLAUDE.md                    # 项目入口配置（active_site 等）
├── cf-sites/                    # CF Sites CMS 源码（Cloudflare Workers）
│   ├── cms/                     # CMS API 服务（内容管理）
│   ├── blog/                    # 博客前端（Handlebars 模板）
│   ├── store/                   # 电商前端（可选）
│   ├── workers/                 # 共享 Workers
│   ├── cron/                    # 定时任务
│   └── scripts/                 # 部署脚本
├── docs/                        # 架构文档
│   ├── ARCHITECTURE.md          # 三层架构详解
│   ├── GETTING-STARTED.md       # 详细上手指南
│   ├── COMMANDS.md              # 命令速查
│   └── CONCEPTS.md              # 核心概念
│
├── sites/                       # 每个站点 = 完整写作系统（gitignore）
│   └── {site}/
│       ├── config.md            # 站点配置 + CF Sites 发布配置
│       ├── .env                 # API token（gitignore）
│       ├── author/
│       │   ├── persona.md       # 作者 Persona
│       │   └── wiki/            # 作者知识库
│       ├── searcher.md          # 目标搜索者
│       ├── content/             # 文章 = 知识库 = 可发布内容
│       │   ├── INDEX.md         # 内容全景图
│       │   ├── knowledge/       # 跨 cluster 领域知识
│       │   └── {cluster}/
│       │       └── {slug}/
│       │           ├── {slug}.md
│       │           └── hero.jpg
│       └── raw/                 # 原始素材
│
└── .claude/
    ├── commands/                # Skill 定义（用户入口）
    ├── agents/                  # 子代理定义
    └── skills/                  # 专业能力（配图、链接、SEO）
```

## 架构

三层分离：**编排 → 执行 → 能力**

```
用户层（commands/）   → /write 等命令，用户直接交互
执行层（agents/）     → analyzer, researcher, drafter, evaluator 等子代理
能力层（skills/）     → illustration, link-builder, seo 等专业能力
```

子代理在隔离上下文中运行，通过文件系统传递数据。Persona 和知识库运行时注入，不硬编码。

详细架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## CF Sites 发布配置

项目内置 CF Sites CMS 源码（`cf-sites/`），部署到你的 Cloudflare 账户即可拥有自己的内容托管平台。

每个站点在 `config.md` 中配置：

```yaml
cf_cms_url: "https://your-cms-instance.pages.dev"
cf_site_id: "your-site-id"
cf_auto_publish: true
```

API token 存在 `sites/{site}/.env`（已 gitignore）：

```
CF_CMS_TOKEN=your-token-here
```

站点管理通过 `/sites` 命令：查看所有部署站点、导入已有站点、编辑配置、管理域名等。

不使用 CF Sites 也可以——Writing Bro 的写作管线独立运行，文章保存在本地。

## License

MIT
