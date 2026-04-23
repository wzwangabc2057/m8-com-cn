---
description: 规划常青内容体系（季度级别，100+ 篇）
---

为站点建立完整的常青内容地图。设计 8-15 个 topic cluster、100+ 篇文章的体系架构。

## 输入

$ARGUMENTS — 可选参数：
- 空：全新规划（首次或推翻重来）
- `--refresh`：基于现有内容增量更新（增补缺口、调整优先级）

## 原则

- **全面覆盖**：目标是建立领域权威，不是填几个坑。8-15 个 cluster，100+ 篇文章
- **分层深度**：P0 详细规划，P1 中等，P2 轻量。不是每篇都要写满规划笔记
- **增量可扩展**：`--refresh` 模式只增不改不删，现有内容保持稳定
- **与热点轨道分离**：本 skill 只管常青内容。热点内容由 `/plan-trending` 负责

## 流程

### Phase 1: 领域地图（Domain Mapping）

#### 1.1 加载站点上下文

- 读取 CLAUDE.md 找到活跃站点路径
- 读取 `sites/{site}/config.md`
- 读取 `sites/{site}/searcher.md`
- 读取 `sites/{site}/author/persona.md`
- 读取 `sites/{site}/content/INDEX.md` 和所有 cluster INDEX
- 读取 `sites/{site}/content/knowledge/INDEX.md`（全局知识库，了解已有领域知识覆盖）
- 读取 `sites/{site}/author/wiki/INDEX.md`（如有知识积累）

#### 1.2 定义内容宇宙

基于站点定位（config.md 的领域描述 + persona 的专业领域），定义内容的边界：

- **核心域**：站点必须覆盖的领域（persona 的专业洞见指向的方向）
- **相邻域**：与核心域有强关联、读者会同时关心的领域
- **排除域**：不属于本站覆盖范围的方向（明确边界，避免内容膨胀）

输出领域地图，写入 `raw/research/domain-map-{date}.md`。

#### 1.3 全面 SERP 研究对每个主要方向进行搜索研究：

- 核心关键词的 SERP 分析（谁在排、什么格式、什么角度）
- 竞品网站的内容结构（导航、分类、主要 cluster）
- 搜索者常见查询和意图（People Also Ask、相关搜索）
- 内容缺口（竞品弱、搜索量大、无人深度覆盖的方向）

**研究范围**：不少于 10 次独立搜索，覆盖核心域和相邻域的每个主要方向。

研究结果存入 `raw/research/serp-analysis-{date}.md`。

---

### Phase 2: Cluster 架构设计

#### 2.1 设计 Topic Clusters

基于领域地图 + SERP 研究，设计 8-15 个 topic cluster：

- 每个 cluster 对应搜索者的一个核心需求域（不是产品功能分类）
- 每个必须能独立支撑 8-12 篇文章（不够大的合并，太大的拆分）
- cluster 之间有明确的边界，不重叠
- 定义 cluster 间的关联关系（哪些 cluster 需要互相链接）

#### 2.2 优先级定义

每个 cluster 标注：
- **优先级**：P0（核心权威）/ P1（重要覆盖）/ P2（完整拼图）
- **竞争难度**：高/中/低（基于 SERP 竞争强度）
- **差异化潜力**：高/中/低（基于竞品弱点和本站独特角度）

---

### Phase 3: 文章枚举

对每个 cluster，枚举所有文章：

#### 3.1 Pillar Article（每个 cluster 1 篇）

- 3000-4000 字，是该 cluster 的权威入口
- 回答 "这个领域最重要的 5 个问题"
- 链接到 cluster 内所有 supporting articles

#### 3.2 Supporting Articles（每个 cluster 7-11 篇）

- 2000-3000 字，深入 pillar 的某个子方向
- 必须链接回 pillar + 至少 2 篇同 cluster 文章
- 跨 cluster 链接：每篇至少 1 个外 cluster 链接

#### 3.3 优先级分配

