---
name: illustration
description: 为文章配图，支持 Stock 照片、SVG 插图、数据图表三种类型
user-invocable: false
---

为文章选择和生成最合适的配图。

## 站点视觉风格

生成 SVG 或数据图表前，先加载站点的视觉风格配置：

1. 从文章路径提取站点路径：`sites/{site}/content/...` → `sites/{site}/`
2. 读取 `sites/{site}/config.md`，查找 `visual_style` YAML 块
3. 如找到，使用站点指定的颜色、字体、图表配色
4. 如未找到，使用默认调色板：

```
Default palette:
  primary: "#4361ee"
  primary_dark: "#3a0ca3"
  heading: "#0f172a"
  text: "#334155"
  text_muted: "#64748b"
  accent: "#7c3aed"
  bg_light: "#f8fafc"
  bg_dark: "#1e293b"
  gradient: "#4361ee → #7c3aed"
  chart_palette: ["#4361ee", "#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"]
  font: "system-ui, -apple-system, sans-serif"
```

所有 SVG 插图和数据图表必须使用站点配色。Stock 照片不受此约束。

## 类型决策

对每个配图位置，判断最适合的类型：

| 位置需求 | 类型 | 方式 |
|----------|------|------|
| 氛围/场景/视觉呼吸 | Stock 照片 | WebSearch site:unsplash.com/pexels.com |
| 简单流程/概念（<10 节点） | SVG 插图 | 直接生成 SVG 代码 |
| 数据对比/趋势/分布 | 数据图表 | HTML + Chart.js → SVG 导出 |

**原则**：优先选信息增量高的类型。独特图表 > SVG 插图 > Stock 照片。

---

## 配图密度与位置

### 数量

- **基础密度**：每 800-1000 字 1 张图
- 3000 字文章 ≈ 3-4 张图
- 首图必配（H1 后或文章开头）
- 不要为了凑数而插图——每张图必须有信息增量或视觉呼吸作用

### 位置策略

1. **首图**（必须）：H1 后、正文开始前，奠定基调。优先 Stock 照片
2. **概念/流程节点**：长段落中解释复杂概念时，用 SVG 拆解
3. **数据支撑点**：出现对比、排名、趋势时，用数据图表
4. **视觉呼吸**：连续 1000+ 字无图的长文段，插入一张 Stock 或 SVG 缓解阅读疲劳

### 避免的位置

- ❌ 不要在列表项内插图
- ❌ 不要连续两张图紧挨（中间至少隔 200 字）
- ❌ 不要在表格前后紧挨插图

---

## A. Stock 照片

1. 用英文关键词 WebSearch：`site:unsplash.com {keywords}` 或 `site:pexels.com {keywords}`
2. WebFetch 结果页获取候选图片（URL + 描述）
3. 选择标准（按优先级）：
   - **内容匹配度** — 准确传达段落核心概念
   - **非付费** — 排除 Unsplash+ / Premium
   - **画面质量** — 构图清晰、色彩和谐
   - **独特性** — 避免"人在笔记本前"等烂大街图
   - **多样性** — 同篇文章几张图风格不雷同
4. 插入格式：
```markdown
![alt 文字（目标语言，含关键词）](hero.jpg)
*图片来源: [摄影师](页面URL) on [Unsplash](https://unsplash.com)*
```

**Stock 照片必须下载到文章目录并转为 WebP**：
1. 下载 JPG：`curl -L -o /tmp/{slug}-{name}.jpg "URL"`
2. 转换 WebP：`cwebp -q 80 -resize 1200 0 /tmp/{slug}-{name}.jpg -o content/{cluster}/{slug}/{slug}-{name}.webp`
3. 如果 `cwebp` 不可用，保留 JPG 并用 `sips` 或 `magick` 压缩到 1200px 宽
4. 命名规则：`{slug}-hero.webp`（首图）、`{slug}-{keyword}.webp`（其他）
5. 引用使用同目录相对路径：`{slug}-hero.webp`（无前缀）
6. Markdown 中引用 `.webp` 文件，不引用 `.jpg`
7. 保留归属信息（photographer credit + Unsplash 链接）

**alt 文字必须用目标语言，包含相关关键词（SEO 价值）。**

---

## B. SVG 插图

