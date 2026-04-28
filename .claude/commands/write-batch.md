---
description: 交互式选择多篇条目，并行写作
---

交互式批量写作。展示待写条目供用户选择，确认后并行 dispatch 写作管线。

## 输入

$ARGUMENTS — 可选：
- 空：交互式筛选
- `slug1 slug2 slug3`：直接指定多篇
- `--cluster name`：指定 cluster 下所有 planned
- `--priority P0`：指定优先级
- `--type trending`：指定类型
- `--limit N`：最多写 N 篇（默认 3）

## 流程

### Step 0：定位站点

1. 读取 CLAUDE.md，解析 `active_site:` → `{site}`
2. 读取 `{site}/config.md`，提取配置

### Step 1：确定待写列表

**如果 $ARGUMENTS 直接指定了 slug 列表**：跳过筛选，直接进入 Step 3。

**否则，交互式筛选**：

#### 1.1 问筛选维度

使用 AskUserQuestion（singleSelect）：

> "你想写哪些文章？"
> - Trending（时效敏感）
> - Evergreen by cluster
> - Top priority (P0)
> - 全部 planned

#### 1.2 根据选择展示条目

- **Trending**：读取 content/INDEX.md 的 Trending Content 部分，列出所有 status: planned 的 trending 条目
- **Evergreen by cluster**：用 AskUserQuestion 展示 cluster 列表（如超过 4 个，按优先级分组展示），选择后列出该 cluster 下所有 planned 条目
- **Top priority**：Grep 所有 P0 planned 条目
- **全部**：列出所有 planned 条目

#### 1.3 展示候选列表

将匹配的条目格式化展示：

```
待写条目（N 篇）：

 1. [P0] btc-funding-rate-signal (market-structure, ~3000w)
 2. [P0] sanctions-crypto-adoption (geopolitical-risk, ~3500w)
 3. [P1] compliance-competitive-advantage (regulation-policy, ~2500w)
 ...
```

### Step 2：选择

使用 AskUserQuestion（multiSelect: true）让用户选择：

- 展示条目（如条目 ≤ 4 个，直接作为选项；如 > 4 个，分组展示或提供 "全部"/"前 N 篇" 快捷选项）
- 每个选项的 label 是条目 slug，description 是 cluster + 优先级 + 预估字数

如果条目很多（> 4），用以下策略：
1. 按优先级排序，展示前 4 篇作为选项，加一个 "More..." 选项
2. 用户选择 "More..." 后展示下一批
3. 或者直接在 question 中列出编号，让用户在 "Other" 中输入编号（如 "1,3,5"）

**并发限制**：最多同时写 3 篇。如用户选了超过 3 篇，提示将分批执行。

### Step 3：确认

展示用户选择的条目清单和预估总字数，使用 AskUserQuestion 确认：

> "将并行写以下 N 篇文章，预计 ~X 字。开始？"
> - 开始写作
> - 让我调整

### Step 4：并行写作

对每篇选中的条目，使用 Agent 工具（subagent_type: general-purpose, run_in_background: true）dispatch 独立的写作管线。

每个 agent 接收完整的写作指令（等同于 `/write slug` 的全部流程）：

```
你是写作编排器。为文章 {slug} 执行完整写作管线。

站点：{site_path}
配置：{config摘要}
Persona：{persona_path}
Searcher：{searcher_path}

按以下步骤执行：
1. 读取 stub（{stub_path}）获取规划笔记和 target_keywords
2. 读取 {site}/content/INDEX.md 了解内容全貌
3. 读取 {site}/content/knowledge/INDEX.md，找到相关主题文件
4. 调度 analyzer 子代理（SERP 分析）
5. 基于 analyzer 结果 + persona 制定策略
6. 调度 researcher 子代理（素材收集）
7. 调度 drafter 子代理（撰写文章）
8. **配图（P0 硬约束）**：文章中所有 `[IMAGE: ...]` 占位符必须替换为实际图片文件。对每个占位符：
   - SVG/图表：直接生成 SVG 代码，保存到文章同目录，用 `![描述](filename.svg)` 替换
   - Stock 照片：搜索 Unsplash 下载到文章同目录，用 `![描述](filename.jpg)` 替换
   - 自检：完成后搜索 `[IMAGE:` 确认 0 个残留
9. 调度 evaluator 子代理（质量评估）
10. 如有具体问题需修复：以 Author 身份理解文章和反馈语境，高质量修复，重新评估
11. 将最终文章写入 {site}/content/{cluster}/{slug}/{slug}.md
12. 更新 {site}/content/INDEX.md

完成后返回：slug、评估分数、实际字数、文章路径、配图数量。
```

**配图是硬约束，不可跳过。** 没有 illustrator 子代理可用时，agent 必须自行生成 SVG 图表或搜索下载 Stock 照片。

**并发控制**：最多 3 个 agent 同时运行。如超过 3 篇，分批 dispatch，前一批完成后再启动下一批。

### Step 5：汇总结果

所有文章完成后，汇总展示：

```
批量写作完成（N/M 篇）

✓ crypto-200m-midterm-election-spending — 88分, 1486w
✓ btc-funding-rate-signal — 85分, 2890w
✗ sanctions-crypto-adoption — 失败: researcher 未找到足够素材

成功: 2 | 失败: 1 | 总字数: ~4,376
```

更新 `{site}/content/INDEX.md`（状态统计变化）。
