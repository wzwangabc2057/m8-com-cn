---
description: 系统性进化
---

基于累积数据审查和改进整个写作系统。

## 输入

$ARGUMENTS — 可选：
- 空：全面进化审查
- `persona`：只改进作者 persona
- `skills`：只审查和改进 skill 定义
- `--dry-run`：只输出建议，不执行修改

## 流程

### 1. 数据收集

读取以下数据：

- `content/INDEX.md` — 内容全貌
- 所有 completed entries 的 frontmatter（score、revision_rounds、updated）
- `raw/feedback/` — 历史评估和反馈
- `author/wiki/` — 作者知识库全貌
- `author/persona.md` — 当前 persona 定义

### 2. 趋势分析

**质量趋势**：
- 最近 10 篇的平均分数和趋势（上升/稳定/下降）
- 四维度分布：哪个维度持续高分，哪个持续低分
  - relevance / usefulness / trustworthiness / user_experience
- 修改轮数分布：大部分文章一次通过还是多次修改

**模式分析**：
- 高分文章有什么共同点（结构、主题、写作方式）
- 低分文章有什么共同问题
- 作者 wiki 中的 patterns 实际使用效果如何

### 3. 改进建议

基于分析提出具体改进，每条建议必须包含**数据依据**：

**Persona 层面**：
- "trustworthiness 维度连续 5 篇低于 80，建议在 persona 中强化引用规范要求"
- "高分文章都使用了个人经历开头，建议加入 voice.md"

**Skill 层面**：
- "research 阶段素材利用率低（很多素材没被 draft 使用），建议调整调研策略"
- "修改循环中第 2-3 轮改进幅度小，考虑收紧反馈的精确度"

**内容策略层面**：
- "X cluster 平均分数最高，是作者擅长的领域"
- "Y cluster 修改轮数最多，可能需要补充领域知识"

### 4. 执行改进（需用户确认）

对每条建议逐个确认：
- 展示数据依据
- 说明具体改动
- 预期效果

用户确认后，直接修改相关文件：
- `author/persona.md`
- `author/wiki/` 下的各文件
- 如用户同意，也可修改 `.claude/commands/` 下的 skill 定义

**原则**：
- 每次改动要有数据支撑，不是凭感觉
- 改动是渐进的，不是推翻重来

### 5. 记录

在 `author/wiki/improvements.md` 中追加本轮进化记录：
- 日期
- 发现的趋势
- 做了什么改动
- 预期效果

下次 `/evolve` 时验证预期是否达成。

### 输出

```
进化报告 — {date}

质量趋势：平均 82 → 85（↑）
强维度：relevance (89), user_experience (87)
弱维度：trustworthiness (76)

已执行改进：
  ✓ persona.md — 强化引用规范要求
  ✓ voice.md — 新增高分开头模式
  ○ skill 调整 — 待确认

下次进化建议在 N 篇文章后执行。
```
