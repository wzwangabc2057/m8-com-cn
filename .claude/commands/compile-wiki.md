---
description: 编译 raw → wiki
---

将 raw/ 中的原始数据编译为结构化知识，全量重建 backlinks。

## 职责分工

- `/write` — 写完单篇文章后实时更新相关条目的 backlinks
- `/compile-wiki`（本 skill）— 全量扫描重建所有 backlinks + 编译 raw 数据到 wiki

## 输入

$ARGUMENTS — 可选：
- 空：编译活跃站点的所有 raw 数据 + 全量重建 backlinks
- `author`：只编译作者知识库
- `backlinks`：只重建 backlinks
- `--full`：完整重编译（包括已编译过的数据）

## 流程

### 1. 扫描 raw/ 数据

- 列出 `raw/sources/`、`raw/research/`、`raw/feedback/` 中的文件
- 如非 `--full`，只处理 wiki 最后更新时间之后的新文件
- 如 `--full`，处理所有文件

### 2. 编译站点内容 wiki

处理 raw 中的调研数据和 SERP 分析：

**更新已有 entries**：
- 如果 raw 中有针对某个 entry 的更新数据，更新该 entry 的正文或 frontmatter
- 检查内容时效性，在 frontmatter 中标记需要更新

**更新 INDEX.md**：
- 扫描 content/ 下所有文件，确保 INDEX.md 完整反映实际状态
- 状态统计准确（completed/planned 计数）

### 3. 全量重建 Backlinks

扫描所有 content entries：
- 解析每个 entry 正文中的 `[[slug]]` 引用
- 验证每个 slug 都有对应文件（断裂引用标记为 `[[missing-slug]]`）
- 更新每个 entry 的"被引用于"列表
- 标记孤立条目（无引用也无被引用）

### 4. 编译作者知识库

处理 `raw/feedback/` 中的评估和反馈数据：

- 更新 `author/wiki/voice.md` — 从实际写作中提炼声音和风格模式
- 更新 `author/wiki/strengths.md` — 高分维度和擅长领域的分析
- 更新 `author/wiki/improvements.md` — 待改进点、改进历史、改进效果验证
- 更新 `author/wiki/patterns/` — 从高分文章中提取可复用结构、开头、论证模式

维护 `author/wiki/INDEX.md` 的索引和各文件摘要。

### 5. 轻量健康检查

编译完成后执行快速检查：
- backlinks 是否完整（所有 `[[slug]]` 都有对应文件）
- INDEX.md 是否与实际文件一致
- frontmatter 字段是否完整

发现的问题记录在输出中，详细修复建议用 `/lint`。

### 6. 输出

```
编译完成：
  处理 N 个 raw 文件
  更新 M 个 entries
  重建 P 个 backlinks
  发现 Q 个断裂引用
  更新 R 个 wiki 文件
```
