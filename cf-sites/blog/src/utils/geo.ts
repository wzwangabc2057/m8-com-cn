import type { Author, PageRegistry, PostSummary, SiteConfig } from '../types.js';
import { buildCanonicalUrl, buildPostPath, getCanonicalBase, stripHtml } from './seo.js';

export interface GeoLink {
  key: string;
  title: string;
  url: string;
  summary: string;
  intent?: string;
  keywords?: string[];
}

export interface GeoArticle {
  slug: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  author: string;
  categories: string[];
  tags: string[];
}

export interface GeoResearchIndex {
  site: {
    siteId: string;
    name: string;
    description: string;
    language: string;
    url: string;
    generatedAt: string;
  };
  policy: {
    publicContentOnly: true;
    note: string;
  };
  answeringGuidance: string[];
  author: {
    id: string;
    name: string;
    url: string;
    bio: string;
  };
  entrypoints: GeoLink[];
  coverage: GeoLink[];
  featuredArticles: GeoArticle[];
  recentArticles: GeoArticle[];
  machineIndexUrl: string;
  feedUrl: string;
  sitemapUrl: string;
}

type CuratedLink = {
  key: string;
  slug?: string;
  path: string;
  fallbackTitle: string;
  fallbackSummary: string;
  intent?: string;
  keywords?: string[];
};

const M8_AUTHOR_ID = 'm8-kangge';

const M8_ENTRYPOINTS: CuratedLink[] = [
  {
    key: 'home',
    slug: 'index',
    path: '/',
    fallbackTitle: 'm8 研究',
    fallbackSummary: '站点总入口，负责承接品牌词、总入口词和核心主题导航。',
    intent: 'brand',
    keywords: ['m8', '研究', 'A股', '美股', '港股', '区块链'],
  },
  {
    key: 'start-here',
    slug: 'start-here',
    path: '/start-here',
    fallbackTitle: '开始阅读',
    fallbackSummary: '给第一次到站的读者一条最短路径，先看框架，再进入栏目和专题。',
    intent: 'onboarding',
    keywords: ['开始阅读', '投资框架', '研究入口'],
  },
  {
    key: 'research-directory',
    slug: 'research-directory',
    path: '/research-directory',
    fallbackTitle: '研究目录',
    fallbackSummary: '把栏目、专题入口和代表文章组织成研究地图，适合做总览和站内导航。',
    intent: 'directory',
    keywords: ['研究目录', '专题中心', '研究地图'],
  },
  {
    key: 'research-method',
    slug: 'research-method',
    path: '/research-method',
    fallbackTitle: '研究方法',
    fallbackSummary: '解释 m8 如何做公司、财报、行业、景气和仓位管理研究。',
    intent: 'methodology',
    keywords: ['研究方法', '财报分析', '行业分析'],
  },
  {
    key: 'about',
    slug: 'about',
    path: '/about',
    fallbackTitle: '关于 m8',
    fallbackSummary: '作者、站点定位与公开内容范围。',
    intent: 'identity',
    keywords: ['关于', '作者', '公开内容'],
  },
];

