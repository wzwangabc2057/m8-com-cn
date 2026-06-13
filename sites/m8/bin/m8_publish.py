#!/usr/bin/env python3
"""
m8.com.cn 文章统一发布器（含 hero 上传 + CMS POST + Google Indexing API ping）。

输入：draft JSON（schema 见 raw/research/drafts/*.json）

用法：
    # 单篇（推 1 篇，自动 ping Google Indexing API）
    python3 m8_publish.py --json /tmp/m8_xxx_draft.json --slug xxx-deep-20260504 \\
                          --author "m8 编辑部" --hero /path/to/hero.jpg

    # 批量
    python3 m8_publish.py --batch publish_jobs.json

    # 跳过 Indexing API 调用（默认会 ping）
    python3 m8_publish.py ... --no-ping-google

batch.json 格式：
    [
      {"json": "/tmp/a.json", "slug": "...", "author": "...", "hero": "/path/a.jpg"},
      ...
    ]
"""
import argparse, hashlib, html, json, os, re, ssl, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from m8_image_gen import gen_image, upload_asset
from m8_http import apply_browser_ua

SITE_DIR = SCRIPT_DIR.parent
CONFIG_PATH = SITE_DIR / 'config.md'
ENV_PATH = SITE_DIR / '.env'
ENV = {}
if ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1); ENV[k.strip()] = v.strip()


def parse_scalar(value):
    raw = (value or '').strip()
    if not raw:
        return ''
    if raw[0] == raw[-1] and raw[0] in {'"', "'"}:
        return raw[1:-1]
    lowered = raw.lower()
    if lowered == 'true':
        return True
    if lowered == 'false':
        return False
    if lowered == 'null':
        return None
    if re.fullmatch(r'-?\d+', raw):
        try:
            return int(raw)
        except ValueError:
            return raw
    if re.fullmatch(r'-?\d+\.\d+', raw):
        try:
            return float(raw)
        except ValueError:
            return raw
    return raw


def load_site_config():
    if not CONFIG_PATH.exists():
        return {}

    config = {}
    for line in CONFIG_PATH.read_text(encoding='utf-8').splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or ':' not in stripped:
            continue
        key, value = stripped.split(':', 1)
        key = key.strip()
        if not re.fullmatch(r'[A-Za-z0-9_]+', key):
            continue
        config[key] = parse_scalar(value)
    return config


def env_or_config(*keys, default=None):
    for key in keys:
        if key in ENV and str(ENV[key]).strip():
            return ENV[key]
    for key in keys:
        if key in SITE_CONFIG and str(SITE_CONFIG[key]).strip():
            return SITE_CONFIG[key]
    return default


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


SITE_CONFIG = load_site_config()
CF_TOKEN = ENV['CF_CMS_TOKEN']
CMS_BASE = str(env_or_config('M8_CMS_BASE_URL', 'CF_CMS_URL', 'cf_cms_url', default='https://cloudflare-sites-cms.pages.dev')).rstrip('/')
SITE_ID = str(env_or_config('M8_SITE_ID', 'CF_SITE_ID', 'cf_site_id', default=SITE_CONFIG.get('domain') or 'm8.com.cn'))
DRAFTS_DIR = SITE_DIR / 'raw' / 'research' / 'drafts'
CONTENT_DIR = SITE_DIR / 'content'
BJ = timezone(timedelta(hours=8))
LIVE_BASE_URL = str(env_or_config('M8_LIVE_BASE_URL', 'cf_live_base_url', default=f'https://{SITE_CONFIG.get("domain") or SITE_ID}')).rstrip('/')
ARTICLE_PREFIX = str(env_or_config('M8_ARTICLE_PREFIX', 'cf_article_prefix', default='/article'))
INLINE_IMAGE_SIZE = ENV.get('M8_INLINE_IMAGE_SIZE', '1024x576')
INLINE_IMAGE_BACKEND = ENV.get('M8_INLINE_IMAGE_BACKEND', 'zimage')
INLINE_IMAGE_STEPS = int(ENV.get('M8_INLINE_IMAGE_STEPS', '8'))
VERIFY_LIVE = parse_bool(env_or_config('M8_VERIFY_LIVE', 'cf_verify_live', default=True), default=True)
STRICT_VERIFY = parse_bool(env_or_config('M8_STRICT_LIVE_VERIFY', 'cf_strict_live_verify', default=False), default=False)
VERIFY_RETRIES = int(env_or_config('M8_VERIFY_RETRIES', 'cf_verify_retries', default=4))
VERIFY_SLEEP_SECONDS = float(env_or_config('M8_VERIFY_SLEEP_SECONDS', 'cf_verify_sleep_seconds', default=3))
PUBLIC_AUTHOR_NAME = str(env_or_config('M8_PUBLIC_AUTHOR_NAME', 'author_name', default='m8 康哥'))
PRIMARY_MARKET_CATEGORIES = ['a-stocks', 'us-stocks', 'hk-stocks', 'crypto']
ALLOWED_CATEGORIES = PRIMARY_MARKET_CATEGORIES + ['macro', 'industry-research', 'ai-stocks', 'investing-101', 'earnings']

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency
    certifi = None


def build_ssl_context():
    cafile = ENV.get('SSL_CERT_FILE') or os.environ.get('SSL_CERT_FILE')
    if cafile:
        return ssl.create_default_context(cafile=cafile)
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


SSL_CONTEXT = build_ssl_context()


