# m8 每日精选写作 workflow（Claude Code 远程 agent 执行）

这是给 Claude Code 远程 agent 看的指令文档。被 `/schedule` 触发时，agent 按下面流程执行一次。

## 调用方式

```
/schedule create
  name: m8-auto-daily
  cron: 0 9 * * *      # 每天北京时间 09:00
  prompt: |
    读 /Users/kangbing/112/pythonindex/writing_bro/sites/m8/bin/m8-auto-daily.md
    按其中"完整流程"执行一次。
```

---

## 完整流程（agent 必读）

### Step 0：环境检查

1. 读 `sites/m8/.env` 确认必需变量：CF_CMS_TOKEN、ZIMAGE_BASE、API_8086_TOKEN、API_8086_BASE
2. selftest CMS：`curl -s -m 5 -H "Authorization: Bearer $CF_CMS_TOKEN" "https://cloudflare-sites-cms.pages.dev/api/posts?siteId=m8.com.cn&pageSize=1"` 应该返回 JSON
3. selftest 0.88 sd-server：`curl -s -m 5 http://192.168.0.88:8081/v1/models` 应该返回 sd-cpp-local
4. 任何一个 fail → 跳过当天，写 log 到 `sites/m8/bin/launchd-auto-daily.log`，**不通知**用户

### Step 1：拉数据源（并行）

并行做 3 件事：

**A. 拉当日新闻**（8086 API）：
```bash
curl -s -X POST "$API_8086_BASE/api/v1/queryXgbNews" \
  -H "x-custom-token: $API_8086_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "hours": 24}'
```
解析返回，按 score 排序取前 30 条。

**B. 读题材池**：`sites/m8/raw/topic-pool.md`
- 解析【个股清单】+【主题清单】区段
- 解析【已发清单】区段（最近 30 天的 slug，用于去重）

**B2. 读核心清单**：`sites/m8/raw/research/TWO_WEEK_CORE_COVERAGE.md`
- 先把第一批 12 个核心交付当成最高优先级
- 如果题材池与核心清单冲突，优先核心清单
- 已有 backlog 可修整加厚时，优先修整，不重新海量起稿

**B3. 读核心状态文件**：`sites/m8/raw/research/TWO_WEEK_CORE_COVERAGE.json`
- 只把 `status in ['missing', 'draft_ready', 'published_equivalent_needs_upgrade']` 的条目当成第一优先级缺口
- `published_equivalent` 代表已经有可用等价稿，不要再重复起一篇同义文，除非要统一 slug 或做明显加厚
- `published` 代表已经具备核心入口，不再为凑数重复发布
- 如 JSON 状态落后，先执行：`python3 sites/m8/bin/m8_core_coverage_status.py --write`

**C. 拉 m8 已发清单**（CMS API 兜底去重）：
```bash
curl -s -m 10 -H "Authorization: Bearer $CF_CMS_TOKEN" \
  "https://cloudflare-sites-cms.pages.dev/api/posts?siteId=m8.com.cn&page=1&pageSize=100"
```

### Step 2：选题（0-2 个 / 天）— **按信号强度精选，不为产量硬凑**

**m8 blog 主导航 category**（每篇必须有 `categories: [...]` 字段，至少 1 个匹配主导航）：
- `a-stocks` / `us-stocks` / `hk-stocks` / `ai-stocks` / `macro` / `industry-research` / `crypto` / `investing-101`

**默认日配额**（普通日 0-2 篇，允许 0 篇）：

| Category | 数量 | 类型 | 选题来源 |
|---|---|---|---|
| **a-stocks** | **0-1** | 个股 deep / 支撑 insight | 优先核心清单与 backlog |
| **us-stocks** | **0-1** | 个股 deep / 支撑 insight | 优先核心清单与 backlog |
| **hk-stocks** | **0-1** | 港股 deep / insight | 只在有明确公司或主线价值时写 |
| **crypto** | **0-1** | deep / insight | 优先 BTC ETF / 稳定币 / 基建 |
| **industry-research** | **0-1** | 主题 deep | 优先半导体周期 / GLP-1 / AI链 |
| **macro** | **0-1** | 支撑 insight | 只在与核心市场主线强相关时写 |
| **investing-101** | **0-1 / 周** | evergreen deep | 每周 1 篇即可，不并入日常灌量 |
| **总计** | **0-2 / 天** | — | 宁缺毋滥，优先核心交付 |

