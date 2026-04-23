# 快速开始

## 前置条件

- Claude Code CLI 已安装并登录
- 一个终端

## 1. 初始化站点

```
/init-site https://your-site.com
```

系统会自动抓取首页、提取站点信息、建议 Persona。你需要：

1. 确认或修改 Author persona（作者身份）
2. 确认或修改 Searcher persona（目标读者）
3. 提供 E-E-A-T 信息（作者名、简介、社交链接）

完成后会创建 `sites/{slug}/` 目录结构。

## 2. 规划内容

```
/plan-site
```

系统会研究 SERP、竞品、搜索意图，设计 8-15 个 topic cluster、100+ 篇文章的体系。输出：
- Topic cluster 列表（含优先级）
- 每个 cluster 的 pillar + supporting 文章
- 写作路线图（按优先级排序的前 10 篇）

或者跳过规划，直接写：

```
/write "你的主题"
```

## 3. 写文章

### 单篇写作

```
/write slug-name                # 按 slug 写
/write "关键词工具对比"          # 按标题写
/write --cluster market-structure  # 取 cluster 下下一篇
```

管线自动执行：分析 → 策略 → 调研 → 写作 → 配图 → 评估 → 修复 → 保存。

### 批量写作

```
/write-batch                   # 交互式选择多篇，并行写作
```

## 4. 查看状态

```
/list                          # 全景概览
/list --planned                # 只看待写的
/list --completed              # 只看已完成的
/list --cluster market-structure  # 某 cluster 详情
```

## 5. 发布

```
/publish slug-name             # 生成 schema、og:image、SEO audit
```

## 6. 维护

```
/lint                          # 知识库健康检查
/compile-wiki                  # 编译写作经验到知识库
/evolve                        # 系统性进化（月度）
```

## 日常工作流

```
周一：/plan-trending           # 规划本周热点内容
日常：/write-batch             # 批量写作
周度：/lint                    # 知识库健康检查
月度：/evolve                  # 系统进化
```

## Obsidian 集成

项目根目录是一个 Obsidian vault。直接用 Obsidian 打开 `writing_bro/` 目录即可。

- **图谱视图**：配置 Groups 按 `[status:completed]` / `[status:planned]` 着色
- **DASHBOARD.md**：各站点目录下有 Dataview 看板
- **CSS snippet**：`.obsidian/snippets/content-status.css` 给完成/计划文章不同颜色
