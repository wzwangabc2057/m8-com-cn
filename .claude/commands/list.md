---
description: 查询内容状态
---

查看站点内容的规划和完成状态。

## 输入

$ARGUMENTS — 可选筛选条件：
- 空：显示当前活跃站点的完整内容概览
- `--planned`：只看待写的
- `--completed`：只看已完成的
- `--orphan`：找孤立条目（无引用无被引用）
- `--cluster <name>`：某个 cluster 的详情
- `--priority P0|P1|P2`：按优先级筛选
- `site-name`：指定站点（默认活跃站点）

## 流程

### 1. 定位站点

- 读取 CLAUDE.md 找活跃站点
- 或从 $ARGUMENTS 解析站点名

### 2. 读取数据

- 读取 `content/INDEX.md` — 全景图
- 如需详细信息，读取对应 cluster 的 `INDEX.md`
- 如需孤立条目分析，扫描 `content/**/*.md` 检查 backlinks

### 3. 格式化输出

按以下格式展示：

```
站点: {name} | 已完成: X | 待写: Y | 总计: Z

Cluster: {name}
  ✓ [[entry-a]]  (score: 87, 2024-04-10)
  ○ [[entry-b]]  (P1, 预估 3000 字)
  ○ [[entry-c]]  (P2, 预估 2500 字)

Cluster: {name}
  ✓ [[entry-d]]  (score: 92, 2024-04-08)
  ○ [[entry-e]]  (P0, 预估 4000 字)

建议下一篇: [[entry-e]]（P0 优先级）
```

### 4. 额外分析（如有筛选参数）

- `--orphan`：列出没有引用也没有被引用的条目，建议关联方向
- `--planned`：按优先级排序，高亮建议下一篇
- `--cluster`：展示 cluster 内部依赖和推荐写作顺序
