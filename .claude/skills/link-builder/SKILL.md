---
name: link-builder
description: 将引用标记转换为链接，并添加内部链接和外部权威链接
user-invocable: false
---

将文章中的 `[^ref_id]` 引用标记转换为实际链接，并添加内部链接。

## 核心原则

**100% 内容保真**：所有段落、句子、内容必须完整保留。输出字符数 ≥ 输入的 95%。

## 第一步：转换引用标记为链接

将每个 `[^N]` 转换为 `[anchor_text](url)`：

**锚文本规则**：
- 从 `[^N]` 所在句子中提取 2-4 个词作为锚文本（≤6 词）
- **绝对不要**用 reference.title 作为锚文本
- 如果句子中没有合适的词，重写句子以容纳链接
- ❌ 禁止空洞、无信息量的锚文本
- 锚文本必须用目标语言
- 外链锚文本：暗示权威性，避免引导点击
- 内链锚文本：可以有引导性，引导站内点击

**⚠️ 宁可重写句子，也绝不删除 `[^N]` 标记！**
**⚠️ 特别注意首段和结尾——这两个位置最容易遗漏！**

**转换前**：
```markdown
Ahrefs 是最流行的 SEO 工具 [^3]
```

**转换后**：
```markdown
[Ahrefs](https://ahrefs.com) 是最流行的 SEO 工具
```

**表格中的引用**：
- 如果 URL 与相邻单元格重复 → 删除引用标记
- 否则在相邻单元格添加链接

## 第二步：添加内部链接

1. 读取 {content_index_path}，了解所有已有条目
2. **只链接已发布条目**：只对 frontmatter 含 `published_url` 的条目创建 `[[slug]]` 链接。未发布的条目（status: planned/completed 但无 published_url）一律不链接，避免线上死链
3. **Cross-cluster scan**：不只看当前 cluster，扫描所有 cluster 的已发布文章
4. 在文章中找到匹配已发布条目 target_keywords 的概念
5. 自然地将概念转换为 `[[slug]]` 链接

**Cross-cluster linking 规则**：
- 每篇文章至少 1 个跨 cluster 的 pillar 链接
- 跨 cluster 链接优先链接到 pillar 文章（`{cluster}-pillar`）
- 优先选择主题有逻辑关联的 cluster（参考 content/INDEX.md 中的 Cross-Cluster Link Map）
- 例如：写 market-structure 的文章时，如果讨论了宏观因素，应该链接到 `[[macro-crypto-pillar]]`；如果讨论了周期定位，应该链接到 `[[bitcoin-cycle-pillar]]`

**内链原则**：
- 只在概念首次出现时链接
- 链接必须与上下文相关
- 每 1000 字约 2-4 个内链
- 已有链接不重复
- **cluster 内链接 + 跨 cluster 链接都要考虑**

## 第三步：自检（必须执行）

逐个检查所有引用标记：
```
[^1] → 找到对应链接？✅/❌
[^2] → 找到对应链接？✅/❌
...继续检查所有 ID...
```

**通过标准**：
- 输出中包含 0 个 `[^N]` 标记
- 输出链接数 = 输入 `[^N]` 数
- 每个 reference URL 都有对应链接

## 输出

返回添加了内外链的完整文章正文。