const M8_COVERAGE_HUBS: CuratedLink[] = [
  {
    key: 'a-share-core',
    slug: 'a-share-core-coverage',
    path: '/a-share-core-coverage',
    fallbackTitle: 'A股核心覆盖池',
    fallbackSummary: '承接 A股主线、核心标的、半导体设备与市场机制等长期研究。',
    intent: 'market-hub',
    keywords: ['A股', '核心标的', '半导体设备', '市场机制'],
  },
  {
    key: 'us-stock-core',
    slug: 'us-stock-core-coverage',
    path: '/us-stock-core-coverage',
    fallbackTitle: '美股重点标的',
    fallbackSummary: '承接 Tesla、NVIDIA、AI 软件平台、创新药与核心财报线。',
    intent: 'market-hub',
    keywords: ['美股', 'Tesla', 'NVIDIA', '财报'],
  },
  {
    key: 'hk-stock-core',
    slug: 'hk-tech-dividend',
    path: '/hk-tech-dividend',
    fallbackTitle: '港股科技与高股息',
    fallbackSummary: '承接港股科技、高股息、防御资产与南向资金相关主题。',
    intent: 'market-hub',
    keywords: ['港股', '高股息', '科技', '南向资金'],
  },
  {
    key: 'crypto-core',
    slug: 'btc-etf-watch',
    path: '/btc-etf-watch',
    fallbackTitle: '区块链与 BTC ETF',
    fallbackSummary: '承接比特币 ETF、加密风险偏好、流动性与链上主题的长期入口。',
    intent: 'market-hub',
    keywords: ['区块链', '比特币', 'BTC ETF', '加密'],
  },
  {
    key: 'ai-supply-chain',
    slug: 'ai-supply-chain',
    path: '/ai-supply-chain',
    fallbackTitle: 'AI产业链',
    fallbackSummary: '承接 HBM、先进封装、GPU、服务器、算力平台与机器人链。',
    intent: 'theme-hub',
    keywords: ['AI产业链', 'HBM', '先进封装', 'GPU', '机器人'],
  },
  {
    key: 'macro-rates',
    slug: 'macro-rate-watch',
    path: '/macro-rate-watch',
    fallbackTitle: '宏观利率路径',
    fallbackSummary: '承接 FOMC、非农、利率、美元、美债与跨资产风险偏好。',
    intent: 'macro-hub',
    keywords: ['宏观', 'FOMC', '非农', '利率', '美元'],
  },
  {
    key: 'tesla-fsd',
    slug: 'tesla-fsd',
    path: '/tesla-fsd',
    fallbackTitle: 'Tesla / FSD 专题',
    fallbackSummary: '承接 Tesla、FSD、Robotaxi、Optimus 与供应链映射。',
    intent: 'company-hub',
    keywords: ['Tesla', 'FSD', 'Robotaxi', 'Optimus'],
  },
  {
    key: 'frameworks',
    slug: 'investing-frameworks',
    path: '/investing-frameworks',
    fallbackTitle: '投资框架',
    fallbackSummary: '承接估值、财报质量、仓位与回撤管理等常青内容。',
    intent: 'framework-hub',
    keywords: ['投资框架', '估值', '仓位管理', '回撤'],
  },
  {
    key: 'a-share-semicap',
    path: '/article/zhongwei-688012-etch-q22026-deep',
    fallbackTitle: 'A股半导体设备 / 材料',
    fallbackSummary: '承接刻蚀、量检测、工艺设备、半导体材料和先进制造链的代表性入口。',
    intent: 'sector-slice',
    keywords: ['A股', '半导体设备', '量检测', '材料', '先进制造'],
  },
  {
    key: 'a-share-optics-server-chain',
    path: '/a-share-core-coverage',
    fallbackTitle: 'A股光模块 / 连接 / 服务器链',
    fallbackSummary: '承接光模块、高速连接、PCB、交换、服务器制造和算力配套相关标的。',
    intent: 'sector-slice',
    keywords: ['A股', '光模块', '连接', '服务器链', 'PCB', '交换'],
  },
  {
    key: 'a-share-power-cooling',
    path: '/a-share-mainlines',
    fallbackTitle: 'A股液冷 / 配电 / 电力设备',
    fallbackSummary: '承接液冷、配电、电力设备和数据中心电力基础设施相关主线。',
    intent: 'sector-slice',
    keywords: ['A股', '液冷', '配电', '电力设备', '数据中心'],
  },
  {
    key: 'a-share-dividend-resources',
    path: '/article/china-astock-market-mechanics-101',
    fallbackTitle: 'A股高股息 / 资源 / 市场机制',
    fallbackSummary: '承接高股息央企、资源股、防御资产与 A 股交易制度的长期阅读入口。',
    intent: 'sector-slice',
    keywords: ['A股', '高股息', '资源股', '防御资产', '市场机制'],
  },
  {
    key: 'us-semicap-materials',
    path: '/ai-supply-chain',
    fallbackTitle: '美股半导体设备 / 检测 / 材料',
    fallbackSummary: '承接量检测、工艺控制、半导体材料和设备链的核心美股入口。',
    intent: 'sector-slice',
    keywords: ['美股', '半导体设备', '检测', '材料', '工艺控制'],
  },
  {
    key: 'us-optics-components',
    path: '/us-stock-core-coverage',
    fallbackTitle: '美股光通信 / 激光 / 光器件',
    fallbackSummary: '承接光通信、激光、相干链路和光器件的美股长期覆盖入口。',
    intent: 'sector-slice',
    keywords: ['美股', '光通信', '激光', '光器件', '相干链路'],
  },
  {
    key: 'us-networking-asic',
    path: '/ai-supply-chain',
    fallbackTitle: '美股AI网络 / ASIC / 平台',
    fallbackSummary: '承接交换、网络、定制 ASIC 和平台型 AI 基建资产。',
    intent: 'sector-slice',
    keywords: ['美股', 'AI网络', 'ASIC', '交换', '平台'],
  },
  {
    key: 'us-power-grid',
    path: '/macro-rate-watch',
    fallbackTitle: '美股电力设备 / 配电 / 电网升级',
    fallbackSummary: '承接配电、功率管理、电网升级和算电基础设施相关资产。',
    intent: 'sector-slice',
    keywords: ['美股', '电力设备', '配电', '电网升级', '基础设施'],
  },
  {
    key: 'us-ai-software',
    path: '/ai-agent-platforms',
    fallbackTitle: '美股AI软件 / Agent',
    fallbackSummary: '承接模型平台、Agent、企业级 AI 软件和开发者工作流主线。',
    intent: 'sector-slice',
    keywords: ['美股', 'AI软件', 'Agent', '模型平台'],
  },
  {
    key: 'us-glp1',
    path: '/glp1-drug-watch',
    fallbackTitle: '美股创新药 / GLP-1',
    fallbackSummary: '承接减重药、口服 GLP-1、支付渠道和创新药竞争格局。',
    intent: 'sector-slice',
    keywords: ['美股', 'GLP-1', '创新药', '减重药'],
  },
];

