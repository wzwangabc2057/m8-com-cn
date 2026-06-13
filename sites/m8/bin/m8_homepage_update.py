#!/usr/bin/env python3
"""
m8.com.cn 首页自动更新器

拉 CMS 最新文章 → 按 category 分组 → 渲染静态 HTML → PUT 更新 index page

每天 m8-auto-daily 跑完后由 launchd 触发一次，让首页与最新内容同步。
"""
import json, re, urllib.parse, urllib.request, html
import ssl
from datetime import datetime
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
SITE_DIR = SCRIPT_DIR.parent
ENV = {}
for line in (SITE_DIR / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.split('=', 1); ENV[k.strip()] = v.strip()

CF_TOKEN = ENV['CF_CMS_TOKEN']
CMS_BASE = (
    ENV.get('M8_CMS_BASE_URL')
    or ENV.get('CF_CMS_URL')
    or 'https://cloudflare-sites-cms.pages.dev'
).rstrip('/')
SITE_ID = 'm8.com.cn'

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency
    certifi = None


def build_ssl_context():
    cafile = ENV.get('SSL_CERT_FILE')
    if cafile:
        return ssl.create_default_context(cafile=cafile)
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


SSL_CONTEXT = build_ssl_context()


def urlopen(req, timeout=30):
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT)

# 8 个 category 显示顺序 + 显示名
CATEGORIES = [
    ('us-stocks', '美股', 'US Stocks'),
    ('a-stocks', 'A 股', 'China A-Shares'),
    ('ai-stocks', 'AI 产业链', 'AI Supply Chain'),
    ('hk-stocks', '港股', 'Hong Kong'),
    ('industry-research', '行业研究', 'Industry Research'),
    ('macro', '宏观', 'Macro'),
    ('crypto', '加密', 'Crypto'),
    ('investing-101', '投资科普', 'Investing 101'),
]

CAT_LABEL = {slug: zh for slug, zh, _ in CATEGORIES}

DEFAULT_COVER = 'https://m8.com.cn/site-assets/2026/05/default-cover.jpg'


def esc(s):
    return html.escape(str(s or ''), quote=True)


def fetch_posts(max_pages=5, page_size=50):
    """从 CMS 分页拉所有 published 文章。"""
    all_posts = []
    seen_slugs = set()
    for page in range(1, max_pages + 1):
        req = urllib.request.Request(
            f'{CMS_BASE}/api/posts?siteId={urllib.parse.quote(SITE_ID)}&page={page}&pageSize={page_size}',
            headers={'Authorization': f'Bearer {CF_TOKEN}', 'User-Agent': 'm8-home-update/2.0'}
        )
        # 重试 3 次
        last_err = None
        r = None
        for attempt in range(3):
            try:
                r = json.loads(urlopen(req, timeout=60).read())
                break
            except Exception as e:
                last_err = e
                print(f'  page {page} attempt {attempt+1} 失败: {e}', file=sys.stderr)
                import time; time.sleep(5)
        if r is None:
            print(f'  page {page} 放弃: {last_err}', file=sys.stderr); break
        posts = r.get('posts') or r.get('data') or r.get('items') or []
        if not posts:
            break
        new_count = 0
        for p in posts:
            s = p.get('slug')
            if s and s not in seen_slugs:
                seen_slugs.add(s); all_posts.append(p); new_count += 1
        print(f'  page {page}: +{new_count} (total {len(all_posts)})', flush=True)
        if new_count == 0:
            break
    return all_posts


# slug 推断 category 兜底（老文章 categories 为空时用）
def infer_cat_from_slug(slug):
    s = (slug or '').lower()
    if s.endswith('-101'): return 'investing-101'
    if 'btc' in s or 'eth' in s or 'crypto' in s or 'bitcoin' in s or 'defi' in s or 'spot-etf' in s: return 'crypto'
    if 'hk' in s or '0700' in s or '9988' in s or '3690' in s or '9888' in s or '1299' in s or '1801' in s or '1877' in s: return 'hk-stocks'
    # 美股标的关键词
    us_tickers = ['aapl','msft','goog','amzn','meta','nvda','nvidia','tsla','tesla','amd','intc','avgo','qcom','mu','tsm','asml','amat','lrcx','klac','smci','pltr','palantir','snow','crm','now','brk','jpm','blk','coin','hood','mstr','lly','novo','isrg','vrtx','regn','besi','buffett','dalio','soros','dxy']
    if any(t in s for t in us_tickers): return 'us-stocks'
    # A 股代码（6 位数字）
    if re.search(r'\b\d{6}\b', s) or any(x in s for x in ['cambricon','haiguang','zhongji','xinyisheng','tianfu','tuopu','catl','byd','shenhua','soe','dividend','semaglutide','glp1']): return 'a-stocks'
    # AI/ 半导体类
    if any(x in s for x in ['ai-','hbm','cowos','ai-capex','sovereign-ai','robot','optimus','semiconductor']): return 'ai-stocks'
    # 宏观
    if any(x in s for x in ['fed','fomc','rate','inflation','dxy','dollar','yen','tariff','geopolit','china-policy']): return 'macro'
    # 行业研究
    if any(x in s for x in ['industry','sector','cycle','supply-chain','rally','box-office','rail','holiday','wrap','digest']): return 'industry-research'
    return 'industry-research'  # 默认归行业研究