def open_url(req, timeout=30):
    req = apply_browser_ua(req)
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT)


def urlopen(req, timeout=30):
    return open_url(req, timeout=timeout)


def normalize_text(value):
    if value is None:
        return ''
    if not isinstance(value, str):
        value = str(value)
    return re.sub(r'\s+', ' ', html.unescape(value)).strip()


def normalize_author_name(_author=None):
    return PUBLIC_AUTHOR_NAME


def normalize_categories(categories):
    raw = categories or []
    unique = []
    seen = set()
    for item in raw:
        value = normalize_text(item)
        if not value or value in seen or value not in ALLOWED_CATEGORIES:
            continue
        seen.add(value)
        unique.append(value)

    primary_market = next((item for item in unique if item in PRIMARY_MARKET_CATEGORIES), None)
    remainder = [item for item in unique if item != primary_market]
    priority = {name: idx for idx, name in enumerate(ALLOWED_CATEGORIES)}
    remainder.sort(key=lambda item: priority.get(item, 999))
    normalized = ([primary_market] if primary_market else []) + remainder
    return normalized[:3]


def normalize_seo_payload(seo, title, excerpt):
    normalized = dict(seo or {})
    if title:
        normalized['title'] = title
        normalized.setdefault('ogTitle', title)
    if excerpt:
        normalized['description'] = excerpt
        normalized.setdefault('ogDescription', excerpt)

    schema = normalized.get('schema')
    if isinstance(schema, dict):
        if title:
            schema['headline'] = title
        if excerpt:
            schema['description'] = excerpt
        normalized['schema'] = schema

    return normalized


def strings_match(expected, actual):
    expected_norm = normalize_text(expected)
    actual_norm = normalize_text(actual)
    if expected_norm == actual_norm:
        return True
    if expected_norm and actual_norm and len(expected_norm) >= 80 and actual_norm in expected_norm:
        return True
    if expected_norm and actual_norm and len(actual_norm) >= 80 and expected_norm in actual_norm:
        return True
    return False


def title_matches(expected, actual):
    expected_norm = normalize_text(expected)
    actual_norm = normalize_text(actual)
    if not expected_norm:
        return True
    if expected_norm == actual_norm:
        return True
    if actual_norm.split('|', 1)[0].strip() == expected_norm:
        return True
    return expected_norm in actual_norm


def urls_match(expected, actual):
    expected_norm = normalize_text(expected).rstrip('/')
    actual_norm = normalize_text(actual).rstrip('/')
    return expected_norm == actual_norm


class HeadSnapshotParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in_title = False
        self._title_parts = []
        self.meta_description = ''
        self.canonical = ''

    def handle_starttag(self, tag, attrs):
        attrs_map = {key.lower(): value for key, value in attrs if key}
        tag = tag.lower()
        if tag == 'title':
            self._in_title = True
            return
        if tag == 'meta':
            name = (attrs_map.get('name') or '').lower()
            prop = (attrs_map.get('property') or '').lower()
            content = attrs_map.get('content') or ''
            if not self.meta_description and (name == 'description' or prop == 'og:description'):
                self.meta_description = content
            return
        if tag == 'link':
            rel = (attrs_map.get('rel') or '').lower()
            if not self.canonical and 'canonical' in rel:
                self.canonical = attrs_map.get('href') or ''

    def handle_endtag(self, tag):
        if tag.lower() == 'title':
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self._title_parts.append(data)

    @property
    def title(self):
        return ''.join(self._title_parts)


def build_request(url, data=None, method='GET', headers=None):
    base_headers = {'User-Agent': 'm8-publish/2.1'}
    if headers:
        base_headers.update(headers)
    req = urllib.request.Request(url, data=data, headers=base_headers, method=method)
    return req


