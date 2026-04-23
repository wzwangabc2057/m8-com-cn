---
description: 规划热点内容（支持小时/日/周粒度，事件驱动）
---

基于当前热点事件，规划时效性内容。每篇必须链接到已有 evergreen pillar，形成热点→常青的内容飞轮。

## 输入

$ARGUMENTS — 可选参数：
- 空：扫描当前热点，规划本周 trending 内容（默认 `--week`）
- `--hour`：小时级快扫，覆盖过去 1-6 小时的突发事件，1-3 篇，每篇 1500-2000 字
- `--day`：日级规划，覆盖过去 24 小时热点，3-7 篇，每篇 2000-2500 字
- `--week`：周级规划，覆盖过去 7 天热点，5-15 篇，每篇 2000-2500 字
- `--topic "话题"`：围绕特定热点规划 3-5 篇
- `--refresh`：基于已有 trending 内容增量更新

可组合：`--day --topic "Drift hack"` 表示日级粒度聚焦特定话题

## 原则

- **时效驱动**：热点内容有价值窗口期，不是永久资产
- **Evergreen 桥梁**：每篇 trending 必须链接到 evergreen pillar，热点流量导入常青内容
- **快速轻量**：5-15 篇，每篇 2000-2500 字，研究不求全面
- **粒度适配**：`--hour` 极简、`--day` 精准、`--week` 全面，不同节奏匹配不同时效
- **与常青轨道分离**：本 skill 只管热点内容。常青内容由 `/plan-site` 负责
- **不做新闻搬运**：不是 "X 发生了" 的新闻稿，是 "X 为什么比表面看起来更重要" 的分析

## 流程

### Phase 1: 热点扫描

#### 1.1 加载站点上下文

- 读取 CLAUDE.md 找到活跃站点路径
- 读取 `sites/{site}/config.md`
- 读取 `sites/{site}/searcher.md`
- 读取 `sites/{site}/content/INDEX.md`（了解 evergreen 体系）
- 读取各 cluster INDEX（了解现有 pillar 和文章）
- 读取 `sites/{site}/content/knowledge/INDEX.md`（全局知识库，了解已有领域知识）

#### 1.2 快速热点扫描

根据时间粒度调整扫描范围和深度：

**`--hour` 模式**（极简快扫）：
- 2-3 次搜索，聚焦过去 1-6 小时的突发事件
- 搜索词含 "breaking" "just in" "flash crash" "hack"
- 产出 1-3 篇，每篇 1500-2000 字
- Stub 中 `time_sensitivity: hours`，`window_expires` 设为 24-48 小时内
- 跳过 Phase 2 详细筛选，凭直觉快速判断

**`--day` 模式**（精准扫描）：
- 3-5 次搜索，覆盖过去 24 小时热点
- 按事件类型分组：监管/市场/协议/宏观/叙事
- 产出 3-7 篇，每篇 2000-2500 字
- Stub 中 `time_sensitivity: days`，`window_expires` 设为 3-7 天

**`--week` 模式（默认）**（全面扫描）：
- 5-8 次搜索，覆盖过去 7 天热点
- 覆盖：监管动态、市场异动、协议事件、宏观政策、叙事轮动
- 产出 5-15 篇，每篇 2000-2500 字
- 完整执行 Phase 1-6

搜索策略：优先搜 "breaking" "analysis" "impact" 类关键词，时间范围匹配所选粒度。

研究结果和链接关系写入 `raw/research/trending-scan-{date}.md`。

---

### Phase 2: 机会筛选

对扫描到的每个热点事件进行快速评估：

#### 筛选维度

| 维度 | 评估标准 | 权重 |
|------|---------|------|
| **时效窗口** | 天级（紧急）/ 周级（重要）/ 月级（持续） | 高 |
| **搜索需求** | 是否已有人在搜？预计搜索量趋势？ | 高 |
| **Evergreen 关联** | 能否链接到现有 pillar？无关联则不做 | **必须** |
| **差异化空间** | CoinALX "surface vs substance" 角度在哪？ | 中 |
| **分析深度** | 能否产出超越新闻稿的洞察？ | 中 |

#### 过滤规则

**必做**：
- 能链接到 evergreen pillar 的热点事件
- 有 CoinALX 独特分析角度的话题

**不做**：
- 纯新闻事件（无分析深度）
- 无法链接到任何 evergreen cluster 的话题
- 与站点定位不符的方向（见排除域）
- 已经被大量深度覆盖的话题（除非有明确差异化角度）

