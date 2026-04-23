---
description: 知识库健康检查
---

检查站点知识库的完整性和一致性。

## 输入

$ARGUMENTS — 可选：
- 空：全面检查
- `--fix`：自动修复可修复的问题（需用户确认）
- `--quick`：只做快速检查（INDEX 一致性 + 孤立条目）

## 检查项目

### 1. 索引一致性

- INDEX.md 中列出的 entries 是否都存在文件
- 文件系统中存在的 entries 是否都在 INDEX.md 中
- 状态标记是否与文件内容一致（planned entry 不应有完整正文）

### 2. Backlinks 完整性

- 所有 `[[slug]]` 引用是否指向存在的文件
- 被引用条目的 backlinks 是否包含引用者
- 是否有断裂的引用（slug 不匹配任何文件）

### 3. 孤立条目

- 找出没有引用任何其他条目、也没有被任何条目引用的 entries
- 建议关联方向

### 4. 内容质量信号

- completed entries 是否都有评估分数
- 评估分数低于阈值的 entries（需要重写）
- 长时间未更新的 completed entries（可能过时）
- planned entries 是否有规划笔记
- **内容新鲜度检查**（evergreen entries）：
  - 如果 `last_reviewed` 不存在或超过 90 天 → 标记需要审查
  - 如果 `updated` 超过 180 天且无 `last_reviewed` → 标记可能过时
  - 如果有 `corrections` 记录 → 确认相关内容已更新
  - Trending entries 检查 `window_expires`：已过期的 planned entries 应标记为 expired

### 5. 知识库结构

- cluster INDEX.md 是否完整
- 每个 cluster 是否有支柱页面
- cluster 内的 entries 是否逻辑关联

### 6. 作者知识库

- author/wiki/ 各文件是否更新
- improvements.md 中的改进是否已体现在 persona 中
- patterns/ 是否有足够的可复用模式

### 7. 知识库新鲜度

- 读取 `{site}/knowledge.md` 获取站点级新鲜度规则
- `content/knowledge/INDEX.md` 是否存在且列出了主题
- 按配置中的规则检查：各时效标签的事实是否过期
- 主题文件 `updated` 是否超过配置中定义的审查周期
- 主题文件是否有 Coverage 记录（避免重复调研）
- 全局知识库与各 cluster 的关联是否覆盖所有活跃 cluster

- 有 cluster 但缺关键子条目
- 可以新建的关联条目建议
- 可以合并的重叠条目

## 输出

```
知识库健康报告：{site}

✓ 索引一致性：通过（N entries 全部匹配）
⚠ Backlinks：3 个断裂引用
  - [[old-entry]] 已不存在，被 [[keyword-research]] 引用
  ...
✓ 孤立条目：2 个
  - [[technical-seo]] 无引用也无被引用，建议关联到 [[seo-fundamentals]]
⚠ 过时内容：1 篇
  - [[seo-trends]] 已 6 个月未更新

建议操作：
  1. 修复 3 个断裂 backlinks → /compile-wiki --full
  2. 更新 [[seo-trends]] → /write --update seo-trends
  3. 补充 cluster "link-building" 的支柱页面 → /plan-site
```

如果带 `--fix`，对可自动修复的问题（如 backlinks 更新、INDEX 同步）在用户确认后执行。