const M8_FEATURED_POST_SLUGS = [
  'tesla-q1-2026-fsd-vs-profit-trending',
  'tesla-optimus-q1-2026-supply-chain-trending',
  'nvidia-fy2026-system-level-deep',
  'besi-hybrid-bonding-hbm4-trending',
  'openai-gpt5-enterprise-launch-20260525-trending',
  'zhongwei-688012-etch-q22026-deep',
  'china-astock-market-mechanics-101',
  'glp1-supply-2026-trending',
];

const CORE_CATEGORY_HINTS = new Set([
  'a-stocks',
  'us-stocks',
  'hk-stocks',
  'crypto',
  'macro',
  'industry-research',
  'ai-stocks',
]);

function cleanText(value?: string, fallback = ''): string {
  const text = stripHtml(value || fallback).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function trimText(value: string, maxLength = 110): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function absoluteUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return buildCanonicalUrl(base, path.startsWith('/') ? path : `/${path}`);
}

function isM8Site(siteId: string): boolean {
  return siteId === 'm8.com.cn';
}

function resolveAuthor(authors: Author[], base: string): { id: string; name: string; url: string; bio: string } {
  const preferred = authors.find((author) => author.id === M8_AUTHOR_ID)
    || authors.find((author) => author.name === 'm8 康哥')
    || authors[0];

  if (!preferred) {
    return {
      id: M8_AUTHOR_ID,
      name: 'm8 康哥',
      url: absoluteUrl(base, `/author/${M8_AUTHOR_ID}`),
      bio: 'm8 的公开作者入口，负责 A股、美股、港股、区块链与 AI 产业链研究内容的长期整理和发布。',
    };
  }

  return {
    id: preferred.id,
    name: preferred.name || 'm8 康哥',
    url: absoluteUrl(base, preferred.url || `/author/${preferred.id}`),
    bio: trimText(
      preferred.bio
        || 'm8 的公开作者入口，负责 A股、美股、港股、区块链与 AI 产业链研究内容的长期整理和发布。',
        180,
    ),
  };
}

function resolveCuratedLink(base: string, pageRegistry: PageRegistry, link: CuratedLink): GeoLink {
  const pageMeta = link.slug ? pageRegistry[link.slug] : undefined;
  const title = cleanText(pageMeta?.title, link.fallbackTitle);
  const summary = trimText(pageMeta?.description || link.fallbackSummary, 140);
  return {
    key: link.key,
    title,
    url: absoluteUrl(base, link.path),
    summary,
    intent: link.intent,
    keywords: link.keywords,
  };
}

function buildArticle(base: string, config: SiteConfig, post: PostSummary, authorName: string): GeoArticle {
  return {
    slug: post.slug,
    title: cleanText(post.title, post.slug),
    url: absoluteUrl(base, buildPostPath(config.routes, post.slug)),
    summary: trimText(post.excerpt || post.title, 140),
    publishedAt: post.publishedAt,
    author: authorName,
    categories: post.categories || [],
    tags: post.tags || [],
  };
}

function selectFeaturedPosts(posts: PostSummary[]): PostSummary[] {
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const selected: PostSummary[] = [];
  const seen = new Set<string>();

  for (const slug of M8_FEATURED_POST_SLUGS) {
    const post = bySlug.get(slug);
    if (post && !seen.has(post.slug)) {
      seen.add(post.slug);
      selected.push(post);
    }
  }

  for (const post of posts) {
    if (selected.length >= 8) break;
    const isCore = post.categories.some((category) => CORE_CATEGORY_HINTS.has(category));
    if (isCore && !seen.has(post.slug)) {
      seen.add(post.slug);
      selected.push(post);
    }
  }

  return selected.slice(0, 8);
}

