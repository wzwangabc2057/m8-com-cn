---
description: 交互式初始化新站点，基于首页 URL 自动提取站点信息并建议 Persona
---

交互式创建一个完整的写作站点。

## 输入

$ARGUMENTS — 站点首页 URL（如 `https://example.com`），必填

## 流程

### 1. 抓取首页，自动提取信息

使用 WebFetch 抓取首页，自动提取：

- **domain**：从 URL 提取
- **language**：从 HTML lang 属性或内容判断
- **site_name**：从 `<title>` 或 logo 提取
- **领域描述**：从首页内容概括站点主题
- **现有内容结构**：从导航/分类了解已有内容
- **slug**：domain 转 slug（如 `example-com`）

如果自动提取不完整，用 AskUserQuestion 补充确认。

### 2. 分析并建议 Persona

基于首页内容（文风、已有文章、定位），**先分析再建议，让用户确认**：

**Author persona 建议**：
- 从首页推断：作者身份背景、专业领域、写作风格
- 生成一份 persona 草案（identity + belief + voice 雏形）
- 通过 AskUserQuestion 展示给用户确认，用户可以修改、补充或推翻重来

**Searcher persona 建议**：
- 从站点定位和内容推断：目标读者是谁、在搜什么、有什么痛点
- 生成一份 searcher 草案
- 通过 AskUserQuestion 展示给用户确认

只有当首页信息不足以推断时，才直接向用户提问收集。

### 3. 创建目录结构

在 `sites/{slug}/` 下创建：

```
sites/{slug}/
├── config.md
├── knowledge.md            # 站点级知识管理配置（时效标签、新鲜度规则）
├── author/
│   ├── persona.md
│   └── wiki/
│       ├── INDEX.md
│       ├── voice.md
│       ├── strengths.md
│       ├── improvements.md
│       └── patterns/
├── searcher.md
├── content/
│   └── INDEX.md
│   └── {cluster}/
│       └── {entry}/
│           └── {slug}.md
└── raw/
    ├── sources/
    ├── research/
    └── feedback/
```

### 4. 生成 config.md

按 CLAUDE.md 中定义的格式生成，frontmatter 包含从首页提取的 language、domain、created，以及默认的 default_words（3000）和 quality_threshold（80）。

**E-E-A-T 字段收集**：
在生成 config.md 时，通过 AskUserQuestion 收集以下 author 元数据：
- `author_name`：作者展示名（用于 schema、署名）
- `author_bio_short`：1-2 句话简介（用于 article byline 和 schema description）
- `author_bio_long`：完整简介（用于 author page）
- `author_url`：作者页面 URL（通常 `{domain}/about` 或 `{domain}/author/name`）
- `author_social`（可选）：Twitter、LinkedIn 等社交链接

如果用户已提供 persona 信息，从中推断 author_name 和 bio。只需确认或补充。

### 5. 生成 Persona

基于首页内容 + 用户提供的 persona 信息，**不是填模板，而是探索发现**：

**Author persona** — 写入 `author/persona.md`，包含：
- identity：身份背景
- belief：核心信念 + 来源经历 + 反对什么 + 专业洞见
- voice：节奏 + 词汇偏好 + 语气 + 论证方式（可参考首页已有内容的风格）
- boundaries：不说什么 + 不做什么 + 质量底线
- samples：开头样本 + 论证样本（展示风格）

**Searcher persona** — 写入 `searcher.md`，包含：
- identity + scenario：谁、在什么场景下搜索
- knowledge：已知/未知/误解/盲区
- needs：表面需求/深层需求/情感需求/理想状态
- judgment：信任因素/不信任因素/满意条件
- patience：时间预算/注意力阈值/耐心杀手/格式偏好
- behavior：会点什么/会跳过什么/被什么吸引/被什么劝退

**核心原则**：Persona 各部分必须内在一致、相互支撑。发现 persona，不填充模板。

### 6. 初始化知识库框架

`author/wiki/INDEX.md`：
```markdown
# {作者} 知识库

## 概览
（使用 `/compile-wiki` 从写作经验中编译）

## 文件索引
- [[voice]] — 声音和风格模式
- [[strengths]] — 擅长什么
- [[improvements]] — 待改进 + 改进历史
- patterns/ — 可复用高分模式
```

`author/wiki/voice.md`、`strengths.md`、`improvements.md` — 创建空的初始文件，等待 `/compile-wiki` 填充。

`content/INDEX.md`：
```markdown
# {站点名称}

> {领域描述}

## 状态总览
- completed: 0
- planned: 0

## Topic Clusters
（使用 `/plan-site` 规划内容，或直接 `/write "主题"` 开始写作）
```

### 7. 在 CF Sites 创建站点

如果项目中存在 `cf-sites/` 目录（CF Sites CMS 源码），自动执行：

1. 读取 `{site}/config.md` 中是否已有 `cf_cms_url` 和 `cf_site_id`
2. 如果没有，用 AskUserQuestion 询问：
   - CF Sites CMS URL（如 `https://your-cms.pages.dev`）
   - API Key（即 `wrangler secret put API_KEY` 时设置的值）
3. 读取 `{site}/.env`（或提示创建），获取 `CF_CMS_TOKEN`
4. 调用 `POST {cf_cms_url}/api/sites` 创建站点：
   ```json
   {
     "siteId": "{domain 或 slug}",
     "name": "{site_name}",
     "displayName": "{site_name}",
     "description": "{领域描述}",
     "language": "{language}",
     "theme": "default"
   }
   ```
5. 创建成功后，将 `cf_cms_url`、`cf_site_id`、`cf_auto_publish: true` 写入 `config.md`

如果 `cf-sites/` 不存在或用户选择跳过，跳过此步。不影响本地写作。

### 8. 更新 CLAUDE.md

将 `active_site: sites/{slug}` 写入 CLAUDE.md 的"当前活跃站点"部分（替换占位文本）。

### 9. 输出

总结创建的站点信息，提示用户下一步：
- `/plan-site` — 规划内容结构和 stubs
- `/write "主题"` — 直接开始写第一篇文章
- 如已在 CF Sites 创建站点：`/sites {siteId}` 查看站点详情、绑定域名
