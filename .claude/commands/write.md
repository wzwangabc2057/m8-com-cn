---
description: 核心写作编排器，调度子代理完成分析→策略→调研→写作→配图→评估全流程
---

纯编排角色：加载配置、调度子代理、传递数据、更新文件。自己不写内容。

## 输入

$ARGUMENTS — 必填，可以是：
- slug：`keyword-tools-comparison`
- 标题：`"关键词工具对比"`
- `--cluster name`：取该 cluster 下下一个 planned stub
- `--update slug`：更新已有文章

可选：`--words 3000` `--lang zh` `--no-evaluate`

## 流程

### Step 0：定位站点和条目

1. 读取 CLAUDE.md，解析 `active_site:` → `{site}`
2. 读取 `{site}/config.md`，提取 language、default_words、quality_threshold、author_name、author_bio_short
3. 解析 $ARGUMENTS，Glob `content/**/{slug}.md` 查找条目：
   - 找到 stub → 标记为 stub 模式
   - 找到 completed entry → 标记为更新模式
   - 没找到 → 标记为新创建

### Step 1：加载公共上下文

读取以下文件，准备传给子代理的路径和摘要：

- `{site}/author/persona.md` → persona 路径
- `{site}/author/wiki/INDEX.md` → wiki 路径 + 摘要
- `{site}/searcher.md` → searcher 路径 + 摘要
- `{site}/content/INDEX.md` → 内容全貌摘要
- 如有 stub：读取规划笔记
- 如有相关已有 entries：Grep 搜索含 `published_url` 的条目，读取 3-5 个最相关已发布文章
- `{site}/content/knowledge/INDEX.md` → 知识库索引，根据 cluster 和 target_keywords 找到相关主题

### Step 2：调度 analyzer 子代理

使用 Agent 工具生成 analyzer 子代理，传入：

```
- searcher_path: {site}/searcher.md
- config_path: {site}/config.md
- content_index_path: {site}/content/INDEX.md
- topic: {topic}
- target_keywords: {从 stub 或参数获取}
- raw_path: {site}/raw/research/YYYY-MM-DD-{slug}.md
```

等待返回：SERP 分析 + 内容缺口 + 差异化机会。

### Step 3：制定策略（主上下文）

读取 `{site}/author/persona.md`，获取 Author 的核心信念和专业边界。

基于 analyzer 返回的结果 + persona，制定策略：

**提取内容范围边界**（从 topic/title 提取，硬约束）：
- 品类限定（如 "Action RPG" ≠ "RPG"）
- 平台限定、时间限定、格式限定
- hard_constraints 列表

**制定创作策略**：
- 独特视角：结合 persona 信念和 analyzer 缺口，为什么读者该看你的
- 差异化方向
- 写作大纲
- 应引用的已有 entries（内链规划）
- 确定 cluster 归属（参见 CLAUDE.md "Cluster 归属规则"）

**规划研究方向**（传给 researcher）：
- 站内调研（如有 domain，至少一个 `site:{domain}` 方向）
- 外部调研 2-3 个方向

如已有 stub，以规划笔记为基础，结合分析微调。

### Step 4：调度 researcher 子代理

使用 Agent 工具生成 researcher 子代理，传入：

```
- persona_path: {site}/author/persona.md
- wiki_path: {site}/author/wiki
- content_path: {site}/content
- strategy: {策略摘要}
- research_directions: {从策略输出的调研方向}
- raw_research_path: {site}/raw/research/YYYY-MM-DD-{slug}.md
- knowledge_path: {site}/content/knowledge
- knowledge_config_path: {site}/knowledge.md
```

等待返回：素材库（含 ref_ids）+ 引用表。

### Step 5：调度 drafter 子代理

使用 Agent 工具生成 drafter 子代理，传入：

```
- persona_path: {site}/author/persona.md
- wiki_path: {site}/author/wiki
- strategy: {策略}
- materials: {素材库}
- existing_entries: {相关已有条目列表}
- searcher_summary: {searcher 摘要}
- content_scope: {内容范围边界}
- target_words: {字数}
- language: {目标语言}
- current_date: {当前日期}
- cluster: {cluster 名}
- slug: {slug}
- reference_table: {从 researcher 返回的 references}
- content_index_path: {site}/content/INDEX.md
- author_attribution: "{author_name} | {author_bio_short}"
```

drafter 预加载了 link-builder、seo 能力，返回含 `[IMAGE: ...]` 占位符的文章。

等待返回：完整文章（含占位符）+ SEO 元数据 + 实际字数。

### Step 5.5：调度 illustrator 子代理

