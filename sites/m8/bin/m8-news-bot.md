# m8 新闻自动化 workflow（Claude Code 执行）

这是一个**给 Claude Code 看的指令文档**。当被 `/schedule` 或手动调用时，Claude 按下面流程执行。

## 调用方式

### 方式 A：手动单次跑

在 Claude Code 里粘贴下面 prompt：

```
读 sites/m8/bin/m8-news-bot.md，按其中"flash 模式"流程执行一次。
```

### 方式 B：用 /schedule 注册定时任务（推荐）

```
/schedule create
  name: m8-news-bot-flash
  cron: */30 9-15 * * 1-5     # 工作日盘中每 30 min（北京时间）
  prompt: |
    读 /Users/kangbing/112/pythonindex/writing_bro/sites/m8/bin/m8-news-bot.md
    按其中"flash 模式"流程执行一次：拉 8086 新闻、筛选高信号、并发 dispatch Agent 写 flash 短评、POST 到 m8 CMS、更新 state。

/schedule create
  name: m8-news-bot-digest
  cron: 0 18 * * 1-5           # 工作日 18:00 北京时间日综评
  prompt: |
    读 sites/m8/bin/m8-news-bot.md
    按"digest 模式"执行：聚合当日新闻、用 m8 编辑部 voice 写 1500-2000 字日综评、POST 到 CMS。
```

### 方式 C：用 /loop 持续循环（开发调试用）

```
/loop 30m 读 sites/m8/bin/m8-news-bot.md，按 flash 模式执行一次
```

---

## 共享配置

```yaml
站点路径:    /Users/kangbing/112/pythonindex/writing_bro/sites/m8/
.env 路径:   sites/m8/.env       # 含 API_8086_TOKEN / CF_CMS_TOKEN
state 路径:  sites/m8/bin/news_bot_state.json   # 已发布新闻 id 去重
log 路径:    sites/m8/bin/news_bot.log

8086 API:
  - x-custom-token (CLS / xgb): /api/v1/queryClsData, /api/v1/queryXgbNews
  - X-Access-Token (开放接口):  /open/quant/queryUsStockNews, /open/quant/queryHkStockNews

CMS API:    https://cloudflare-sites-cms.pages.dev/api
站点 ID:    m8.com.cn
```

---

## 已发表文章列表（用于内链）

写新闻时如果命中以下关键词，**至少加 1 个**对应内链 `<a href="/article/{slug}">`：

| 关键词 | slug |
|---|---|
| 中际旭创 / 300308 | zhongji-xuchuang-300308-2025-deep |
| Palantir / PLTR | palantir-pltr-ai-os-deep |
| NVIDIA / NVDA | nvidia-fy2026-system-level-deep |
| MSTR / MicroStrategy | mstr-bitcoin-treasury-2026-deep |
| Tesla / TSLA | tesla-q1-2026-fsd-vs-profit |
| 新易盛 / 300502 | xinyisheng-300502-deep |
| 天孚通信 / 300394 | tianfu-300394-deep |
| 中远海控 / 1919.HK | cosco-1919hk-shipping-cycle-insight |
| 宁德时代 / 300750 | catl-300750-deep |
| Microsoft / MSFT | msft-fy2026-ai-stack-deep |
| 腾讯 / 0700.HK | tencent-700hk-2026-deep |
| AI Capex / 4950 亿 | global-ai-capex-4950b-2026-insight |
| 美联储 | fed-rate-path-2026-insight |
| 美元 / DXY | usd-cycle-2026-deep |
| BTC ETF | btc-spot-etf-1year-deep |
| Pectra / Fusaka / ETH | eth-pectra-fusaka-roadmap-deep |
| 半导体 / HBM4 | semiconductor-cycle-2026-deep |

---

## 信号评分规则

每条新闻打分，**≥ 5 分**才考虑写。每次最多取 **top 3** 写 flash。

```
+2 分：标题或内容含"财报/营收/净利润/Capex/降息/加息/出口管制/制裁/业绩/IPO/回购/分红"
+2 分：含"AI/GPU/光模块/HBM/1.6T/BTC/ETH/ETF"
+3 分：命中已发表文章关键词（强相关 → 适合做内链）
+1~5 分：含具体数字（"亿/万/%/美元"）— 越多越高
-5 分：标题 < 10 字
-3 分：内容 < 50 字
```