def get_cats(post):
    """获取文章 categories（如为空用 slug 推断）。"""
    cats = post.get('categories') or []
    if cats:
        return cats
    inferred = infer_cat_from_slug(post.get('slug'))
    return [inferred]


def pick_cat(post):
    """取首个 category 用于徽章显示。"""
    return get_cats(post)[0]


def fmt_date(s):
    if not s:
        return ''
    try:
        d = datetime.fromisoformat(s.replace('Z', '+00:00'))
        return f'{d.month}月{d.day}日'
    except Exception:
        return ''


def trunc(s, n):
    s = (s or '').strip()
    return (s[:n] + '…') if len(s) > n else s


def render_lead(posts):
    """今日头条：1 大 + 3 副。"""
    if not posts:
        return '<div class="m8-loading">暂无文章</div>'

    main = posts[0]
    sides = posts[1:4]

    cover = main.get('coverImage') or DEFAULT_COVER
    html_out = []
    html_out.append('<div class="m8-lead-main">')
    html_out.append(f'  <a href="/article/{esc(main.get("slug"))}">')
    html_out.append(f'    <img src="{esc(cover)}" alt="{esc(main.get("title"))}" loading="eager" />')
    html_out.append('  </a>')
    html_out.append('  <div class="m8-tag-row">')
    html_out.append(f'    <span class="m8-cat">{esc(CAT_LABEL.get(pick_cat(main), pick_cat(main)))}</span>')
    html_out.append('    <span class="m8-dot">·</span>')
    html_out.append(f'    <span class="m8-time">{esc(fmt_date(main.get("publishedAt")))}</span>')
    html_out.append('  </div>')
    html_out.append(f'  <h2 class="m8-headline"><a href="/article/{esc(main.get("slug"))}">{esc(main.get("title"))}</a></h2>')
    html_out.append(f'  <p class="m8-deck">{esc(trunc(main.get("excerpt"), 220))}</p>')
    html_out.append(f'  <div class="m8-byline">By <strong>{esc(main.get("author") or "m8")}</strong></div>')
    html_out.append('</div>')

    html_out.append('<div class="m8-lead-side">')
    for p in sides:
        html_out.append(f'  <article>')
        html_out.append('    <div class="m8-tag-row">')
        html_out.append(f'      <span class="m8-cat">{esc(CAT_LABEL.get(pick_cat(p), pick_cat(p)))}</span>')
        html_out.append('      <span class="m8-dot">·</span>')
        html_out.append(f'      <span class="m8-time">{esc(fmt_date(p.get("publishedAt")))}</span>')
        html_out.append('    </div>')
        html_out.append(f'    <h3 class="m8-headline"><a href="/article/{esc(p.get("slug"))}">{esc(p.get("title"))}</a></h3>')
        html_out.append(f'    <p class="m8-deck">{esc(trunc(p.get("excerpt"), 140))}</p>')
        html_out.append('  </article>')
    html_out.append('</div>')

    return '\n'.join(html_out)


def render_card(p):
    cover = p.get('coverImage') or DEFAULT_COVER
    return f'''<a class="m8-card" href="/article/{esc(p.get('slug'))}">
  <img src="{esc(cover)}" alt="{esc(p.get('title'))}" loading="lazy" />
  <div class="m8-tag-row">
    <span class="m8-cat">{esc(CAT_LABEL.get(pick_cat(p), pick_cat(p)))}</span>
    <span class="m8-dot">·</span>
    <span class="m8-time">{esc(fmt_date(p.get('publishedAt')))}</span>
  </div>
  <h3 class="m8-headline">{esc(p.get('title'))}</h3>
  <p class="m8-deck">{esc(trunc(p.get('excerpt'), 100))}</p>
</a>'''