使用 Agent 工具生成 illustrator 子代理，传入：

```
- article_path: {含占位符的完整文章}
- cluster: {cluster 名}
- slug: {slug}
```

illustrator 预加载了 illustration 能力，替换所有 `[IMAGE: ...]` 占位符为实际配图。

等待返回：含实际配图的完整文章。

### Step 6：评估循环

如 `--no-evaluate`，跳过此步。

使用 Agent 工具生成 evaluator 子代理，传入：

```
- searcher_path: {site}/searcher.md
- config_path: {site}/config.md
- wiki_patterns_path: {site}/author/wiki/patterns/
- article_content: {文章}
- target_keywords: {关键词}
- language: {目标语言}
```

等待返回：评估分数 + 反馈。

**只要 evaluator 提出了具体问题（priority_issues 或 quick_wins），就必须修复。**

- 读取 `{site}/author/persona.md`，以 Author 身份修订
- **充分理解文章和每条修改意见的语境**：这条反馈针对哪个段落、上下文逻辑是什么、修改后对周围论证的影响。不是机械替换文字，是在理解全文论证结构的基础上精准修改
- 保持 Author 风格，只改反馈指出的问题，不做无关修改
- 修复后重新调度 evaluator 评估
- 最多 3 轮

**分数的作用**：
- `< quality_threshold`：问题可能涉及论证结构或核心逻辑，需要更大幅度的修改
- `≥ quality_threshold`：问题通常是局部的（事实不一致、时间戳错误、重复链接等），精准修复即可
- **两种情况都不跳过修复**

### Step 7：更新知识库

- 将最终文章写入 `{site}/content/{cluster}/{slug}/{slug}.md`（先 `mkdir -p {slug}/`）
- 更新 frontmatter：status: completed, score, revision_rounds, actual_words, updated, seo_title, seo_description, last_reviewed（设为当天）
- 如修改了已完成文章的事实内容（非风格调整），在 frontmatter 的 `corrections` 中追加更正记录
- 更新 `{site}/content/INDEX.md`（状态统计变化）
- 实时更新被引用 entries 的"被引用于"列表

### Step 8：知识沉淀

将 researcher 返回的可复用知识写入全局知识库 `{site}/content/knowledge/`：
- 提取新发现的数据源、验证过的事实、分析框架
- 写入对应的主题文件（如已存在则追加，如不存在则创建）
- 更新 `knowledge/INDEX.md`（如创建了新主题）
- 事实按时效标签分类：permanent / framework / regime / event

### Step 8.5：自动发布

如 config.md 中 `cf_auto_publish: true`，执行发布流程：

1. 读取 `{site}/.env` 获取 `CF_CMS_TOKEN`
2. **扫描文章中所有本地图片引用**（正则 `![...](filename)` 匹配 .jpg/.png/.webp/.svg/.gif）
3. **逐个上传所有图片到 CF Sites**：每张图调用 `POST /api/assets?siteId={cf_site_id}`，拿到 `publicUrl`，记录本地文件名 → publicUrl 映射表
4. 将文章 markdown 转换为 HTML（处理标题、段落、列表、加粗、链接），**将所有本地图片路径替换为对应的 publicUrl**
5. **设置 coverImage 并去重**：
   - coverImage = 第一张图片的 publicUrl（优先 hero.jpg/hero.webp）
   - **从 HTML content 中移除与 coverImage 相同的 `<img>` 标签**，避免头图在正文重复显示
6. 构建 post JSON（映射关系同 `/publish` 命令 Step 2.2）
7. 调用 `POST {cf_cms_url}/api/posts?siteId={cf_site_id}` 发布
8. 成功：在 frontmatter 中追加 `published_url` 和 `published_at`
9. 失败：**不影响本地保存**，提示用户稍后手动 `/publish slug` 重试

**关键**：所有图片类型都要上传（Stock 照片、SVG 插图、数据图表），CF Sites 不会自动下载本地路径引用的图片。如果文章仍有 `[IMAGE: ...]` 未替换的占位符（说明配图步骤失败），**先报错停止，不发布无图文章**。

### Step 9：反思沉淀

将经验数据追加到 `{site}/raw/feedback/YYYY-MM-DD-{slug}.md`：
- 评估分数和各维度分数
- 修改了什么（每轮反馈要点）
- 什么做得好（可复用模式）
- 什么可以改进

### 输出

```
✓ content/{cluster}/{slug}/{slug}.md 已创建/更新
✓ 评估分数：87/100（1 轮修改）
✓ 引用 N 篇已有 entries，更新 M 个 backlinks
✓ 已发布到 https://{domain}/{slug}
```
