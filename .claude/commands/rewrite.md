---
description: 改写外部内容
---

基于外部文章（URL 或本地文件）进行改写，产出入库。

与 `/write --update` 的区别：
- `/rewrite` — 源内容来自外部（URL 或非本站文件），创建新 entry
- `/write --update` — 更新本站已有 entry

## 输入

$ARGUMENTS — 必填：
- URL：`https://example.com/article`
- 本地文件路径：`path/to/{slug}.md`

## 流程

### 1. 获取源内容

- URL → WebFetch 抓取并提取正文
- 本地路径 → Read 读取

将源内容存入 `raw/sources/YYYY-MM-DD-{slug}.md`。

### 2. 加载上下文

- 读取活跃站点的 config、author persona、author wiki、searcher
- 读取 content/INDEX.md 了解已有内容
- Grep 搜索源内容主题的相关已有 entries

### 3. [Searcher] 分析源内容

从 searcher 视角评估源内容：
- 满足搜索意图吗？缺口在哪？
- 哪些部分有价值可以保留/增强？
- 差异化机会在哪？

### 4. [Author] 补充调研

- WebSearch 搜索最新数据和案例
- WebFetch 关键来源获取细节

### 5. [Author] 重写

**不是翻译或润色，是基于 persona 的重新创作。**

- 用你的声音和风格重写
- 保留源内容中有价值的结构和信息
- 补充调研获得的新信息
- 融入 persona 中的经验和见解
- 添加到已有 entries 的内链

遵循 `/write` 中的格式约束和 E-E-A-T 标准。

确定 cluster 归属（参见 CLAUDE.md"Cluster 归属规则"）。

### 6. [Searcher] 评估循环

同 `/write` 的评估流程（4 维度，≥阈值通过，≤3 轮）。

### 7. 更新

- 创建新 entry 到 `content/{cluster}/{slug}.md`
- 更新 INDEX.md 和相关 entries 的 backlinks
- 沉淀经验到 `raw/feedback/YYYY-MM-DD-{slug}.md`

### 输出

展示改写结果摘要、评估分数、与源内容的对比要点。
