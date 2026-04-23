# 配置参考

## config.md

站点主配置文件，位于 `sites/{slug}/config.md`。

```markdown
# {站点名称}

---
language: en                    # 内容语言
default_words: 3000             # 默认字数目标
quality_threshold: 80           # 质量评估及格线（0-100）
domain: example.com             # 站点域名
created: YYYY-MM-DD             # 创建日期

# E-E-A-T 字段
author_name: "Display Name"
author_bio_short: "1-2 句简介，用于文章署名和 schema"
author_bio_long: "完整作者简介，用于 author page"
author_url: "https://example.com/about"
author_social:
  twitter: "handle"
  linkedin: "profile-url"
---

{站点领域描述}
```

### 字段用途

| 字段 | 谁用 | 用途 |
|------|------|------|
| `language` | drafter, evaluator | 文章语言 |
| `default_words` | drafter | 字数目标 |
| `quality_threshold` | write (Step 6) | 评估修复循环的阈值 |
| `domain` | researcher (站内调研) | `site:{domain}` 搜索 |
| `author_name` | drafter, publish | 文章署名、schema |
| `author_bio_short` | drafter | byline 简介 |
| `author_bio_long` | publish | author page |
| `author_url` | publish | schema author URL |
| `author_social` | publish | schema sameAs |

## knowledge.md

站点级知识管理配置，位于 `sites/{slug}/knowledge.md`。

定义本站的时效标签体系和新鲜度规则。项目级流程（researcher、lint）读取此文件适配行为。

```markdown
# Knowledge Config — {站点名}

## 时效标签体系

| 标签 | 含义 | 有效期 | Researcher 复用规则 |
|------|------|--------|-------------------|
| permanent | 不变的机制/原理 | 永久 | 直接复用 |
| framework | 分析框架 | 季度 | 复用框架，验证实例 |
| regime | 当前市场状态 | 30天 | 必须重新验证 |
| event | 历史事实 | 永久（历史参考） | 作为对比使用 |

## 新鲜度检查规则

- regime 标签超过 30 天 → 标记"可能过时"
- 主题文件 updated 超过 90 天 → 标记"建议审查"
- framework 标签超过 180 天 → 标记"实例可能过时"
```

不同站点可以有不同的标签体系。比如游戏站可能用 `patch-sensitive`（随游戏版本变化）替代 `regime`。

## content/INDEX.md

站点内容全景图。记录所有 cluster、文章状态、trending 日历、写作路线图。

由 `/plan-site`、`/plan-trending`、`/write` 自动维护。

## author/persona.md

作者 Persona。详见 [[CONCEPTS#Persona 双角色]]。

## searcher.md

搜索者 Persona。详见 [[CONCEPTS#Persona 双角色]]。