def post_article(payload):
    req = build_request(
        f'{CMS_BASE}/api/posts?siteId={urllib.parse.quote(SITE_ID)}',
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {CF_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    return json.loads(urlopen(req, timeout=30).read())


def update_article(slug, payload):
    req = build_request(
        f'{CMS_BASE}/api/posts/{urllib.parse.quote(slug)}?siteId={urllib.parse.quote(SITE_ID)}',
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {CF_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='PUT',
    )
    return json.loads(urlopen(req, timeout=30).read())


def get_article(slug):
    req = build_request(
        f'{CMS_BASE}/api/posts/{urllib.parse.quote(slug)}?siteId={urllib.parse.quote(SITE_ID)}',
        headers={'Authorization': f'Bearer {CF_TOKEN}'},
    )
    return json.loads(urlopen(req, timeout=30).read())


def build_article_url(slug):
    return f'{LIVE_BASE_URL}{ARTICLE_PREFIX}/{slug}'


def build_article_path(slug):
    return f'{ARTICLE_PREFIX}/{slug}'


def get_runtime_settings():
    return {
        'cmsBase': CMS_BASE,
        'siteId': SITE_ID,
        'liveBaseUrl': LIVE_BASE_URL,
        'articlePrefix': ARTICLE_PREFIX,
        'verifyLive': VERIFY_LIVE,
        'strictVerify': STRICT_VERIFY,
        'verifyRetries': VERIFY_RETRIES,
        'verifySleepSeconds': VERIFY_SLEEP_SECONDS,
    }


def apply_runtime_overrides(cms_base=None, site_id=None, live_base_url=None, article_prefix=None,
                            verify_live=None, strict_verify=None):
    global CMS_BASE, SITE_ID, LIVE_BASE_URL, ARTICLE_PREFIX, VERIFY_LIVE, STRICT_VERIFY
    if cms_base:
        CMS_BASE = str(cms_base).rstrip('/')
    if site_id:
        SITE_ID = str(site_id)
    if live_base_url:
        LIVE_BASE_URL = str(live_base_url).rstrip('/')
    if article_prefix:
        ARTICLE_PREFIX = str(article_prefix)
    if verify_live is not None:
        VERIFY_LIVE = bool(verify_live)
    if strict_verify is not None:
        STRICT_VERIFY = bool(strict_verify)


def strip_tags(text):
    if not text:
        return ''
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', text)).strip()


def trunc(text, limit=42):
    text = strip_tags(text)
    return text if len(text) <= limit else text[: limit - 1].rstrip() + '…'


def load_published_corpus():
    corpus = {}
    for posted in DRAFTS_DIR.glob('*.json.posted'):
        try:
            item = json.loads(posted.read_text())
        except Exception:
            continue
        slug = item.get('slug')
        title = item.get('title')
        if not slug or not title or item.get('status') != 'published':
            continue
        corpus[slug] = {
            'slug': slug,
            'title': title,
            'excerpt': item.get('excerpt', ''),
            'categories': item.get('categories') or [],
            'tags': item.get('tags') or [],
            'collection': item.get('collection', ''),
            'publishedAt': item.get('publishedAt', ''),
        }
    return list(corpus.values())


def load_published_lookup():
    lookup = {}
    for item in load_published_corpus():
        lookup[item['slug']] = {
            'slug': item['slug'],
            'title': item['title'],
            'path': build_article_path(item['slug']),
            'url': build_article_url(item['slug']),
        }
    return lookup


def choose_related_posts(current, corpus, limit=3):
    current_cats = set(current.get('categories') or [])
    current_tags = set(current.get('tags') or [])
    ranked = []

    for candidate in corpus:
        if candidate['slug'] == current.get('slug'):
            continue
        score = 0
        shared_cats = current_cats & set(candidate.get('categories') or [])
        shared_tags = current_tags & set(candidate.get('tags') or [])
        score += len(shared_cats) * 6
        score += len(shared_tags) * 2
        if candidate.get('collection') == current.get('collection'):
            score += 1
        if not score and current_cats and any(cat in {'ai-stocks', 'us-stocks', 'a-stocks', 'industry-research', 'macro'} for cat in current_cats):
            if set(candidate.get('categories') or []) & {'ai-stocks', 'us-stocks', 'a-stocks', 'industry-research', 'macro'}:
                score = 1
        if score:
            ranked.append((score, candidate.get('publishedAt', ''), candidate))

    ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [candidate for _, _, candidate in ranked[:limit]]


def build_related_section(current, related_posts):
    if not related_posts:
        return ''
    items = []
    for post in related_posts:
        items.append(
            f'<li><a href="{html.escape(build_article_path(post["slug"]))}">{html.escape(post["title"])}</a>'
            f' <span style="color:#888;">{html.escape(trunc(post.get("excerpt", ""), 36))}</span></li>'
        )
    return (
        '<aside style="border-left:3px solid #006AFF;padding:12px 16px;margin:24px 0;background:#f6faff;">'
        '<p><strong>相关阅读</strong></p>'
        f'<ul>{"".join(items)}</ul>'
        '</aside>'
    )


def insert_related_section(content, section_html):
    if not content or not section_html:
        return content
    if re.search(r'<strong>\s*相关阅读\s*</strong>|<aside[^>]*>[\s\S]*?相关阅读[\s\S]*?</aside>', content):
        return content
    if len(re.findall(r'href=["\']\/article\/', content)) >= 2:
        return content

    insertion_points = [
        r'(<section[^>]*>\s*<h[23][^>]*>方法论与数据来源<\/h[23]>)',
        r'(<section[^>]*>\s*<h[23][^>]*>数据来源[^<]*<\/h[23]>)',
        r'(<p[^>]*class=["\']references["\'])',
        r'(<p[^>]*class=["\']disclaimer["\'])',
        r'(</article>)',
    ]
    for pattern in insertion_points:
        if re.search(pattern, content):
            return re.sub(pattern, section_html + r'\1', content, count=1)
    return content + section_html


def extract_schema_faq_entries(draft):
    seo = draft.get('seo') or {}
    schema_faq = seo.get('schemaFaq') or []
    if isinstance(schema_faq, dict):
        items = schema_faq.get('mainEntity') or []
    elif isinstance(schema_faq, list):
        items = schema_faq
    else:
        items = []

    entries = []
    for item in items:
        if not isinstance(item, dict):
            continue
        question = normalize_text(item.get('name'))
        answer_node = item.get('acceptedAnswer') or {}
        answer = normalize_text(answer_node.get('text') if isinstance(answer_node, dict) else '')
        if question and answer:
            entries.append((question, answer))
    return entries[:5]


def has_faq_section(content):
    return bool(re.search(r'<h2[^>]*>\s*(常见问题|FAQ)\s*</h2>', content, flags=re.IGNORECASE))


def build_faq_section(entries):
    if not entries:
        return ''
    blocks = ['<section><h2>常见问题</h2>']
    for question, answer in entries:
        blocks.append(f'<h3>{html.escape(question)}</h3>')
        blocks.append(f'<p>{html.escape(answer)}</p>')
    blocks.append('</section>')
    return ''.join(blocks)


def insert_before_tail_sections(content, section_html):
    if not content or not section_html:
        return content
    insertion_points = [
        r'(<aside[^>]*>[\s\S]*?<strong>\s*相关阅读\s*</strong>[\s\S]*?</aside>)',
        r'(<section[^>]*>\s*<h2[^>]*>\s*(方法论与数据来源|数据来源)\s*</h2>)',
        r'(<h2[^>]*>\s*(方法论与数据来源|数据来源)\s*</h2>)',
        r'(<p[^>]*class=["\']references["\'])',
        r'(<p[^>]*class=["\']disclaimer["\'])',
        r'(</article>)',
        r'(</body>)',
    ]
    for pattern in insertion_points:
        if re.search(pattern, content, flags=re.IGNORECASE):
            return re.sub(pattern, section_html + r'\1', content, count=1, flags=re.IGNORECASE)
    return content + section_html


def ensure_faq_section(content, draft):
    if not content or has_faq_section(content):
        return content
    faq_section = build_faq_section(extract_schema_faq_entries(draft))
    return insert_before_tail_sections(content, faq_section)


def resolve_wiki_target(target, lookup):
    cleaned = (target or '').strip()
    if not cleaned:
        return None
    if cleaned.startswith('/article/'):
        slug = cleaned.rsplit('/', 1)[-1]
        return {
            'slug': slug,
            'path': cleaned,
            'url': build_article_url(slug),
            'title': lookup.get(slug, {}).get('title', slug),
        }
    if cleaned.startswith('http://') or cleaned.startswith('https://'):
        return {
            'slug': cleaned.rsplit('/', 1)[-1],
            'path': cleaned,
            'url': cleaned,
            'title': cleaned,
        }
    if cleaned in lookup:
        return lookup[cleaned]
    return None


def build_category_path(category_slug):
    return f'/category/{urllib.parse.quote(category_slug)}'


def primary_market_hub(category_slug):
    mapping = {
        'a-stocks': ('A股核心标的', '/a-share-core-coverage'),
        'us-stocks': ('美股重点标的', '/us-stock-core-coverage'),
        'hk-stocks': ('港股研究中心', '/hk-tech-dividend'),
        'crypto': ('BTC ETF 中心', '/btc-etf-watch'),
        'macro': ('宏观利率中心', '/macro-rate-watch'),
        'industry-research': ('行业研究主线', '/glp1-drug-watch'),
        'ai-stocks': ('AI产业链中心', '/ai-supply-chain'),
        'investing-101': ('投资框架中心', '/investing-frameworks'),
    }
    return mapping.get(category_slug)


def category_display_name(category_slug):
    mapping = {
        'a-stocks': 'A股栏目',
        'us-stocks': '美股栏目',
        'hk-stocks': '港股栏目',
        'crypto': '加密栏目',
        'macro': '宏观栏目',
        'industry-research': '行业研究栏目',
        'ai-stocks': 'AI产业链栏目',
        'investing-101': '投资科普栏目',
        'earnings': '财报季栏目',
    }
    return mapping.get(category_slug, category_slug)


def topic_hub_from_text(text, categories):
    value = normalize_text(text).lower()
    secondary = set(categories or [])
    if any(keyword in value for keyword in ['tesla', 'fsd', 'robotaxi', 'optimus']):
        return ('Tesla / FSD 专题', '/tesla-fsd')
    if any(keyword in value for keyword in ['glp-1', 'glp1', 'wegovy', 'mounjaro', 'retatrutide', 'adc', '双抗']):
        return ('创新药 / GLP-1 专题', '/glp1-drug-watch')
    if any(keyword in value for keyword in ['openai', 'agent', 'copilot', 'anthropic', 'gpt']):
        return ('AI软件 / Agent', '/ai-agent-platforms')
    if any(keyword in value for keyword in ['bitcoin', 'btc', 'stablecoin', 'coinbase', 'base ', 'layer2', 'mstr', 'treasury beta']):
        return ('BTC ETF 中心', '/btc-etf-watch')
    if 'macro' in secondary or any(keyword in value for keyword in ['fomc', 'pce', 'cpi', 'ppi', 'nonfarm', 'dollar', '利率']):
        return ('宏观利率中心', '/macro-rate-watch')
    if 'ai-stocks' in secondary or any(keyword in value for keyword in ['hbm', 'gpu', 'cowos', 'advanced packaging', 'agentic ai', 'ai capex']):
        return ('AI产业链中心', '/ai-supply-chain')
    return None


def build_navigation_section(draft):
    categories = normalize_categories(draft.get('categories') or [])
    primary_category = categories[0] if categories else None
    topic_hub = topic_hub_from_text(
        f"{draft.get('slug', '')} {draft.get('title', '')} {' '.join(draft.get('tags') or [])}",
        categories,
    )

    links = [('<strong>研究导航</strong>', '/research-directory')]
    if primary_category:
        links.append((category_display_name(primary_category), build_category_path(primary_category)))
        market_hub = primary_market_hub(primary_category)
        if market_hub:
            links.append(market_hub)
    if topic_hub and topic_hub not in links:
        links.append(topic_hub)
    links.append(('查看全部文章', '/blog'))

    rendered = []
    seen = set()
    for label, href in links:
        if href in seen:
            continue
        seen.add(href)
        rendered.append(f'<a href="{html.escape(href)}">{label}</a>')

    return (
        '<aside style="border-left:3px solid #d97706;padding:12px 16px;margin:24px 0;background:#fff8eb;">'
        '<p style="margin:0 0 8px;"><strong>继续延伸</strong></p>'
        f'<p style="margin:0;color:#666;line-height:1.8;">{" · ".join(rendered)}</p>'
        '</aside>'
    )


def ensure_navigation_section(content, draft):
    if not content:
        return content
    if re.search(r'研究导航|继续延伸|/research-directory|/a-share-core-coverage|/us-stock-core-coverage', content):
        return content
    return insert_before_tail_sections(content, build_navigation_section(draft))


def resolve_wiki_links(content):
    if not content or '[[' not in content:
        return content
    lookup = load_published_lookup()

    def repl(match):
        raw_target = match.group(1).strip()
        raw_label = (match.group(2) or '').strip()
        resolved = resolve_wiki_target(raw_target, lookup)
        label = raw_label or (resolved['title'] if resolved else raw_target)
        if not resolved:
            return html.escape(label)
        href = resolved['path']
        return f'<a href="{html.escape(href)}">{html.escape(label)}</a>'

    return re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', repl, content)


def find_entry_dir(slug):
    matches = list(CONTENT_DIR.rglob(f'{slug}/{slug}.md'))
    if not matches:
        return None
    return matches[0].parent


def build_inline_image_prompt(kind, description):
    desc = re.sub(r'\s+', ' ', (description or '').strip())
    prompt_style = {
        'stock': 'photorealistic editorial illustration, realistic scene, soft natural lighting',
        'svg': 'minimal vector-style infographic illustration, geometric shapes, clean composition',
        'chart': 'data-visualization style infographic, chart-like composition, clean visual hierarchy',
    }.get((kind or '').strip().lower(), 'editorial illustration, clean composition')
    return (
        f'{desc}, {prompt_style}, widescreen composition, no text, no letters, no numbers, '
        'no watermark, no logo, no signature'
    )


def render_inline_figure(image_url, alt_text, caption=''):
    figure = [
        '<figure style="margin:24px 0;text-align:center;">',
        f'  <img src="{html.escape(image_url)}" alt="{html.escape(alt_text)}" '
        'style="max-width:100%;height:auto;border-radius:8px;" loading="lazy" />',
    ]
    if caption:
        figure.append(
            f'  <figcaption style="color:#888;font-size:12px;margin-top:8px;">{html.escape(caption)}</figcaption>'
        )
    figure.append('</figure>')
    return '\n'.join(figure)


def generate_inline_image_asset(slug, placeholder_index, kind, description):
    prompt = build_inline_image_prompt(kind, description)
    seed = int(hashlib.sha1(f'{slug}:{placeholder_index}:{kind}:{description}'.encode('utf-8')).hexdigest()[:8], 16)
    image_bytes = gen_image(
        prompt,
        size=INLINE_IMAGE_SIZE,
        steps=INLINE_IMAGE_STEPS,
        seed=seed,
        backend=INLINE_IMAGE_BACKEND,
    )
    ext = 'jpg' if INLINE_IMAGE_BACKEND == 'cogview' else 'png'
    filename = f'{slug}-inline-{placeholder_index:02d}.{ext}'
    _, full_url = upload_asset(image_bytes, filename)
    return full_url


def replace_image_placeholders(content, slug, cover_url=None):
    if not content or '[IMAGE:' not in content:
        return content

    counter = {'value': 0}

    def render_replacement(kind, description):
        counter['value'] += 1
        alt_text = re.sub(r'\s+', ' ', description).strip()
        try:
            full_url = generate_inline_image_asset(slug, counter['value'], kind, description)
            print(f'  [inline-image] generated #{counter["value"]} for {slug}', flush=True)
            return render_inline_figure(full_url, alt_text)
        except Exception as exc:
            print(f'  [inline-image] failed #{counter["value"]} for {slug}: {exc}', flush=True)
            if cover_url:
                return render_inline_figure(cover_url, alt_text)
            return f'<p style="color:#777;font-size:13px;">图示：{html.escape(alt_text)}</p>'

    patterns = [
        r'<figure[^>]*>\s*<!--\s*\[IMAGE:\s*([^|\]]+)\|([^\]]+?)\]\s*-->\s*</figure>',
        r'<figure[^>]*>\s*\[IMAGE:\s*([^|\]]+)\|([^\]]+?)\]\s*</figure>',
        r'<p>\s*\[IMAGE:\s*([^|\]]+)\|([^\]]+?)\]\s*</p>',
        r'<!--\s*\[IMAGE:\s*([^|\]]+)\|([^\]]+?)\]\s*-->',
        r'\[IMAGE:\s*([^|\]]+)\|([^\]]+?)\]',
    ]

    updated = content
    for pattern in patterns:
        updated = re.sub(
            pattern,
            lambda m: render_replacement(m.group(1).strip(), m.group(2).strip()),
            updated,
            flags=re.IGNORECASE | re.DOTALL,
        )
    return updated


def sanitize_article_content(draft, slug, cover_url=None):
    content = draft.get('content', '')
    if not content:
        return content
    content = resolve_wiki_links(content)
    content = replace_image_placeholders(content, slug, cover_url=cover_url)
    prepared = {**draft, 'slug': slug, 'content': content}
    prepared['content'] = ensure_faq_section(prepared['content'], prepared)
    prepared['content'] = ensure_navigation_section(prepared['content'], prepared)
    return enrich_content_with_related_links(prepared)


def enrich_content_with_related_links(draft):
    content = draft.get('content', '')
    if not content:
        return content
    related_posts = choose_related_posts(draft, load_published_corpus())
    section_html = build_related_section(draft, related_posts)
    return insert_related_section(content, section_html)


def update_source_frontmatter(slug, article_url, published_date):
    """Keep local content metadata aligned with the live route for link building."""
    content_root = SITE_DIR / 'content'
    matches = list(content_root.rglob(f'{slug}.md'))
    if not matches:
        print(f'  [frontmatter] source markdown not found for slug={slug}', flush=True)
        return

    md_path = matches[0]
    text = md_path.read_text(encoding='utf-8')
    match = re.match(r'^(---\n)([\s\S]*?)(\n---\n)', text)
    if not match:
        print(f'  [frontmatter] no frontmatter in {md_path}', flush=True)
        return

    frontmatter = match.group(2).splitlines()

    def set_field(name, value):
        prefix = f'{name}:'
        for i, line in enumerate(frontmatter):
            if line.startswith(prefix):
                frontmatter[i] = f'{name}: {value}'
                return
        frontmatter.append(f'{name}: {value}')

    set_field('status', 'published')
    set_field('published_url', f'"{article_url}"')
    set_field('published_at', f'"{published_date}"')

    updated = match.group(1) + '\n'.join(frontmatter) + match.group(3) + text[match.end():]
    md_path.write_text(updated, encoding='utf-8')
    print(f'  [frontmatter] updated {md_path}', flush=True)


def build_expected_snapshot(payload):
    seo = payload.get('seo') or {}
    description = seo.get('description') or payload.get('excerpt') or ''
    return {
        'title': payload.get('title') or '',
        'description': description,
        'canonical': build_article_url(payload['slug']),
    }


def build_cms_snapshot(post):
    post = post or {}
    seo = post.get('seo') or {}
    return {
        'title': post.get('title') or '',
        'description': seo.get('description') or post.get('excerpt') or '',
        'canonical': build_article_url(post.get('slug') or ''),
    }


def fetch_live_snapshot(slug):
    req = build_request(build_article_url(slug))
    text = urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')
    parser = HeadSnapshotParser()
    parser.feed(text)
    return {
        'title': parser.title,
        'description': parser.meta_description,
        'canonical': parser.canonical,
    }


def compare_snapshot(expected, actual, scope):
    mismatches = []
    expected_title = normalize_text(expected.get('title'))
    expected_description = normalize_text(expected.get('description'))
    expected_canonical = normalize_text(expected.get('canonical'))

    if expected_title:
        if scope == 'live':
            title_ok = title_matches(expected_title, actual.get('title'))
        else:
            title_ok = strings_match(expected_title, actual.get('title'))
    else:
        title_ok = True
    if not title_ok:
        mismatches.append({
            'field': 'title',
            'expected': expected_title,
            'actual': normalize_text(actual.get('title')),
        })
    if expected_description and not strings_match(expected_description, actual.get('description')):
        mismatches.append({
            'field': 'description',
            'expected': expected_description,
            'actual': normalize_text(actual.get('description')),
        })
    if scope == 'live' and expected_canonical and not urls_match(expected_canonical, actual.get('canonical')):
        mismatches.append({
            'field': 'canonical',
            'expected': expected_canonical,
            'actual': normalize_text(actual.get('canonical')),
        })
    return mismatches


def verify_publication(slug, payload, enabled=None):
    enabled = VERIFY_LIVE if enabled is None else bool(enabled)
    if not enabled:
        return {'enabled': False, 'ok': None}

    expected = build_expected_snapshot(payload)
    last = {
        'enabled': True,
        'ok': False,
        'attempts': 0,
        'cms': None,
        'live': None,
        'cmsMismatches': [],
        'liveMismatches': [],
        'errors': [],
    }

    for attempt in range(1, VERIFY_RETRIES + 1):
        current = {
            'enabled': True,
            'ok': False,
            'attempts': attempt,
            'cms': None,
            'live': None,
            'cmsMismatches': [],
            'liveMismatches': [],
            'errors': [],
        }
        try:
            cms_data = get_article(slug)
            cms_post = cms_data.get('post') if isinstance(cms_data, dict) else None
            current['cms'] = build_cms_snapshot(cms_post or {})
            current['cmsMismatches'] = compare_snapshot(expected, current['cms'], 'cms')
        except Exception as exc:
            current['errors'].append({'scope': 'cms', 'message': str(exc)})

        try:
            current['live'] = fetch_live_snapshot(slug)
            current['liveMismatches'] = compare_snapshot(expected, current['live'], 'live')
        except Exception as exc:
            current['errors'].append({'scope': 'live', 'message': str(exc)})

        current['ok'] = not current['errors'] and not current['cmsMismatches'] and not current['liveMismatches']
        last = current
        if current['ok']:
            return current
        if attempt < VERIFY_RETRIES:
            time.sleep(VERIFY_SLEEP_SECONDS)

    return last


def print_verification_result(slug, verification):
    if not verification.get('enabled'):
        print(f'  [verify] disabled for {slug}', flush=True)
        return
    if verification.get('ok'):
        print(f'  [verify] OK after {verification.get("attempts")} attempt(s)', flush=True)
        return

    print(f'  [verify] mismatch after {verification.get("attempts")} attempt(s)', flush=True)
    for item in verification.get('errors') or []:
        print(f'    - {item["scope"]} error: {item["message"]}', flush=True)
    for scope, mismatches in (('cms', verification.get('cmsMismatches') or []), ('live', verification.get('liveMismatches') or [])):
        for mismatch in mismatches:
            print(
                f'    - {scope}.{mismatch["field"]}: expected="{mismatch["expected"][:140]}" actual="{mismatch["actual"][:140]}"',
                flush=True,
            )


def publish_one(draft_json_path, slug, author, hero_path=None, ping_google=True,
                verify_live=None, strict_verify=None):
    """发布一篇。返回 {'slug', 'url', 'cover', 'indexing_ok', ...}"""
    verify_enabled = VERIFY_LIVE if verify_live is None else bool(verify_live)
    strict_enabled = STRICT_VERIFY if strict_verify is None else bool(strict_verify)

    draft = json.loads(Path(draft_json_path).read_text(encoding='utf-8'))
    now_iso = datetime.now(BJ).isoformat()
    draft['slug'] = slug

    # 1. 上传 hero 到 CMS（如有）
    cover_url = None
    if hero_path and Path(hero_path).exists():
        try:
            ext = 'jpg' if hero_path.lower().endswith(('.jpg', '.jpeg')) else 'png'
            public, full = upload_asset(Path(hero_path).read_bytes(), f'{slug}-cover.{ext}')
            cover_url = full
            print(f'  [hero] {public}', flush=True)
        except Exception as e:
            print(f'  [hero] upload failed: {e}', flush=True)

    draft['content'] = sanitize_article_content(draft, slug, cover_url=cover_url)

    # 2. POST 文章
    # Some drafts store title under seo.title instead of top-level title
    title = draft.get('title') or draft.get('seo', {}).get('title', '')
    excerpt = draft.get('excerpt') or draft.get('seo', {}).get('description', '')
    normalized_author = normalize_author_name(author or draft.get('author'))
    normalized_categories = normalize_categories(draft.get('categories', []))
    payload = {
        'siteId': SITE_ID, 'slug': slug,
        'title': title, 'excerpt': excerpt,
        'content': draft['content'], 'author': normalized_author,
        'status': 'published', 'publishedAt': now_iso,
        'type': draft.get('type', 'post'), 'collection': draft.get('collection', 'deep'),
        'categories': normalized_categories, 'tags': draft.get('tags', []),
        'coverImage': cover_url, 'seo': normalize_seo_payload(draft.get('seo', {}), title, excerpt),
    }
    r = post_article(payload)
    success = r.get('success', True)
    article_url = build_article_url(slug)
    print(f'  [cms] success={success} → {article_url}', flush=True)

    verification = verify_publication(slug, payload, enabled=verify_enabled) if success else {'enabled': verify_enabled, 'ok': False}
    print_verification_result(slug, verification)

    # 3. 归档 draft → .posted（带本地发布元数据）
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    posted_path = DRAFTS_DIR / f'{slug}.json.posted'
    posted_record = dict(payload)
    posted_record['_publish'] = {
        'posted_at': now_iso,
        'cmsBase': CMS_BASE,
        'siteId': SITE_ID,
        'verify': verification,
    }
    posted_path.write_text(json.dumps(posted_record, ensure_ascii=False, indent=2), encoding='utf-8')

    verified_publication = (not verify_enabled) or bool(verification.get('ok'))
    if verified_publication:
        # 3.5 回写本地内容 frontmatter，保证 link-builder / 索引同步拿到正确 published_url
        update_source_frontmatter(slug, article_url, now_iso[:10])
    else:
        print('  [frontmatter] skipped because live verification did not pass', flush=True)

    # 4. ping Google Indexing API
    indexing_ok = None
    indexing_err = None
    if ping_google and success and verified_publication:
        try:
            from m8_indexing import submit_url
            ir = submit_url(article_url)
            indexing_ok = 'urlNotificationMetadata' in ir
            if indexing_ok:
                print(f'  [google] indexing OK', flush=True)
            else:
                indexing_err = str(ir)[:200]
                print(f'  [google] indexing ERR: {indexing_err}', flush=True)
        except Exception as e:
            indexing_err = str(e)[:200]
            print(f'  [google] ping failed: {indexing_err}', flush=True)
    elif ping_google and success and not verified_publication:
        print('  [google] skipped because live verification did not pass', flush=True)

    if success and strict_enabled and verify_enabled and not verification.get('ok'):
        raise RuntimeError(f'publish verification failed for {slug}; target={CMS_BASE} live={article_url}')

    return {
        'slug': slug, 'url': article_url, 'cover': cover_url,
        'cms_ok': success, 'indexing_ok': indexing_ok, 'indexing_err': indexing_err,
        'verify_ok': verification.get('ok'),
        'verify': verification,
        'target': get_runtime_settings(),
    }


def repair_one(post_json_path, ping_google=False, verify_live=None, strict_verify=None):
    verify_enabled = VERIFY_LIVE if verify_live is None else bool(verify_live)
    strict_enabled = STRICT_VERIFY if strict_verify is None else bool(strict_verify)

    payload = json.loads(Path(post_json_path).read_text(encoding='utf-8'))
    slug = payload['slug']
    if not payload.get('content') or not payload.get('title'):
        try:
            current = get_article(slug).get('post') or {}
            payload = {**current, **payload}
        except Exception as exc:
            print(f'  [repair] failed to hydrate current CMS post for {slug}: {exc}', flush=True)
    original_content = payload.get('content', '')
    original_author = payload.get('author')
    original_categories = list(payload.get('categories') or [])
    cover_url = payload.get('coverImage')

    if not cover_url:
        entry_dir = find_entry_dir(slug)
        if entry_dir:
            for ext in ('.png', '.jpg', '.jpeg', '.webp'):
                hero_candidate = entry_dir / f'hero{ext}'
                if hero_candidate.exists():
                    try:
                        public, full = upload_asset(hero_candidate.read_bytes(), f'{slug}-cover{ext}')
                        cover_url = full
                        payload['coverImage'] = full
                        print(f'  [repair-hero] {public}', flush=True)
                        break
                    except Exception as exc:
                        print(f'  [repair-hero] upload failed: {exc}', flush=True)

    payload['author'] = normalize_author_name(payload.get('author'))
    payload['categories'] = normalize_categories(payload.get('categories', []))
    payload['content'] = sanitize_article_content(payload, slug, cover_url=cover_url)
    payload['seo'] = normalize_seo_payload(payload.get('seo', {}), payload.get('title', ''), payload.get('excerpt', ''))
    changed = (
        payload['content'] != original_content
        or payload.get('coverImage') != cover_url
        or payload.get('author') != original_author
        or payload.get('categories') != original_categories
    )

    if not changed:
        return {'slug': slug, 'updated': False, 'reason': 'no placeholders or wikilinks found'}

    result = update_article(slug, payload)
    verification = verify_publication(slug, payload, enabled=verify_enabled) if result.get('success') else {'enabled': verify_enabled, 'ok': False}
    print_verification_result(slug, verification)

    payload['_publish'] = {
        'repaired_at': datetime.now(BJ).isoformat(),
        'cmsBase': CMS_BASE,
        'siteId': SITE_ID,
        'verify': verification,
    }
    Path(post_json_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    indexing_ok = None
    indexing_err = None
    article_url = build_article_url(slug)
    verified_publication = (not verify_enabled) or bool(verification.get('ok'))
    if ping_google and verified_publication:
        try:
            from m8_indexing import submit_url
            ir = submit_url(article_url)
            indexing_ok = 'urlNotificationMetadata' in ir
            if not indexing_ok:
                indexing_err = str(ir)[:200]
        except Exception as exc:
            indexing_err = str(exc)[:200]
    elif ping_google and not verified_publication:
        print('  [google] skipped because live verification did not pass', flush=True)

    if result.get('success') and strict_enabled and verify_enabled and not verification.get('ok'):
        raise RuntimeError(f'repair verification failed for {slug}; target={CMS_BASE} live={article_url}')

    return {
        'slug': slug,
        'updated': bool(result.get('success')),
        'url': article_url,
        'cover': payload.get('coverImage'),
        'indexing_ok': indexing_ok,
        'indexing_err': indexing_err,
        'verify_ok': verification.get('ok'),
        'verify': verification,
        'target': get_runtime_settings(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', help='单篇 draft JSON 路径')
    ap.add_argument('--slug', help='单篇 slug')
    ap.add_argument('--author', help='单篇作者')
    ap.add_argument('--hero', help='单篇 hero 图路径')
    ap.add_argument('--batch', help='批量 jobs JSON（list of {json, slug, author, hero}）')
    ap.add_argument('--repair-posted', help='修复单篇已发布 JSON（.json.posted）')
    ap.add_argument('--no-ping-google', action='store_true', help='跳过 Indexing API ping')
    ap.add_argument('--cms-base', help='覆盖 CMS 基地址')
    ap.add_argument('--site-id', help='覆盖 siteId')
    ap.add_argument('--live-base-url', help='覆盖 live 站点域名，例如 https://m8.com.cn')
    ap.add_argument('--article-prefix', help='覆盖文章前缀，默认 /article')
    ap.add_argument('--no-verify-live', action='store_true', help='跳过发布后 CMS/live 校验')
    ap.add_argument('--strict-verify', action='store_true', help='校验失败时抛错')
    ap.add_argument('--show-targets', action='store_true', help='打印当前发布目标后退出')
    args = ap.parse_args()

    apply_runtime_overrides(
        cms_base=args.cms_base,
        site_id=args.site_id,
        live_base_url=args.live_base_url,
        article_prefix=args.article_prefix,
        verify_live=False if args.no_verify_live else None,
        strict_verify=True if args.strict_verify else None,
    )

    if args.show_targets:
        print(json.dumps(get_runtime_settings(), ensure_ascii=False, indent=2))
        return

    ping = not args.no_ping_google
    results = []

    if args.batch:
        jobs = json.loads(Path(args.batch).read_text(encoding='utf-8'))
        for job in jobs:
            print(f"\n=== {job['slug']} ===", flush=True)
            results.append(publish_one(job['json'], job['slug'], job['author'],
                                       hero_path=job.get('hero'), ping_google=ping))
    elif args.repair_posted:
        print(f"\n=== repair {args.repair_posted} ===", flush=True)
        results.append(repair_one(args.repair_posted, ping_google=ping))
    elif args.json and args.slug and args.author:
        print(f"\n=== {args.slug} ===", flush=True)
        results.append(publish_one(args.json, args.slug, args.author,
                                   hero_path=args.hero, ping_google=ping))
    else:
        ap.error('需要 --batch / --repair-posted / (--json + --slug + --author)')

    print('\n=== SUMMARY ===')
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