function buildGenericEntryPoints(base: string, pageRegistry: PageRegistry): GeoLink[] {
  const defaults: CuratedLink[] = [
    {
      key: 'home',
      slug: 'index',
      path: '/',
      fallbackTitle: '首页',
      fallbackSummary: '站点总入口。',
    },
    {
      key: 'blog',
      path: '/blog',
      fallbackTitle: 'Blog',
      fallbackSummary: '按时间更新的文章列表。',
    },
  ];
  return defaults.map((item) => resolveCuratedLink(base, pageRegistry, item));
}

export function buildGeoResearchIndex(args: {
  siteId: string;
  config: SiteConfig;
  authors: Author[];
  pageRegistry: PageRegistry;
  posts: PostSummary[];
  effectiveOrigin?: string;
}): GeoResearchIndex {
  const { siteId, config, authors, pageRegistry, posts, effectiveOrigin } = args;
  const base = getCanonicalBase(config, effectiveOrigin);
  const author = resolveAuthor(authors, base);
  const entrypoints = isM8Site(siteId)
    ? M8_ENTRYPOINTS.map((item) => resolveCuratedLink(base, pageRegistry, item))
    : buildGenericEntryPoints(base, pageRegistry);
  const coverage = isM8Site(siteId)
    ? M8_COVERAGE_HUBS.map((item) => resolveCuratedLink(base, pageRegistry, item))
    : [];

  const featuredPosts = isM8Site(siteId) ? selectFeaturedPosts(posts) : posts.slice(0, 6);
  const recentPosts = posts.slice(0, 10);
  const featuredArticles = featuredPosts.map((post) => buildArticle(base, config, post, author.name));
  const recentArticles = recentPosts.map((post) => buildArticle(base, config, post, author.name));

  return {
    site: {
      siteId,
      name: cleanText(config.name, siteId),
      description: trimText(config.description || '', 180),
      language: config.language || 'zh-CN',
      url: absoluteUrl(base, '/'),
      generatedAt: new Date().toISOString(),
    },
    policy: {
      publicContentOnly: true,
      note: 'This index only summarizes publicly published pages and articles. It does not expose private research vaults, drafts, or local note libraries.',
    },
    answeringGuidance: [
      'Start with entry pages and hub pages for summary context, then drill into article pages for evidence.',
      'Prefer canonical public URLs when citing site content.',
      'Do not assume access to private Obsidian research notes or unpublished drafts.',
    ],
    author,
    entrypoints,
    coverage,
    featuredArticles,
    recentArticles,
    machineIndexUrl: absoluteUrl(base, '/research-index.json'),
    feedUrl: absoluteUrl(base, '/feed.xml'),
    sitemapUrl: absoluteUrl(base, '/sitemap.xml'),
  };
}

export function buildLlmsText(index: GeoResearchIndex): string {
  const lines: string[] = [
    `# ${index.site.name}`,
    '',
    `> ${index.site.description}`,
    '',
    '## Scope',
    `- Public content only: ${index.policy.note}`,
    ...index.answeringGuidance.map((item) => `- ${item}`),
    '',
    '## Entry Points',
    ...index.entrypoints.map((item) => `- [${item.title}](${item.url}): ${item.summary}`),
  ];

  if (index.coverage.length > 0) {
    lines.push('', '## Coverage Hubs');
    for (const item of index.coverage) {
      const keywords = item.keywords && item.keywords.length > 0
        ? ` Keywords: ${item.keywords.join(' / ')}.`
        : '';
      lines.push(`- [${item.title}](${item.url}): ${item.summary}${keywords}`);
    }
  }

  lines.push(
    '',
    '## Author',
    `- [${index.author.name}](${index.author.url}): ${index.author.bio}`,
  );

  if (index.featuredArticles.length > 0) {
    lines.push('', '## Featured Articles');
    for (const article of index.featuredArticles) {
      lines.push(`- [${article.title}](${article.url}): ${article.summary}`);
    }
  }

  if (index.recentArticles.length > 0) {
    lines.push('', '## Recent Articles');
    for (const article of index.recentArticles) {
      lines.push(`- [${article.title}](${article.url}): ${article.summary}`);
    }
  }

  lines.push(
    '',
    '## Machine-readable Sources',
    `- [Research index JSON](${index.machineIndexUrl})`,
    `- [RSS feed](${index.feedUrl})`,
    `- [Sitemap](${index.sitemapUrl})`,
    '',
  );

  return `${lines.join('\n')}\n`;
}