---

## flash 模式流程（每 30 min 工作日盘中）

### Step 1：拉数据（Bash）

```python
import urllib.request, json, os
from pathlib import Path

# 加载 .env
env = {}
with open(Path('sites/m8/.env')) as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v

token_8086 = env['API_8086_TOKEN']

def post(url, data, headers):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

# A 股选股宝
xgb = post('http://156.254.5.245:8086/api/v1/queryXgbNews',
           {'limit': 20},
           {'x-custom-token': token_8086, 'Content-Type': 'application/json'})

# 美股
us = post('http://156.254.5.245:8086/open/quant/queryUsStockNews',
          {'page': 1, 'pageSize': 20},
          {'X-Access-Token': token_8086, 'Content-Type': 'application/json'})

# 港股
hk = post('http://156.254.5.245:8086/open/quant/queryHkStockNews',
          {'page': 1, 'pageSize': 20},
          {'X-Access-Token': token_8086, 'Content-Type': 'application/json'})

# CLS 财联社
cls = post('http://156.254.5.245:8086/api/v1/queryClsData',
           {'limit': 20},
           {'x-custom-token': token_8086, 'Content-Type': 'application/json'})
```

### Step 2：dedup + 评分

读 `sites/m8/bin/news_bot_state.json` 中的 `published_news_ids`。每条新闻用 `{source}:{id}` 作 key。

按上面"信号评分规则"打分，filter ≥ 5，取 top 3。

### Step 3：并发 dispatch Agent 写 flash

对每条 top 新闻 dispatch 一个 `general-purpose` Agent（**run_in_background=true**），prompt 模板：

```
你是 m8 AI drafter。写"{news.title}"短评 flash，**作者：m8 编辑部**。

仅 draft：保存到 /tmp/m8_news_out/{slug}.json，**不要 POST**。

## m8 编辑部 voice
读 sites/m8/author/personas/m8-bianjibu.md。
信息密度高 / 短段落 / 事件驱动 / 直接给数字 / 时间戳明确。

byline:
<p style="color:#444;font-size:13px;margin-top:24px;font-style:italic;">
By <strong>m8 编辑部</strong>。关注时效性资讯与跨市场综述。
</p>

## 新闻数据
来源：{news.source}
时间：{news.ts}
关联标的：{news.stock}
标题：{news.title}
内容：{news.content[:1500]}

## 内链候选（命中即引用）
{matched_internal_links}    # 如 [("中际旭创","zhongji-xuchuang-300308-2025-deep")]

## flash 结构（200-400 字）
H2 1：事件 — 标题 + 关键数字
H2 2：影响 / 传导 — 1-2 个层次（直接 / 间接）
H2 3：关注点 / 下一观察节点

## 输出 JSON
{
  "siteId": "m8.com.cn",
  "slug": "{slug}",
  "title": "≤55 字符",
  "excerpt": "100-150 字摘要",
  "author": "m8-bianjibu",
  "status": "published",
  "publishedAt": "{现在时间 UTC ISO}",
  "type": "post",
  "collection": "flash",
  "categories": ["{news.market}"],     # us-stocks / a-stocks / hk-stocks / macro
  "tags": ["1-2 个标签"],
  "coverImage": null,
  "seo": {完整 schemaFaq 5 问},
  "content": "<HTML 200-400 字>"
}

≥1 表（如同业对比 / 板块标的）
1-2 个 <sup> 引用
≥1 内链（从内链候选选）
5 PAA FAQ + schemaFaq
方法论披露 + byline + disclaimer

## 风格红线
不喊单 / 不预测股价 / 第三方视角 / 段落 ≤3 句 / 关键数据 <strong>
不用"维度""三维""综上所述""值得注意"

## reply ≤100 字（slug + 标题 + 字数）
不要 POST。
```

### Step 4：等所有 Agent 完成 → POST

每个 Agent 完成后读 `/tmp/m8_news_out/{slug}.json`，POST 到：