---

### Phase 3: 文章规划

对通过筛选的热点话题，规划 1-3 篇文章：

#### Stub 格式

```markdown
---
status: planned
type: trending
cluster: cluster-slug
linked_pillar: pillar-slug
target_keywords: [kw1, kw2]
estimated_words: 2500
time_sensitivity: hours | days | weeks | months
window_expires: YYYY-MM-DD
---

# 标题

**Hook**: 为什么这件事比表面看起来更重要
**Angle**: CoinALX 的差异化视角
**Evergreen link**: [[pillar-slug]] — 读者后续应读的常青内容
**Cross-links**: [[other-trending]], [[other-evergreen]]
```

#### 规划原则

- 每篇只聚焦一个热点事件的一个分析角度
- 每篇**必须**指定 `linked_pillar`，指向最相关的 evergreen pillar
- `time_sensitivity` 决定优先级：days 级最先写，weeks 其次
- 文章字数控制在 2000-2500 字，比 evergreen 更精炼
- 标题直接点明事件 + 分析角度，不做标题党

#### 内链策略

Trending 文章的内链逻辑：

```
trending article → evergreen pillar（必须，引流到常青内容）
trending article → 相关 evergreen supporting（可选，补充背景）
trending article → 同期其他 trending（可选，形成热点专题）
```

Evergreen pillar 不需要反向链接到 trending（保持常青内容的稳定性）。

---

### Phase 4: Stub 创建

- Trending 文章放入对应**已有** evergreen cluster 目录
- 通过 `type: trending` frontmatter 与 evergreen 区分
- **不创建**新的 cluster 目录
- 更新对应 cluster 的 INDEX.md，追加 trending entries

---

### Phase 5: 更新内容全景图

更新 `content/INDEX.md`：

- 在 Topic Clusters 部分标注各 cluster 的 trending 文章数
- 新增 "Trending Content" 段落：
  - 本期 trending 文章列表（含时效窗口）
  - 与 evergreen 的链接关系
  - 推荐发布顺序（按时效性排序）
- 更新整体统计（completed / planned / trending / total）

---

### Phase 6: 输出

向用户展示：

- **本周热点日历**：按发布顺序排列，标注时效窗口
  ```
  Day 1 (urgent): [标题] — window_expires: YYYY-MM-DD
  Day 2-3: [标题] — window_expires: YYYY-MM-DD
  Day 4-5: [标题] — window_expires: YYYY-MM-DD
  ```
- **Evergreen 桥梁图**：哪些 trending 文章为哪些 pillar 引流
- **预计总字数**

用户可以立即 `/write "slug"` 开始写作。

---

## `--topic` 模式

当参数包含 `--topic "话题"` 时，聚焦于特定话题：

### T1: 话题研究

- 围绕指定话题进行 3-5 次搜索
- 了解事件全貌、各方反应、市场影响
- 识别与 evergreen cluster 的关联点

### T2: 角度规划

- 从 CoinALX 的 "surface vs substance" 视角设计 3-5 个分析角度
- 每个角度对应 1 篇文章
- 确保角度之间有差异化，不重复

### T3-T5: 与标准流程相同

文章规划 → Stub 创建 → 更新 INDEX → 输出

---

## `--refresh` 模式

当参数包含 `--refresh` 时，执行增量更新：

### R1: 现状审查

- 读取所有 `type: trending` 的文章
- 统计：已完成 / 进行中 / 已过期
- 识别：哪些 planned 文章的 `window_expires` 已过

### R2: 清理与补充

- 将已过期的 planned 文章标记为 `status: expired`
- 扫描新的热点事件（执行 Phase 1-2）
- 补充新的 trending 文章

### R3: 更新

- 更新 cluster INDEX（反映 trending 状态变化）
- 更新 content/INDEX.md（统计数据变化）
- 输出变化摘要

---

## 与 `/plan-site` 的协作

| 场景 | 谁负责 |
|------|--------|
| 发现新的 evergreen 方向 | `/plan-trending` 发现后建议用户运行 `/plan-site --refresh` |
| Trending 文章沉淀为 evergreen | 用户手动用 `/write --update` 将 type 改为 evergreen |
| 热点事件揭示 evergreen 缺口 | `/plan-trending` 在输出中标注 "建议新增 evergreen: X" |