def render_section(cat_slug, cat_zh, cat_en, posts):
    if not posts:
        return f'''<section class="m8-section">
  <div class="m8-section-head">
    <h2 class="m8-section-title">{cat_zh} <span class="m8-title-en">/ {cat_en}</span></h2>
    <a class="m8-section-link" href="/category/{cat_slug}/">全部 →</a>
  </div>
  <div class="m8-empty">该板块暂无新文章 — <a href="/category/{cat_slug}/">查看全部</a></div>
</section>'''
    cards = '\n'.join(render_card(p) for p in posts[:4])
    return f'''<section class="m8-section">
  <div class="m8-section-head">
    <h2 class="m8-section-title">{cat_zh} <span class="m8-title-en">/ {cat_en}</span></h2>
    <a class="m8-section-link" href="/category/{cat_slug}/">全部 →</a>
  </div>
  <div class="m8-grid">
{cards}
  </div>
</section>'''


def render_homepage(posts):
    """生成完整首页 HTML。"""
    # Lead = 取最新 4 篇（不限 category）
    lead_posts = posts[:4]
    # 剩余按 category 分组（过滤掉已在 lead 的）
    lead_slugs = {p.get('slug') for p in lead_posts}
    rest = [p for p in posts if p.get('slug') not in lead_slugs]

    sections_html = []
    for cat_slug, cat_zh, cat_en in CATEGORIES:
        cat_posts = [p for p in rest if cat_slug in get_cats(p)]
        sections_html.append(render_section(cat_slug, cat_zh, cat_en, cat_posts[:4]))

    lead_html = render_lead(lead_posts)
    today = datetime.now().strftime('%Y 年 %-m 月 %-d 日')

    return f'''<style>
.m8-mag, .m8-mag * {{ box-sizing: border-box; }}
.m8-mag {{
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, sans-serif;
  color: #1a1a1a;
  background: #fff;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}}
.m8-mag a {{ color: inherit; text-decoration: none; }}
.m8-mag a:hover .m8-headline {{ text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }}
.m8-mag .m8-w {{ max-width: 1280px; margin: 0 auto; padding: 0 24px; }}

/* 报头 */
.m8-masthead {{
  border-top: 4px solid #1a1a1a;
  border-bottom: 1px solid #1a1a1a;
  padding: 22px 0 18px;
  text-align: center;
  background: #faf9f6;
}}
.m8-masthead-eyebrow {{ font-size: 12px; color: #767676; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 6px; }}
.m8-masthead-title {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 56px; font-weight: 700; letter-spacing: -0.04em;
  margin: 0; color: #1a1a1a; line-height: 1;
}}
.m8-masthead-sub {{
  font-size: 13px; color: #4a4a4a; margin-top: 10px;
  font-style: italic; font-family: "Times New Roman", "Songti SC", serif;
}}
.m8-masthead-nav {{
  margin-top: 16px;
  display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
  font-size: 14px; font-weight: 500;
}}
.m8-masthead-nav a {{ color: #1a1a1a; padding-bottom: 2px; border-bottom: 1px solid transparent; }}
.m8-masthead-nav a:hover {{ border-bottom-color: #b30000; color: #b30000; }}

/* 市场行情条（占位 — 未来可接实时 API） */
.m8-tape {{
  background: #1a1a1a; color: #fff;
  padding: 10px 0; font-size: 13px; overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}}
.m8-tape-inner {{
  display: flex; gap: 32px; padding: 0 24px;
  animation: m8-tape-scroll 60s linear infinite;
  white-space: nowrap;
}}
.m8-tape span.t-up {{ color: #4ade80; }}
.m8-tape span.t-down {{ color: #f87171; }}
@keyframes m8-tape-scroll {{
  0% {{ transform: translateX(0); }}
  100% {{ transform: translateX(-50%); }}
}}

/* 日期条 */
.m8-dateline {{
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 0; font-size: 13px;
  color: #767676; display: flex; justify-content: space-between; align-items: center;
}}
.m8-dateline strong {{ color: #1a1a1a; font-weight: 600; }}

/* Lead */
.m8-lead {{
  display: grid; grid-template-columns: 7fr 5fr; gap: 48px;
  padding: 40px 0 48px; border-bottom: 1px solid #1a1a1a;
}}
.m8-lead-main img {{
  width: 100%; aspect-ratio: 16/9; object-fit: cover;
  background: #f0f0f0; display: block; margin-bottom: 18px;
}}
.m8-lead-main .m8-tag-row {{ margin-bottom: 12px; }}
.m8-lead-main .m8-headline {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 38px; font-weight: 700; line-height: 1.15;
  letter-spacing: -0.015em; margin: 0 0 14px;
}}
.m8-lead-main .m8-deck {{
  font-size: 17px; color: #4a4a4a; line-height: 1.6;
  margin: 0 0 12px;
}}
.m8-lead-side {{ display: flex; flex-direction: column; }}
.m8-lead-side article {{
  padding: 0 0 22px; margin-bottom: 22px;
  border-bottom: 1px solid #e0e0e0;
}}
.m8-lead-side article:last-child {{ border-bottom: none; padding-bottom: 0; margin-bottom: 0; }}
.m8-lead-side .m8-headline {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 20px; font-weight: 700; line-height: 1.25;
  margin: 8px 0 8px;
}}
.m8-lead-side .m8-deck {{
  font-size: 14px; color: #4a4a4a; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}}

/* Tag row */
.m8-tag-row {{
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: #b30000;
}}
.m8-tag-row .m8-dot {{ color: #767676; font-weight: 400; }}
.m8-tag-row .m8-time {{ color: #767676; font-weight: 400; letter-spacing: 0.05em; text-transform: none; }}

.m8-byline {{ font-size: 13px; color: #767676; margin-top: 6px; }}
.m8-byline strong {{ color: #1a1a1a; font-weight: 500; }}

/* Section */
.m8-section {{ padding: 40px 0; border-bottom: 1px solid #e0e0e0; }}
.m8-section:last-of-type {{ border-bottom: none; }}
.m8-section-head {{
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 24px; padding-bottom: 10px;
  border-bottom: 2px solid #1a1a1a;
}}
.m8-section-title {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 26px; font-weight: 700; margin: 0;
  letter-spacing: -0.01em;
}}
.m8-section-title .m8-title-en {{ font-size: 16px; font-weight: 400; color: #767676; font-style: italic; margin-left: 6px; }}
.m8-section-link {{ font-size: 13px; color: #b30000; font-weight: 600; }}

/* 4-col Grid */
.m8-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }}
.m8-card img {{
  width: 100%; aspect-ratio: 16/9; object-fit: cover;
  background: #f0f0f0; display: block; margin-bottom: 10px;
}}
.m8-card .m8-tag-row {{ margin-bottom: 6px; font-size: 10px; }}
.m8-card .m8-headline {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 17px; font-weight: 700; line-height: 1.3;
  margin: 0 0 6px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}}
.m8-card .m8-deck {{
  font-size: 13px; color: #4a4a4a; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0;
}}
.m8-empty {{ color: #767676; padding: 40px 0; text-align: center; font-size: 14px; }}
.m8-empty a {{ color: #b30000; }}
.m8-loading {{ color: #767676; padding: 60px 0; text-align: center; font-size: 14px; }}

/* Footer band */
.m8-band {{
  background: #1a1a1a; color: #fff; text-align: center;
  padding: 56px 24px; margin-top: 40px;
}}
.m8-band h3 {{
  font-family: "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: 32px; font-weight: 700; margin: 0 0 12px;
  letter-spacing: -0.01em;
}}
.m8-band p {{ opacity: 0.75; margin: 0 0 24px; font-size: 15px; }}
.m8-band a {{
  display: inline-block; background: #b30000; color: #fff;
  padding: 13px 32px; font-size: 14px; font-weight: 600;
  letter-spacing: 0.05em;
}}

@media (max-width: 1024px) {{ .m8-grid {{ grid-template-columns: repeat(3, 1fr); }} }}
@media (max-width: 768px) {{
  .m8-masthead-title {{ font-size: 40px; }}
  .m8-lead {{ grid-template-columns: 1fr; gap: 32px; padding: 32px 0; }}
  .m8-lead-main .m8-headline {{ font-size: 28px; }}
  .m8-grid {{ grid-template-columns: repeat(2, 1fr); gap: 18px; }}
  .m8-card .m8-headline {{ font-size: 15px; }}
  .m8-section {{ padding: 28px 0; }}
  .m8-section-title {{ font-size: 21px; }}
}}
@media (max-width: 480px) {{ .m8-grid {{ grid-template-columns: 1fr; }} }}
</style>

<div class="m8-mag">

<!-- 报头 -->
<header class="m8-masthead">
  <div class="m8-w">
    <div class="m8-masthead-eyebrow">{today}</div>
    <h1 class="m8-masthead-title">m8</h1>
    <div class="m8-masthead-sub">Cross-Market Investment Intelligence</div>
    <nav class="m8-masthead-nav">
      <a href="/category/us-stocks/">美股</a>
      <a href="/category/a-stocks/">A 股</a>
      <a href="/category/hk-stocks/">港股</a>
      <a href="/category/crypto/">加密</a>
      <a href="/category/ai-stocks/">AI 产业链</a>
      <a href="/category/industry-research/">行业研究</a>
      <a href="/category/macro/">宏观</a>
      <a href="/category/investing-101/">投资科普</a>
    </nav>
  </div>
</header>

<!-- 市场行情占位条（未来接实时 API） -->
<div class="m8-tape">
  <div class="m8-tape-inner">
    <span>SPX <span class="t-up">5,830 +0.5%</span></span>
    <span>NDX <span class="t-up">20,510 +0.8%</span></span>
    <span>DJI <span class="t-down">42,140 -0.2%</span></span>
    <span>HSI <span class="t-up">22,180 +1.2%</span></span>
    <span>SHCOMP <span class="t-up">3,420 +0.4%</span></span>
    <span>BTC <span class="t-up">$103,200 +2.1%</span></span>
    <span>ETH <span class="t-up">$3,850 +1.4%</span></span>
    <span>DXY <span class="t-down">99.7 -0.3%</span></span>
    <span>GOLD <span class="t-up">$2,510 +0.6%</span></span>
    <span>WTI <span class="t-down">$71.3 -0.8%</span></span>
    <span>10Y UST <span class="t-down">4.18% -2bp</span></span>
    <!-- duplicate for seamless loop -->
    <span>SPX <span class="t-up">5,830 +0.5%</span></span>
    <span>NDX <span class="t-up">20,510 +0.8%</span></span>
    <span>DJI <span class="t-down">42,140 -0.2%</span></span>
    <span>HSI <span class="t-up">22,180 +1.2%</span></span>
    <span>BTC <span class="t-up">$103,200 +2.1%</span></span>
    <span>DXY <span class="t-down">99.7 -0.3%</span></span>
  </div>
</div>

<!-- 日期条 -->
<div class="m8-w">
  <div class="m8-dateline">
    <span><strong>今日头条</strong> · Today's Lead</span>
    <span>每日精选深度更新</span>
  </div>
</div>

<!-- 今日头条 -->
<div class="m8-w">
  <section class="m8-lead">
{lead_html}
  </section>
</div>

<!-- Category Sections -->
<div class="m8-w">
{chr(10).join(sections_html)}
</div>

<!-- Footer band -->
<section class="m8-band">
  <h3>每日精选深度更新</h3>
  <p>数据驱动 · 标注引用 · 中性研究 · 跨市场视角</p>
  <a href="/blog">浏览全部文章</a>
</section>

</div>'''