```
POST https://cloudflare-sites-cms.pages.dev/api/posts?siteId=m8.com.cn
Header: Authorization: Bearer ${CF_CMS_TOKEN}
```

成功后：
- `state["published_news_ids"]` 加入 `{source}:{id}`
- `state["published_slugs"]` 加入 slug
- `state["stats"]["total_flash"] += 1`

### Step 4.5：生成 cover image（POST 成功后追加）

对每篇刚发的 flash，调用 `m8_image_gen.py` 生成 cover：

```python
import subprocess
# 从 news 数据推一个英文 topic（不要中文，模型渲染中文必出乱码）
topic = build_english_topic(news)  # 例: "abstract semiconductor wafer pattern, hong kong skyline silhouette"
subprocess.run([
    'python3', 'sites/m8/bin/m8_image_gen.py',
    '--slug', slug,
    '--topic', topic,
    '--update-post',
], timeout=180, check=False)
# 失败也别 abort，文章已经上线了，封面是锦上添花
```

`m8_image_gen.py` 会：
1. 调 0.88 sd-server (`http://192.168.0.88:8081/v1/images/generations`) 8 步 Turbo 出 1024x1024，约 60-70s
2. 自动加 negative_prompt 屏蔽文字、水印、变形
3. 多 part 上传 CMS asset → publicUrl
4. PUT `/api/posts/{slug}` 设置 `coverImage`

**topic 构造规则（必须英文）**：
- 个股新闻：`abstract {industry} pattern, {city or country} skyline silhouette, geometric circuit motifs`
- 行业新闻：`abstract {sector} concept art, {key visual element}, modern editorial style`
- 宏观/政策：`abstract financial chart, golden ratio composition, world map silhouette` 或 `central bank building silhouette, deep navy and gold palette`
- 加密：`abstract bitcoin circuit pattern, network nodes, glowing connections`
- AI/半导体：`abstract chip on dark background, neon circuit traces, server rack silhouette`

**禁止在 topic 里出现**：中文、人脸、商标、具体公司 logo（会触发版权风险或乱码）。

### Step 5：保存 state + 日志

```python
state["last_run"] = datetime.now(timezone.utc).isoformat()
Path('sites/m8/bin/news_bot_state.json').write_text(json.dumps(state, ensure_ascii=False, indent=2))
```

写一行日志到 `sites/m8/bin/news_bot.log`（追加）：
```
[2026-04-26 14:30:00] flash run: 50 fetched / 48 fresh / 5 candidates / 3 posted (slugs: ..., ...)
```

---

## digest 模式流程（每日 18:00 收盘后）

类似 flash 流程，但 Step 3 改成：
- 不分多 Agent
- 单 Agent dispatch，prompt 改成"日综评 insight"
- 字数 1500-2000
- 结构：今日事件清单（表格） / 美股综评 / A 股综评 / 港股综评 / 监控变量 / FAQ
- collection: insight
- slug 格式: `digest-YYYYMMDD-daily`
- ≥3 内链

prompt 用 sites/m8/author/personas/m8-bianjibu.md 的 voice 规则。

---

## weekly 模式（周日 20:00）

聚合本周 `state.published_slugs` 中今天往前推 7 天的所有 flash + 重要财报，写"本周 m8 综述"。
slug: `digest-YYYYMMDD-weekly`，collection: insight，字数 2500-3000。

---

## 失败处理

- 8086 接口超时：跳过该源，其他 3 个继续
- DeepSeek/Claude API 失败：log 记录，state["stats"]["errors"] += 1，跳过该条
- CMS POST 失败：log + 不更新 state（下次会重试）
- Slug 冲突（已存在）：改 PUT 而不是 POST
- **图片生成失败**：log 记录，**不阻塞**——文章 POST 已成功，下次手工或自动补图

---

## 监控

每天看一次 `news_bot.log` 和 `state["stats"]`：
- `total_flash` 应 ~每天 5-15 篇
- `total_digest` ~每天 1 篇
- `errors` 应 ≤ 2/天

如果连续多天 `errors > 5`，检查 8086 接口和 CMS Token 是否过期。
