---
description: 批量发布多篇已完成文章到 CF Sites CMS
---

批量发布 Writing Bro 文章到 CF Sites CMS。适用于 `/write-batch` 完成后的场景。

## 输入

$ARGUMENTS — 可选：
- 空：交互式选择待发布文章
- `slug1 slug2 slug3`：直接指定多篇
- `--cluster name`：指定 cluster 下所有 completed 文章
- `--all`：发布所有 completed 但未发布的文章
- `--draft`：全部发布为草稿（默认直接 published）
- `--force`：包含非 completed 状态的文章

## 流程

### Step 0：加载配置

1. 读取 CLAUDE.md → `{site}`
2. 读取 `{site}/config.md` → 提取 `cf_cms_url`、`cf_site_id`、`author_name`、`author_bio_short`、`domain`
3. 读取 `{site}/.env` → 提取 `CF_CMS_TOKEN`
4. 验证三个配置都存在，缺任何一个则报错并提示配置方法

### Step 1：确定待发布列表

**如果 $ARGUMENTS 直接指定了 slug 列表**：跳过筛选，直接进入 Step 3。

**如果 `--all`**：扫描所有 status: completed 且没有 `published_url` 的文章，直接进入 Step 3。

**否则，交互式筛选**：

#### 1.1 扫描已完成文章

扫描 `{site}/content/` 下所有文章：
- `status: completed` 且没有 `published_url` → 待发布
- `status: completed` 且有 `published_url` → 已发布（`--force` 时包含）
- 其他状态 → 忽略（`--force` 时包含 completed 以外的也提示确认）

#### 1.2 展示候选列表

```
待发布文章（N 篇）：

 1. btc-funding-rate-signal (market-structure, ~3000w)
 2. sanctions-crypto-adoption (geopolitical-risk, ~3500w)
 3. compliance-competitive-advantage (regulation-policy, ~2500w)
 ...
```

#### 1.3 选择

使用 AskUserQuestion（multiSelect: true）让用户选择要发布的文章。条目多时提供 "全部" 快捷选项。

### Step 2：确认

展示发布清单，使用 AskUserQuestion 确认：

> "将发布以下 N 篇文章到 {domain}。开始？"
> - 开始发布
> - 让我调整

### Step 3：批量发布

对每篇文章，按 `/publish` 的 Step 1-6 顺序执行：
1. 读取文章，解析 frontmatter 和正文
2. Markdown → HTML 转换
3. 上传所有配图（hero + 正文图片）
4. 调用 API 发布
5. 确认发布成功
6. 更新 frontmatter（`published_url`、`published_at`）

**并发控制**：使用 Agent 工具（subagent_type: general-purpose, run_in_background: true）并行发布，最多 3 个同时进行。

每个 agent 接收完整发布指令：

```
你是发布代理。将文章 {slug} 发布到 CF Sites CMS。

站点路径：{site_path}
文章路径：{article_path}

先从 {site_path}/.env 读取 CF_CMS_TOKEN，从 {site_path}/config.md 读取 cf_cms_url、cf_site_id、domain、author_name 等配置。
然后参考 /publish command 的完整流程执行（读取 .claude/commands/publish.md 获取 Cluster → Category 映射表和详细转换规则）。

核心步骤：
1. 读取文章，解析 frontmatter 和正文
2. 将 Markdown 正文转为 HTML（先图片再链接）
3. 扫描文章目录中所有被引用的本地图片，逐个上传到 CF Sites（POST /api/assets?siteId={siteId}）
4. 替换 HTML 中的本地图片路径为 publicUrl
5. 设置 coverImage（优先 hero.jpg/webp 的 publicUrl）
6. 从正文 HTML 中移除与 coverImage 相同的图片（避免重复）
7. Cluster → Category 映射（参考 /publish skill 的映射表）
8. 调用 POST /api/posts?siteId={siteId} 发布（upsert）
9. 确认 API 返回 success: true
10. 更新文章 frontmatter：published_url、published_at

完成后返回：slug、发布 URL、status、coverImage、categories、tags。
```

### Step 4：汇总结果

```
批量发布完成（N/M 篇）

✓ btc-funding-rate-signal → https://domain.com/btc-funding-rate-signal
✓ sanctions-crypto-adoption → https://domain.com/sanctions-crypto-adoption
✗ compliance-competitive-advantage — 失败: API 401 token 无效

成功: 2 | 失败: 1
```

失败的文章保留本地状态，可稍后 `/publish slug` 单独重试。

## 错误处理

- **配置缺失**：同 `/publish`，报错并提示配置方法
- **单篇失败不影响其他**：某篇上传或 API 调用失败，记录错误，继续发布其余文章
- **API 401/404**：同 `/publish` 的错误处理，汇总到最终结果中
