---
name: seo
description: 生成 SEO 元数据（title、description、slug）并做最终 SEO 检查
user-invocable: false
---

站在 SERP 搜索结果页，设计最有吸引力的 meta 信息。

## 核心原则

**你是搜索用户，站在 SERP 结果页面，决定点击哪个链接。**

你的任务：设计让自己想点击的 meta title/description。

**关键转变**：
- ❌ 不是"我想如何介绍这篇文章"（Author 视角）
- ✅ 而是"我会点击哪个结果"（Searcher 视角）

**判断依据**：
1. 回顾竞品分析（content_gaps, opportunities）
2. 代入 searcher persona 的心理和人性（你会点击什么样的结果？）
3. 设计填补 gap、触发信任和兴趣的 meta

## 设计策略

### SEO Title

- **长度：≤60 字符**（含空格和标点）
- **公式**：`[核心关键词] - [差异化卖点] (年份)`
- 前置核心关键词
- 差异化卖点从 content_gaps 提取
- 如用户指定了标题，基于该标题微调（可加年份或修饰词）
- 如果标题超 60 字符，精简但保留核心

### SEO Description

- **长度：≤160 字符**（含空格和标点）
- **公式**：`[快速决策信息] + [独特价值] + [信任信号]`
- 前 50 字符包含核心信息
- 包含 1-2 个具体数字
- 基于 persona 人性触发信任和兴趣

### Slug

- **必须用英文**：禁止拼音、禁止本地文字、禁止音译
- 小写英文单词 + 数字 + 连字符，3-7 个词，无空格
- ✅ `"best-seo-tools-comparison-2026"`
- ✅ `"keyword-research-guide"`
- ❌ `"最好的工具"` （中文）
- ❌ `"seo-gongju"` （拼音）

### Keywords

- 从 target_keywords 和文章内容中提取 3-5 个关键词
- 包含主关键词 + 长尾变体

## 字符数限制（CRITICAL）

**超过限制会被 Google 截断，导致点击率下降！**

- meta.title: ≤60 字符
- meta.description: ≤160 字符
- **输出前必须检查字符数**（包括空格和标点）
- 如果超长，反复缩短直到符合限制

## ⚠️ 语言要求

- meta title、description、keywords **必须用目标语言**
- 只有 slug 是英文（这是唯一的例外）

## SEO 检查清单

1. **H1 标题** — 仅一个，包含主关键词
2. **Heading 层级** — H1→H2→H3，无跳级
3. **关键词分布** — 自然出现在标题和正文中
4. **首屏内容** — H1 后 100 字内出现主关键词
5. **图片 alt** — 所有图片有描述性 alt，含关键词
6. **段落长度** — 每段不超过 3-4 句（移动端友好）
7. **内链** — 有合理的内链
8. **字数** — 达到目标字数
9. **FAQ section** — 包含 3-5 个 PAA 常见问题（见下）
10. **数据表格** — 当文章含 ≥3 组可比较数值时，建议表格化
11. **作者署名** — 文章末尾有可见 byline（"*By {name}. {bio_short}*"）
12. **方法论披露** — 文中有数据来源和分析框架的简要说明（E-E-A-T 信号）

## FAQ 生成

基于 target_keywords 的 PAA（People Also Ask）搜索结果，生成 3-5 个 FAQ 条目：

- 搜索每个 target keyword + "People Also Ask" 相关查询
- 选择与文章主题最相关、搜索量最大的 3-5 个问题
- 每个回答 2-3 句，直接回答问题，不要铺垫
- FAQ 放在文章正文的"What to Watch Next"或结论之后、Related Entries 之前
- 格式：用 H3 标题写问题，紧跟回答段落

## 数据表格化

当文章包含 ≥3 组可比较的数值数据时：
- 将散落在段落中的数据提取为 Markdown 表格
- 表格列标题简洁，行数据精确
- 保留原文中的数据叙述，表格作为补充（不是替代）

## JSON-LD Schema 模板

为每篇文章生成以下 schema 片段（放在 SEO 输出中，不在正文中）：

### Article Schema
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{seo_title}",
  "description": "{seo_description}",
  "datePublished": "{created_date}",
  "dateModified": "{updated_date}",
  "author": {
    "@type": "Person",
    "name": "{author_name}",
    "url": "{author_page_url}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{site_name}",
    "url": "{site_url}"
  }
}
```

### FAQ Schema（如有 FAQ section）
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{question}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{answer}"
      }
    }
  ]
}
```

## 输出

以紧凑 JSON 格式输出（无缩进、无换行、无 markdown 代码块包裹）：

```
seo_title: "标题（≤60字符）"
seo_description: "描述（≤160字符）"
seo_slug: "english-slug"
seo_keywords: [关键词列表]
og_title: "社交分享标题（可更吸引人）"
og_description: "社交分享描述"
og_type: "article"
schema_article: {Article JSON-LD}
schema_faq: {FAQ JSON-LD, 如有 FAQ section}
faq_suggestions:
  - question: "PAA 问题"
    answer: "2-3 句回答"
seo_checks:
  - item: 检查项
    status: pass|fail
    note: 说明
```