def update_index_page(content):
    """PUT 更新 CMS index page。"""
    payload = {
        'siteId': SITE_ID, 'slug': 'index',
        'title': 'm8 跨市场投资资讯 - 美股·A股·港股·加密货币',
        'status': 'published', 'type': 'page', 'layout': 'default',
        'showTitle': False, 'containerClass': '',
        'content': content,
        'seo': {
            'title': 'm8 - 跨市场投资资讯 | 美股·A股·港股·加密货币',
            'description': 'm8 提供美股、A 股、港股、加密货币的深度投资分析，覆盖 AI 产业链、半导体周期、宏观利率、行业研究与投资科普。'
        }
    }
    req = urllib.request.Request(
        f'{CMS_BASE}/api/pages/index?siteId={urllib.parse.quote(SITE_ID)}',
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {CF_TOKEN}', 'Content-Type': 'application/json',
                 'User-Agent': 'm8-home-update/2.0'},
        method='PUT'
    )
    return json.loads(urlopen(req, timeout=30).read())


def main():
    print(f'[{datetime.now().isoformat()}] 拉 CMS 文章...', flush=True)
    posts = fetch_posts(page_size=100)
    print(f'  拉到 {len(posts)} 篇', flush=True)

    # 只用 status=published 的
    posts = [p for p in posts if p.get('status') == 'published']
    print(f'  published: {len(posts)} 篇', flush=True)

    print('生成 HTML...', flush=True)
    content = render_homepage(posts)
    print(f'  HTML {len(content)} 字节', flush=True)

    print('PUT 更新 index page...', flush=True)
    r = update_index_page(content)
    print(f'  结果: {r}', flush=True)


if __name__ == '__main__':
    main()