**关键约束**：
1. 每篇 `categories` 字段**至少 1 个**主导航类目（让文章进 https://m8.com.cn/category/{cat} 栏目页）
2. 个股 deep 优先抽**两周核心清单**与**最近 30 天未发**的标的（按【已发清单】比对）
3. 跨主题 AI 概念股可同时归 `categories: ['ai-stocks', 'us-stocks']`，但必须有新增信息量
4. **类型分布**：优先 `pillar deep + insight/support`，`trending` 只在必须抢时效时使用
5. 如果当天没有足够高质量题目，**返回 0-2 篇也算成功**
6. 丢弃这些题目：
   - 只有大词、没有明确公司/变量/结论
   - 过去 14 天内同角度重复
   - 缺少可验证数据源
   - 标题只能靠堆关键词成立

**8086 新闻使用规则**：
- top 30 新闻按相关性归到对应 category（如 NVDA Q1 → us-stocks + ai-stocks）
- 同一 category 同一天只取最高 signal 的 1 个主题
- 周末 / 节假日（8086 低信号）→ 允许不写，或只修整 1 篇核心稿

**为什么这样分**：
- 站点当前问题不是“量不够”，而是**站点骨架太薄、信号密度不够、同质化偏高**
- 先保证每篇能承载明确 thesis、关键词锚点和内链价值，再考虑数量
- category 覆盖要有，但不机械平均分配

**去重规则**：
1. 跟【已发清单】最近 30 天 slug 比对，重复则换
2. 跟 8086 新闻已写过的事件比对（看 8086 是否已生成 flash article）
3. 跟今日已选主题不冲突（同一公司财报不重复写两个角度）
4. 跟首页和栏目页最近 14 天主标题不出现明显同义复写

**选题评分**：每个候选题按 1-5 打分，低于 15 分不进入 `selected_topics`
- `search_intent_fit`：是否对应真实搜索/阅读意图
- `information_gain`：相对站内旧文是否有新增信息
- `thesis_clarity`：一句话能否说清本文结论
- `data_availability`：是否拿得到可靠数据/引文
- `distribution_value`：是否值得进首页、栏目页和后续 cross-post

**输出**：构造 `selected_topics` list，数量 `0-2`，每个 dict 各含：
```json
{
  "type": "trending|insight|deep",
  "slug": "xxx-yymmdd",  // trending 加日期；deep/insight 用主题 slug
  "title_hint": "标题草案",
  "subject": "公司/主题",
  "angle": "差异化切入",
  "data_points": ["数据1", "数据2"],
  "linked_pillar": "可选，evergreen 内链锚",
  "author": "m8 康哥",
  "estimated_words": 1500-3500,
  "categories": ["..."],
  "tags": ["..."]
}
```

**作者规则**：
- 公开站点统一显示 `m8 康哥`
- 写作 persona 仍可按任务内部切换，但对外展示不再拆成多个作者入口

**investing-101 文章特殊要求**：
- slug 必须 `-101` 结尾（如 `moat-economic-101`、`free-cash-flow-101`）
- categories 必须 `['investing-101']`（**关键** — 让文章进入 https://m8.com.cn/category/investing-101 栏目页）
- collection 用 `deep`（不要 `trending`，这是常青教育）
- 字数 2000-3000（教学需要详细但不冗长）
- 结构：定义 → 核心公式/框架 → 真实公司案例（≥2 个）→ 常见误区 → 对照其他指标 → FAQ
- 风格：**教学 + 数据 + 案例**，不喊单不预测，但点出"什么时候这个指标会失效"
- 必引：3-5 个权威源（Investopedia、Damodaran、CFA Institute、Buffett 股东信、Munger 演讲等）
- **频率**：默认每周 1-3 篇即可，不要求每日都有

### Step 3：并行写作

dispatch `len(selected_topics)` 个 sub-agent 并行；当 `selected_topics` 为空时，直接进入 Step 5 写日志并返回。

**并发建议**：
- `1-2` 篇：一批跑完

前一批 return 后再启动下一批。每个 sub-agent 写 1 篇文章。

每个 sub-agent 的 prompt 包含：
1. 完整的 `selected_topics[i]` 元数据
2. 站点规范（持续引用 `/Users/kangbing/112/pythonindex/writing_bro/sites/m8/raw/research/drafts/amzn-fy2026-deep.json` 作为 HTML / SEO schema 标准样本）
3. 对应作者 persona 路径
4. **HTML 输出要求**（裸标签无 inline style；H2 / 表 / 引用 sup / 数据来源段 / SEO 完整字段）
5. 输出 JSON 到 `/tmp/m8_auto_{slug}.json`

**并发控制**：sub-agent 用 `general-purpose` subagent_type，`run_in_background: true`。

### Step 4：等所有 sub-agent 完成，串行配图 + 发布

Sub-agent 全部 return 后：

**4a. 配图**（zimage 串行，每张 ~30s）：

