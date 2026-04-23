# 核心概念

## Persona 双角色

每个站点定义两个角色，贯穿整个写作管线：

### Author（作者）

定义在 `author/persona.md`。包含：
- **identity**：身份背景
- **belief**：核心信念、来源经历、反对什么
- **voice**：节奏、词汇偏好、语气、论证方式
- **boundaries**：不说什么、不做什么、质量底线
- **samples**：风格样本

被 **researcher** 和 **drafter** 子代理加载。"你不是在模仿，你就是这个身份。"

### Searcher（搜索者）

定义在 `searcher.md`。包含：
- **identity + scenario**：谁、在什么场景下搜索
- **knowledge**：已知/未知/误解/盲区
- **needs**：表面需求/深层需求/情感需求
- **judgment**：信任因素/不信任因素
- **patience**：时间预算/注意力阈值
- **behavior**：会点什么/跳过什么

被 **analyzer** 和 **evaluator** 子代理加载。评估文章时，你是这个搜索者在读。

## 知识飞轮

写作系统有两个知识环，互相促进：

### 环 1：写作经验 → author/wiki/

```
/write 产出文章 + raw/feedback/
         ↓
/compile-wiki 编译
         ↓
author/wiki/ 更新（voice、strengths、improvements、patterns）
         ↓
下次写作加载 → 更好的文章
```

### 环 2：领域知识 → content/knowledge/

```
/write 的 researcher 调研素材
         ↓
写入 content/knowledge/{topic}.md（数据源、事实、框架）
         ↓
下次写作的 researcher 读取 → 跳过已知，专注新调研
```

两个环共同作用：经验让文章写得更好，知识让调研更高效。

## 知识时效性

`content/knowledge/` 中的每条事实带时效标签（在 `knowledge.md` 中配置）：

| 标签 | 含义 | 有效期 | 复用规则 |
|------|------|--------|---------|
| `permanent` | 不变的机制/原理 | 永久 | 直接复用 |
| `framework` | 分析框架 | 季度 | 复用框架，验证实例 |
| `regime` | 当前市场状态 | 30天 | **必须重新验证** |
| `event` | 历史事实 | 永久（历史参考） | 作为对比使用 |

## 双轨内容策略

| 维度 | Evergreen | Trending |
|------|-----------|----------|
| 命令 | `/plan-site` | `/plan-trending` |
| 频率 | 季度 | 周级/事件驱动 |
| 规模 | 100+ 篇 | 5-15 篇 |
| 字数 | 2000-4000 | 1500-2500 |
| 类型标记 | `type: evergreen` | `type: trending` |
| 必须字段 | — | `linked_pillar` + `time_sensitivity` + `window_expires` |

Trending 文章**必须**通过 `linked_pillar` 链接到 evergreen pillar：

```
热点事件 → trending 文章 → evergreen pillar → 整个 cluster
              ↑                              |
              └── 搜索流量 ←─────────────────┘
```

## E-E-A-T 信号

系统内置的 E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) 支持：

- **Author byline**：每篇文章自动添加作者署名和简介
- **方法论披露**：drafter 必须包含数据来源和分析方法的说明
- **来源可信度标准**：researcher 按 high/medium/low 评定每个来源
- **事实核查**：evaluator 检查数字准确性、来源一致性、时间一致性
- **内容审查周期**：`last_reviewed` 字段追踪内容验证
- **更正记录**：`corrections` 字段记录事实更正

## 三层架构

```
用户层（commands/）  → 用户看到的入口，/write 是核心
执行层（agents/）    → 子代理在隔离上下文中执行具体步骤
能力层（skills/）    → 专业能力被预加载到子代理
```

关键约束：
- 子代理只有一层深度，不能再嵌套子代理
- 子代理隔离上下文，需要显式传参
- Skills 通过 frontmatter 预加载，用户不可见
