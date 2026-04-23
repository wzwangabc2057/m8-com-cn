---
description: 独立评估文章
---

从搜索者视角评估任意文章的质量。

## 输入

$ARGUMENTS — 必填，可以是：
- slug：`keyword-research`
- 本地文件路径：`content/seo-fundamentals/keyword-research.md`
- URL：`https://example.com/article`（WebFetch 抓取后评估）

可选参数：
- `--verbose`：输出详细评估报告
- `--fix`：评估后直接进入修改循环

## 流程

### 1. 获取内容

- slug → Glob `content/**/*.md` 查找
- 路径 → 直接 Read
- URL → WebFetch 抓取

### 2. 加载评估上下文

- 读取活跃站点的 `searcher.md` — **你就是这个搜索者**
- 读取 `config.md` — 了解站点定位和质量阈值
- 读取该 entry 的 frontmatter 中的 target_keywords（如有）

### 3. [Searcher] 评估

以真实搜索用户的身份阅读文章，评估四个维度：

1. **相关性 (relevance)**：搜索 {target_keywords} 时，这篇文章满足我的需求吗？
2. **实用性 (usefulness)**：读完后我能解决问题吗？有可执行的建议吗？
3. **信任度 (trustworthiness)**：我相信这些内容吗？数据/案例/引用有说服力吗？
4. **体验 (user_experience)**：阅读体验好？信息好找？会读到最后吗？

每个维度评分 0-100，总分取平均。

**评分标准**：
- ≥80：优秀
- 60-79：良好，建议优化
- <60：不合格

### 4. 提供反馈

**反馈原则**：具体、可执行、可定位。

不说：
- "内容不够深入"

要说：
- "作为 {searcher}，我期望在第 X 部分看到 {具体内容}，但文章中没有"

### 5. 输出

```
评估结果：{score}/100 {✓ 通过 | ✗ 需要改进}

维度评分：
  相关性：85 — {一句话理由}
  实用性：78 — {一句话理由}
  信任度：90 — {一句话理由}
  体验：82 — {一句话理由}

优先改进项：
  1. {具体位置}：{问题描述} → {改进建议}
  2. ...

快速改进：
  - {立即可做的改动}
```

如果带 `--fix` 参数，评估后切回 [Author] 视角，根据反馈修改文章，然后重新评估（≤3 轮）。修改完成后更新 entry 文件和 frontmatter 中的 score。