```python
from m8_image_gen import gen_image_zimage, build_cover_prompt

# 为每篇生 1024x576 (16:9) 封面
for i, t in enumerate(selected_topics):
    prompt = build_cover_prompt(f'abstract editorial illustration about {t["english_topic_hint"]}')
    img = gen_image_zimage(prompt, size='1024x576', steps=8, seed=1000+i)
    Path(f'/tmp/m8_auto_{t["slug"]}_cover.jpg').write_bytes(img)
```

总耗时约 `selected_topics * 30s`。如 zimage 不可达，跳过封面（`coverImage=None`，CF Sites 模板会用默认）。

**4b. 批量发布**（用 `m8_publish.py --batch`）：

```python
import json
jobs = [
    {
        "json": f"/tmp/m8_auto_{t['slug']}.json",
        "slug": t["slug"],
        "author": t["author"],
        "hero": f"/tmp/m8_auto_{t['slug']}_cover.jpg",  # 如有
    }
    for t in selected_topics
]
Path('/tmp/m8_auto_jobs.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2))
# 跑：
# python3 sites/m8/bin/m8_publish.py --batch /tmp/m8_auto_jobs.json
```

`m8_publish.py` 自动：
- 上传 hero
- POST CMS（status=published）
- ping Google Indexing API
- 归档 `.posted.json`

### Step 5：更新题材池 + 写 log

1. 把今天实际发布的 slug 追加到 `sites/m8/raw/topic-pool.md` 的 **【已发清单】** 段（每行 `YYYY-MM-DD slug`）
2. 如果命中 `sites/m8/raw/research/TWO_WEEK_CORE_COVERAGE.md` 的 12 个核心交付，在对应条目标记“已完成 / 已修整”
3. 运行 `python3 sites/m8/bin/m8_core_coverage_status.py --write`，刷新核心清单状态
4. 写 log 到 `sites/m8/bin/launchd-auto-daily.log`：
   ```
   === 2026-05-04 09:00:00 ===
   selected: [实际选题 slug]
   sub_agent_results: [实际 ok/fail]
   covers_generated: N
   published: N
   indexing_ok: N
   total_seconds: 480
   ```
5. **不发 Telegram，不通知用户**（用户明确要求 silent 模式）

### Step 6：失败处理

| 场景 | 处理 |
|------|------|
| 8086 拉不到新闻 | 从题材池抽 1-4 篇，或直接返回 0 |
| 题材池主题不够 | 写多少算多少，不强凑 |
| sub-agent 写崩 1-2 个 | 跳过这几个，其他正常发 |
| zimage 不可达 | 跳过封面，文章无 cover 也发 |
| CMS 4xx/5xx | 重试 1 次，仍失败则跳过该篇，其他继续 |
| Google Indexing 429 | 跳过 ping（不影响 CMS 上线） |
| 整体异常 | 写 log，不发通知，下次 cron 自然恢复 |

### Step 7：汇总输出（仅返回值，不通知）

agent 最终返回简短 JSON：
```json
{
  "date": "2026-05-04",
  "selected": 4,
  "published": 4,
  "indexing_ok": 4,
  "total_seconds": 487,
  "errors": []
}
```

---

## 关键参考文件

- 站点规范：`sites/m8/config.md`
- 作者 persona：`sites/m8/author/personas/{m8-bianjibu, m8-yanjiuyuan, m8-kangge, m8-teyue, m8-ai}.md`
- HTML / SEO 标准样本：`sites/m8/raw/research/drafts/amzn-fy2026-deep.json`（draft JSON 完整 schema）
- 工具链：`sites/m8/bin/m8_publish.py`、`sites/m8/bin/m8_image_gen.py`、`sites/m8/bin/m8_indexing.py`
- 题材池：`sites/m8/raw/topic-pool.md`

---

## 注意事项

1. **不通知用户**（Telegram / 微信均不发）
2. 目标不是冲篇数，而是保证：
   - 标题有真实关键词锚点，但不堆词
   - 数据有据（标 [n] 引用，且引用源真实可查）
   - HTML schema 完整（SEO + FAQ）
   - 每篇有明确 thesis 和内链价值
3. **不要写情绪化 / 喊单 / 推荐买入** — m8 是研究网站，保持中性
4. 如果某天 8086 全是低信号（如周末），优先少写甚至不写，不强求 trending 数量
5. **investing-101 不要求每日产出**：按周节奏补齐即可
6. **categories 字段必须填**：每篇至少 1 个主导航 category（让文章进栏目页 https://m8.com.cn/category/{cat}）
7. **预计单次总耗时**：4-8 篇通常在 **10-25 分钟** 完成，取决于配图和发布耗时
8. **launchd 容忍时长**：plist 没有 timeout，可跑到完成；如 mac 睡眠中断，下次 cron 自然恢复