### 常用模式

根据内容需要选择合适的 SVG 模式：

| 模式 | 适用场景 | 结构 |
|------|---------|------|
| **流程图** | 步骤/流程/工作流 | 矩形节点 + 箭头连线，从上到下或从左到右 |
| **对比图** | A vs B、优缺点 | 左右两栏布局，中间分隔线 |
| **层级图** | 分类/架构/组织 | 树状结构，顶层居中，子节点展开 |
| **步骤图** | 教程/指南 | 横向编号圆圈 + 连线 + 简短标签 |
| **循环图** | 迭代/飞轮/闭环 | 圆形排列节点 + 循环箭头 |
| **矩阵图** | 四象限/优先级 | 2×2 网格 + 坐标轴标签 |

### 设计规范

1. 设计图形结构（节点 + 连线 + 标签）
2. 生成 SVG 代码，保存到 `content/{cluster}/{slug}/{name}.svg`
3. 设计要求：
   - **配色使用站点 visual_style**（见"站点视觉风格"节），深色文字浅色背景
   - **标签用目标语言**，字号 ≥14px（移动端可读）
   - viewBox 设为合理比例（如 `0 0 800 400`），宽度不超 800px
   - 使用站点指定的字体（默认 `system-ui, -apple-system, sans-serif`）
   - 文件名用 slug 前缀：`{slug}-{keyword}.svg`
4. 插入格式：
```markdown
![流程描述]({name}.svg)
```

---

## C. 数据图表

数据图表必须有**真实数据**，不能编造。

### 工具链

1. **检查环境**：用 Bash 检查 `node --version` 和 `npx --version`
2. **写 HTML 文件**：内嵌 Chart.js（CDN），数据直接写入
3. **导出方式**（按优先级尝试）：

   **方式 1：SVG 直出（首选）**
   - Chart.js 4.x 支持 `chart.toBase64Image()` 和 SVG 插件
   - 用 Node.js 脚本调用 chartjs-node-canvas 生成 PNG/SVG
   - 如果 node 可用，直接写一个渲染脚本用 `npx` 执行

   **方式 2：Playwright 截图**
   - 用 Playwright 打开 HTML 文件并截图
   - 需要 Playwright 已安装（`npx playwright install chromium`）

   **方式 3：纯 SVG 手写（降级）**
   - 当 Node.js / Playwright 都不可用时
   - 直接用 SVG 原语画简单柱状图、饼图
   - 适合数据点少（≤8 个）的简单图表

4. 保存到 `content/{cluster}/{slug}/`，文件名 `{slug}-{chart-name}.svg` 或 `.png`
5. **每张图表必须标注数据来源**

### 插入格式

```markdown
![图表描述（目标语言，含关键词）]({filename}.svg)
*数据来源: [来源名](URL)*
```

### 数据图表免责声明

所有生成的数据图表必须在图片底部（SVG 内部）包含免责声明文字：

- 文字：`Illustrative representation based on reported data`（或目标语言的等价表述）
- 字号：≥10px，颜色浅于主文字（如 `#888` 或 `#999`）
- 位置：图表底部，不遮挡数据区域

这确保读者不会将示意图误认为精确到像素的数据快照，同时保持 E-E-A-T 信任度。

---

## 降级策略

| 场景 | 降级方案 |
|------|---------|
| Playwright 不可用 | 用方式 3（手写 SVG），或跳过数据图表用文字描述 |
| Node.js 不可用 | 所有图表改为手写 SVG |
| 搜不到合适的 Stock 图 | 跳过该位置的 Stock 图，不硬凑 |
| Unsplash/Pexels 搜索失败 | 跳过 Stock 图，考虑用 SVG 替代 |
| 图表数据不足 | 不画图表，用表格或文字呈现数据 |

**原则**：配图是增强而非必须。宁可少一张图，不要凑一张低质量图。

---

## 共同规范

- 所有 alt 文字、标题、标签用目标语言
- 文件名用英文 slug
- Stock 图片宽度参数 `w=1200`，质量 `q=80`，存储为 WebP（`cwebp -q 80 -resize 1200 0`）
- 每张图底部标注来源/数据出处
- SVG 优先于 PNG（矢量可缩放，文字可被搜索引擎索引）