- **P0**（~20%）：Pillar + 每个核心 cluster 的 top 2-3 篇
- **P1**（~50%）：核心 cluster 的其余文章 + 重要 cluster 的核心文章
- **P2**（~30%）：完整拼图类文章，搜索量较小但有覆盖价值

#### 3.4 内链网设计

确保 cluster 间形成有机的链接网络，不是孤立的集合。关键交叉点：
- 哪些 cluster 天然应该互相链接？
- 哪些文章是跨 cluster 的桥梁节点？
- 读者从一个 cluster 自然流向另一个 cluster 的路径是什么？

---

### Phase 4: Stub 创建

#### 4.1 Tiered Stub 格式

**P0 stub**（详细规划）：
```markdown
---
status: planned
type: evergreen
priority: P0
cluster: cluster-slug
target_keywords: [kw1, kw2]
estimated_words: 3500
---

# 标题

## Planning Notes

**Differentiation angle**: 与竞品的差异点
**SERP observations**: 排名现状和机会
**Internal links**: [[pillar-slug]], [[related-entry]]
**Cross-cluster links**: [[other-cluster-entry]]
**Target searcher**: 什么场景下的什么读者
```

**P1 stub**（中等规划）：
```markdown
---
status: planned
type: evergreen
priority: P1
cluster: cluster-slug
target_keywords: [kw1, kw2]
estimated_words: 2500
---

# 标题

**Angle**: 一句话差异化角度
**Links**: [[pillar-slug]], [[related-1]], [[related-2]]
```

**P2 stub**（轻量规划）：
```markdown
---
status: planned
type: evergreen
priority: P2
cluster: cluster-slug
target_keywords: [kw1, kw2]
estimated_words: 2000
---

# 标题

一句话描述这篇文章要覆盖什么。
```

#### 4.2 执行

- 创建 `{cluster}/` 目录和 `{cluster}/INDEX.md`
- 按优先级批量创建 stub 文件
- P0 先创建，P1 次之，P2 最后

---

### Phase 5: 更新内容全景图

更新 `content/INDEX.md`：

- 所有 cluster 列表（含优先级、文章数、状态）
- 每个 cluster 下的所有 entries（含状态、优先级）
- 整体进度统计（completed / planned / total）
- 跨 cluster 链接地图
- **写作路线图**：按优先级排列的前 10 篇推荐写作顺序

---

### Phase 6: 输出

向用户展示：
- 总计 N 个 cluster，M 篇文章
- 领域覆盖图（哪些方向覆盖了，哪些有意排除）
- 按优先级排序的写作路线图（前 10 篇）
- 预计总字数

用户可以立即 `/write "slug"` 开始写作。

---

## `--refresh` 模式

当参数包含 `--refresh` 时，执行增量更新而非全新规划：

### R1: 现状分析

- 读取 content/INDEX.md 和所有 cluster INDEX
- 统计：哪些 cluster 已有内容、哪些是空的
- 识别：哪些 cluster 太薄（< 5 篇）、哪些方向完全缺失
- 读取已有文章，了解实际覆盖了哪些角度

### R2: 差距识别

对比当前内容 vs 领域地图：
- **Thin clusters**：有 cluster 但文章不够，需要补充
- **Missing clusters**：领域地图中有但尚未创建的 cluster
- **Outdated angles**：SERP 格局变化导致某些 stub 的角度需要更新
- **New opportunities**：上次规划后出现的新方向或新关键词

### R3: 增量规划

只增不改不删：
- 新增 cluster（如有缺失方向）
- 为现有 cluster 补充文章
- 调整优先级（已有内容的完成情况可能改变优先级排序）
- 不修改已有 stub 的内容，除非明确过期需要更新

### R4: 执行

- 创建新的 cluster 目录和 INDEX
- 创建新的 stub 文件
- 更新 content/INDEX.md（保留现有内容，追加新增内容）

### R5: 输出

向用户展示增量变化：
- 新增了哪些 cluster 和文章
- 哪些 cluster 被补充了
- 更新后的写作路线图
