# 命令速查

## 日常使用（高频）

| 命令 | 用途 | 频率 |
|------|------|------|
| `/write` | 写一篇文章（核心命令） | **日度** |
| `/write-batch` | 交互选择多篇，并行写作 | 日度 |
| `/list` | 查看内容状态 | 随时 |

## 规划类

| 命令 | 用途 | 频率 |
|------|------|------|
| `/plan-site` | 常青内容体系（100+篇，8-15 cluster） | 季度 |
| `/plan-trending` | 热点内容规划（5-15篇） | 周级 |

### /plan-trending 参数

```
/plan-trending                 # 默认 --week
/plan-trending --hour          # 小时级快扫（1-3篇）
/plan-trending --day           # 日级规划（3-7篇）
/plan-trending --week          # 周级规划（5-15篇）
/plan-trending --topic "Drift hack"  # 围绕特定话题
/plan-trending --refresh       # 增量更新已有 trending
```

### /write 参数

```
/write slug-name               # 按 slug 写
/write "标题"                   # 按标题写
/write --cluster name          # 取 cluster 下下一篇
/write --update slug           # 更新已有文章
/write --words 3000            # 指定字数
/write --lang zh               # 指定语言
/write --no-evaluate           # 跳过评估
```

### /write-batch 参数

```
/write-batch                   # 交互式选择
/write-batch slug1 slug2       # 直接指定
/write-batch --cluster name    # 指定 cluster
/write-batch --priority P0     # 指定优先级
/write-batch --type trending   # 指定类型
/write-batch --limit 5         # 最多写 5 篇
```

## 维护类

| 命令 | 用途 | 频率 |
|------|------|------|
| `/lint` | 知识库健康检查 | 周度 |
| `/compile-wiki` | 编译 raw/ → author/wiki/ | 按需 |
| `/evolve` | 系统进化 | 月度 |

## 按需使用

| 命令 | 用途 |
|------|------|
| `/init-site` | 初始化新站点 |
| `/sites` | CF Sites 站点管理（查看、连接、配置） |
| `/publish` | 发布文章到 CF Sites CMS |
| `/rewrite` | 改写外部内容 |
| `/evaluate` | 独立评估一篇文章 |
| `/ask` | 对知识库提问 |

## 一次性

| 命令 | 用途 |
|------|------|
| `/create-site` | 从零创建 CF Sites 站点（定位、品牌、视觉、页面配置） |

## 写作管线详解

`/write` 执行的完整步骤：

```
Step 0  定位站点和条目
Step 1  加载公共上下文（persona、wiki、searcher、knowledge）
Step 2  调度 analyzer 子代理（SERP 分析）
Step 3  制定策略（主上下文，结合 persona + analyzer 结果）
Step 4  调度 researcher 子代理（素材收集）
Step 5  调度 drafter 子代理（撰写文章）
Step 5.5 调度 illustrator 子代理（替换 IMAGE 占位符）
Step 6  调度 evaluator 子代理（质量评估）
         → 有具体问题就修复，重新评估（最多 3 轮）
         → 分数 ≥ threshold 但有问题也会修复
Step 7  更新文件（文章、INDEX、backlinks）
Step 8  知识沉淀（researcher 素材 → knowledge/）
Step 8.5 自动发布（如 cf_auto_publish: true，推送到 CF Sites）
Step 9  反思沉淀（经验 → raw/feedback/）
```
