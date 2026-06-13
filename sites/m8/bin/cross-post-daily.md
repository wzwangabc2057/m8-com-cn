# 每日自动 cross-post workflow（Claude Code headless 执行）

被 `com.m8.cross-post-daily` launchd 每天 10:30 触发。把当天 m8 已发文章中**真正适合公众号订阅场景**的内容挑出来，改写成两个公众号调性，推到草稿箱。

**总原则**：站点优先，公众号跟随。公众号只做二次分发，不能反向主导 m8 的选题和站点结构。

## 前置依赖

- m8 当天 09:00 那批必须已发完（10:30 跑给足 buffer）
- bastion 156.254.5.155:29100 可达
- 两个公众号 .env 凭据有效

## 完整流程

### Step 0：环境自检
1. `python3 sites/kangge/bin/wechat_publish.py --selftest` 应 all checks passed
2. `python3 sites/kangbing-suiji/bin/wechat_publish.py --selftest` 应 all checks passed
3. 任一 fail → 写 log 跳过当天，**不通知用户**

### Step 1：拉当天 m8 已发文章
```bash
TOKEN=$(grep CF_CMS_TOKEN sites/m8/.env | cut -d= -f2 | tr -d '"')
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://cloudflare-sites-cms.pages.dev/api/posts?siteId=m8.com.cn&page=1&pageSize=25"
```
- 过滤 `publishedAt` = 今天（北京时间）的文章
- **若今天发布数 = 0** → 直接写 log 跳过当天

### Step 2：选题，不强求每天都发

**默认目标**：
- 每天 `0-2` 篇总量
- 单个号每天最多 `1` 篇
- 可以 `0` 篇，前提是当天没有足够强的候选
- 如果当天 m8 没有真正值得分发的 pillar / insight，就宁可不发

**选题规则**（重要，决定调性匹配）：
- **kangge（中美观察康哥）** 收 `0-1` 篇，优先级：
  1. A 股 / 美股核心个股 deep，且能给出明确判断
  2. 有争议点或反共识角度的行业 / 跨市场对比
  3. 避开纯 AI 算力硬核（那是糠饼的）
- **kangbing-suiji（糠饼随记）** 收 `0-1` 篇，优先级：
  1. AI 算力 / 半导体 / 光通信 deep（糠饼本职）
  2. 机器人零部件 / 半导体设备 / 材料 deep
  3. 需要工程视角拆解的产业链文章
  4. 避开纯消费 / 医药 / 宏观 / 泛新闻汇总

**硬性排除**：
- `categories` 含 `investing-101` 的（101 科普不适合公众号，互动差）
- slug 在 `sites/m8/raw/cross-post-log.md` 最近 14 天已 cross-post 过的（去重）
- 标题像纯搜索词堆砌、没有明确结论的
- 纯信息汇总 / 纯新闻搬运 / 没有新增判断的
- 和最近 7 天已推主题高度重复的
- 只是为了补公众号频次而硬选的

**关键词门槛**：
- kangge：标题必须有 1-2 个锚关键词（公司 / 板块 / 事件），但不能牺牲可读性
- kangbing-suiji：标题必须有具体工艺 / 零部件 / 公司名，禁止只写泛词“AI”“算力”

### Step 3：从 CMS 拉选中文章的完整内容
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://cloudflare-sites-cms.pages.dev/api/posts/{slug}?siteId=m8.com.cn" \
  -o /tmp/m8_cms_{slug}.json
```
（注意：远程 launchd 发布的文章**不归档本地 .posted**，必须从 CMS 拉）

### Step 4：dispatch 改写 sub-agent（按入选篇数并行）

每个 (slug × target) dispatch 一个 general-purpose sub-agent，prompt 包含：
- 源 JSON 路径 `/tmp/m8_cms_{slug}.json`
- 目标 persona：
  - kangge A股个股 → `sites/kangge/author/personas/kangge.md`（第一人称 30-40%）
  - kangge 宏观/对比 → `sites/kangge/author/personas/bianjibu-zmgc.md`（编辑部）
  - kangbing → `sites/kangbing-suiji/author/personas/kangbing.md`（硬核研究员）
- style：对应目标号自己的 style.md
- keyword brief：对应目标号自己的 `content/keyword-research.md`
- audience：对应站点 `audience.md`
- 改写约束：保留所有数字/标的代码/数据来源；HTML 裸标签→inline style；去掉 `<sup>[N]</sup>` / 内链 / SVG / m8 身份词
- 先输出核心判断 / 读者收益 / 监控变量，再组织正文
- 输出 HTML 到 `/tmp/cross-{slug}-to-{target}.html` + 返回 JSON `{title, digest(≤120字), html_path, word_count, author_display}`

### Step 5：下载 cover（复用 m8 hero）
```bash
cov=$(python3 -c "import json;d=json.load(open('/tmp/m8_cms_{slug}.json'));d=d.get('post',d);print(d.get('coverImage',''))")
# 统一转 jpg（PNG 偶发草稿不落库，见 cross-post 经验）
curl -s -o /tmp/cross-{slug}-cover.orig "$cov"
python3 -c "from PIL import Image;Image.open('/tmp/cross-{slug}-cover.orig').convert('RGB').save('/tmp/cross-{slug}-cover.jpg','JPEG',quality=88)"
```

### Step 6：push 到草稿箱
```bash
python3 sites/{target}/bin/wechat_publish.py \
  --slug cross-{slug}-{target}-{YYYYMMDD} \
  --title "{改写标题}" --html-file /tmp/cross-{slug}-to-{target}.html \
  --thumb-file /tmp/cross-{slug}-cover.jpg \
  --author "{kangge:中美观察康哥/编辑部 | kangbing-suiji:糠饼}" \
  --digest "{改写摘要}"
```

### Step 7：**二次验证（关键，不可省）**
push 返回 DRAFT_OK ≠ 草稿落库。对每个 target 调 draft/batchget 按**标题**确认：
```python
# 经 bastion：拿 token → POST cgi-bin/draft/batchget {offset:0,count:5,no_content:1}
# 在返回 item[].content.news_item[0].title 里找改写后的标题
```
- 找到 → 标记成功
- 没找到 → **重推一次**（PNG→JPG 已规避主因），再验证；仍失败则记 log

### Step 8：写 log + 去重记录
1. 追加到 `sites/m8/raw/cross-post-log.md`：每行 `YYYY-MM-DD {slug} → {target} | {verified ok/fail}`
2. 写运行 log 到 `sites/m8/bin/cross-post-daily.log`：日期 / 实际选中 slug / push 结果 / 验证结果
3. **不通知用户**（silent，跟 m8-auto-daily 一致）

## 失败处理
| 场景 | 处理 |
|------|------|
| 当天 m8 发布 < 5 篇 | 跳过，log 记"m8 未就绪" |
| selftest fail | 跳过，log 记凭据问题 |
| 某篇改写 sub-agent 崩 | 跳过该篇，其他继续 |
| push 后验证没落库 | 重推 1 次，再失败记 log |
| 全部候选都不够好 | 当天 0 篇，log 明确记“宁缺毋滥，跳过” |
