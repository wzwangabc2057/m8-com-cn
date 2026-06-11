
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCategories, getTags, getCollections, getAuthors } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';

import {
  buildHomeSeo,
  buildCategorySeoMeta,
  buildWebSiteSchema,
  buildOrganizationSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import { resolveLabels } from '../utils/i18n.js';
import { isUncategorized, enrichPostsWithCategoryDisplayNames } from '../utils/uncategorized.js';
import type { Env } from '../types.js';

const M8_FOCUS_CATEGORIES = ['ai-stocks', 'industry-research', 'a-stocks', 'us-stocks'];
const M8_HIDDEN_HOME_CATEGORIES = new Set(['investing-101']);
const M8_LINKS = {
  researchDirectory: '/research-directory',
  startHere: '/start-here',
  researchMethod: '/research-method',
  aiSupplyChain: '/ai-supply-chain',
  aiAgentPlatforms: '/ai-agent-platforms',
  aShareCoreCoverage: '/a-share-core-coverage',
  aShareMainlines: '/a-share-mainlines',
  usStockCoreCoverage: '/us-stock-core-coverage',
  macroRateWatch: '/macro-rate-watch',
  teslaFsd: '/tesla-fsd',
  investingFrameworks: '/investing-frameworks',
  hkTechDividend: '/hk-tech-dividend',
  btcEtfWatch: '/btc-etf-watch',
  blog: '/blog',
  besiHbm4: '/article/besi-hybrid-bonding-hbm4-trending',
  openaiGpt5: '/article/openai-gpt5-enterprise-launch-20260525-trending',
  teslaQ1: '/article/tesla-q1-2026-fsd-vs-profit-trending',
  teslaOptimus: '/article/tesla-optimus-q1-2026-supply-chain-trending',
  zhongwei: '/article/zhongwei-688012-etch-q22026-deep',
  nvidiaSystem: '/article/nvidia-fy2026-system-level-deep',
  astockMechanics: '/article/china-astock-market-mechanics-101',
  glp1Supply: '/article/glp1-supply-2026-trending',
} as const;

type HomeLink = {
  label: string;
  href: string;
};

type HomeResearchTrack = {
  kicker: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  links: HomeLink[];
};

type HomeHubCard = {
  kicker: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  links: HomeLink[];
};

type HomeReadingStep = {
  step: string;
  title: string;
  description: string;
  links: HomeLink[];
};

function isZhLanguage(language?: string): boolean {
  return (language || '').toLowerCase().startsWith('zh');
}

function normalizeText(value?: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function isBrandLikeTitle(title: string, siteName: string): boolean {
  const normalizedTitle = normalizeText(title).toLowerCase();
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  if (!normalizedTitle) return true;
  if (normalizedTitle === normalizedSiteName) return true;
  return normalizedTitle.replace(/[|·\-:：]/g, '') === normalizedSiteName.replace(/[|·\-:：]/g, '');
}

function buildCollectionPath(blogPrefix?: string): string {
  if (blogPrefix === '') return '/';
  return `/${blogPrefix || 'blog'}`;
}

function buildCategoryPath(categoryPrefix: string | undefined, slug: string): string {
  const prefix = categoryPrefix || 'category';
  return prefix === '' ? `/${slug}` : `/${prefix}/${slug}`;
}

function trimDescription(description: string, fallback: string, maxLength = 92): string {
  const cleaned = normalizeText(description || fallback);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}...`;
}

function buildM8ResearchTracks(isZh: boolean): HomeResearchTrack[] {
  if (!isZh) {
    return [
      {
        kicker: 'AI Supply Chain',
        title: 'AI infrastructure and compute roadmap',
        description: 'Track HBM, advanced packaging, GPUs, AI software, and robotics through linked section pages instead of one-off stories.',
        href: M8_LINKS.aiSupplyChain,
        cta: 'Open AI supply chain',
        links: [
          { label: 'HBM / advanced packaging', href: M8_LINKS.besiHbm4 },
          { label: 'AI software / agents', href: M8_LINKS.aiAgentPlatforms },
          { label: 'Tesla / robotics', href: M8_LINKS.teslaFsd },
        ],
      },
      {
        kicker: 'US Stocks',
        title: 'Priority US stock coverage',
        description: 'Turn Tesla, NVIDIA, model platforms, semicap, and GLP-1 into a durable research pool instead of a loose news archive.',
        href: M8_LINKS.usStockCoreCoverage,
        cta: 'Open US core coverage',
        links: [
          { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
          { label: 'NVIDIA system cycle', href: M8_LINKS.nvidiaSystem },
          { label: 'GPT-5 enterprise launch', href: M8_LINKS.openaiGpt5 },
        ],
      },
      {
        kicker: 'China A-Shares',
        title: 'Core A-share coverage pool',
        description: 'Build deeper company coverage around domestic substitution, semicap, servers, robotics components, and dividend defensives.',
        href: M8_LINKS.aShareCoreCoverage,
        cta: 'Open A-share core coverage',
        links: [
          { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
          { label: 'Zhongwei deep dive', href: M8_LINKS.zhongwei },
          { label: 'Market mechanics', href: M8_LINKS.astockMechanics },
        ],
      },
      {
        kicker: 'Macro',
        title: 'Rates and cross-asset transmission',
        description: 'Organize FOMC, payrolls, USD, gold, BTC ETF, and risk appetite into a separate layer for macro search demand and allocation context.',
        href: M8_LINKS.macroRateWatch,
        cta: 'Open macro rate watch',
        links: [
          { label: 'Macro rate watch', href: M8_LINKS.macroRateWatch },
          { label: 'BTC ETF center', href: M8_LINKS.btcEtfWatch },
          { label: 'Investing frameworks', href: M8_LINKS.investingFrameworks },
        ],
      },
    ];
  }

  return [
    {
      kicker: 'AI Supply Chain',
      title: 'AI产业链与算力主线',
      description: '围绕 HBM、先进封装、GPU 路线图、AI 软件入口和机器人链，把产业催化、公司映射和验证节点收成连续阅读入口。',
      href: M8_LINKS.aiSupplyChain,
      cta: '进入 AI产业链栏目',
      links: [
        { label: 'HBM / 先进封装', href: M8_LINKS.besiHbm4 },
        { label: 'AI软件 / Agent', href: M8_LINKS.aiAgentPlatforms },
        { label: 'Tesla / 机器人链', href: M8_LINKS.teslaFsd },
      ],
    },
    {
      kicker: 'US Stocks',
      title: '美股重点标的与财报线',
      description: '把 Tesla、NVIDIA、OpenAI 生态、半导体设备和创新药主题收成长期覆盖池，避免美股内容停留在零散事件稿。',
      href: M8_LINKS.usStockCoreCoverage,
      cta: '进入 美股重点标的',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'NVIDIA 系统级资本开支', href: M8_LINKS.nvidiaSystem },
        { label: 'GPT-5 企业版', href: M8_LINKS.openaiGpt5 },
      ],
    },
    {
      kicker: 'China A-Shares',
      title: 'A股核心覆盖池',
      description: '围绕国产替代、半导体设备、服务器链、机器人零部件和高股息央企，建立可持续迭代的公司研究池和专题地图。',
      href: M8_LINKS.aShareCoreCoverage,
      cta: '进入 A股核心标的',
      links: [
        { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
        { label: '中微公司深度', href: M8_LINKS.zhongwei },
        { label: 'A股市场机制', href: M8_LINKS.astockMechanics },
      ],
    },
    {
      kicker: 'Macro',
      title: '宏观利率与跨资产传导',
      description: '把 FOMC、非农、美元、黄金、BTC ETF 和风险偏好变化组织成独立入口，承接宏观查询词和配置阅读路径。',
      href: M8_LINKS.macroRateWatch,
      cta: '进入 宏观利率中心',
      links: [
        { label: '宏观利率中心', href: M8_LINKS.macroRateWatch },
        { label: 'BTC ETF 中心', href: M8_LINKS.btcEtfWatch },
        { label: '投资框架中心', href: M8_LINKS.investingFrameworks },
      ],
    },
  ];
}

function buildM8HubCards(isZh: boolean): HomeHubCard[] {
  if (!isZh) {
    return [
      {
        kicker: 'Research Map',
        title: 'Research directory',
        description: 'Use the directory page as the clean map for sections, topic hubs, and representative articles.',
        href: M8_LINKS.researchDirectory,
        cta: 'Open research directory',
        links: [
          { label: 'Start here', href: M8_LINKS.startHere },
          { label: 'Research method', href: M8_LINKS.researchMethod },
        ],
      },
      {
        kicker: 'Topic Hub',
        title: 'AI software / agents',
        description: 'Keep coding agents, enterprise model platforms, and software-layer monetization in one expandable hub.',
        href: M8_LINKS.aiAgentPlatforms,
        cta: 'Open AI software hub',
        links: [
          { label: 'GPT-5 enterprise', href: M8_LINKS.openaiGpt5 },
          { label: 'Return to AI supply chain', href: M8_LINKS.aiSupplyChain },
        ],
      },
      {
        kicker: 'Topic Hub',
        title: 'Tesla / FSD center',
        description: 'Keep FSD, Robotaxi, Optimus, and mapped suppliers on one continuous Tesla reading path.',
        href: M8_LINKS.teslaFsd,
        cta: 'Open Tesla / FSD center',
        links: [
          { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
          { label: 'Optimus supply chain', href: M8_LINKS.teslaOptimus },
        ],
      },
      {
        kicker: 'Evergreen',
        title: 'Investing frameworks',
        description: 'Keep valuation, earnings quality, sizing, and market structure in one evergreen layer for repeat entry.',
        href: M8_LINKS.investingFrameworks,
        cta: 'Open investing frameworks',
        links: [
          { label: 'Research method', href: M8_LINKS.researchMethod },
          { label: 'A-share mechanics', href: M8_LINKS.astockMechanics },
        ],
      },
    ];
  }

  return [
    {
      kicker: 'Research Map',
      title: '研究目录',
      description: '把一级栏目、主题中心和代表文章收成一张地图，方便第一次进入站点时快速判断从哪条线开始。',
      href: M8_LINKS.researchDirectory,
      cta: '打开 研究目录',
      links: [
        { label: '开始阅读', href: M8_LINKS.startHere },
        { label: '研究方法', href: M8_LINKS.researchMethod },
      ],
    },
    {
      kicker: 'Topic Hub',
      title: 'AI软件 / Agent 中心',
      description: '把 coding agent、企业级大模型落地和软件层商业化收成一条可以持续扩写的专题线。',
      href: M8_LINKS.aiAgentPlatforms,
      cta: '打开 AI软件中心',
      links: [
        { label: 'GPT-5 企业版', href: M8_LINKS.openaiGpt5 },
        { label: '回到 AI产业链', href: M8_LINKS.aiSupplyChain },
      ],
    },
    {
      kicker: 'Topic Hub',
      title: 'Tesla / FSD 中心',
      description: '把 FSD、Robotaxi、Optimus 和零部件映射收成连续阅读路径，不再分散在零碎事件稿里。',
      href: M8_LINKS.teslaFsd,
      cta: '打开 Tesla / FSD 中心',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'Optimus 供应链', href: M8_LINKS.teslaOptimus },
      ],
    },
    {
      kicker: 'Evergreen',
      title: '投资框架中心',
      description: '把估值、财报质量、仓位管理和市场机制收成长期常青层，承担基础阅读入口。',
      href: M8_LINKS.investingFrameworks,
      cta: '打开 投资框架中心',
      links: [
        { label: '研究方法', href: M8_LINKS.researchMethod },
        { label: 'A股市场机制', href: M8_LINKS.astockMechanics },
      ],
    },
  ];
}

function buildM8ReadingSteps(isZh: boolean): HomeReadingStep[] {
  if (!isZh) {
    return [
      {
        step: '01',
        title: 'Choose the main line first',
        description: 'Decide whether the question belongs to AI infrastructure, core China A-shares, priority US stocks, or macro rates before entering the archive.',
        links: [
          { label: 'AI supply chain', href: M8_LINKS.aiSupplyChain },
          { label: 'A-share core coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'US core coverage', href: M8_LINKS.usStockCoreCoverage },
        ],
      },
      {
        step: '02',
        title: 'Move from section to topic hub',
        description: 'Use hubs such as Tesla / FSD, AI software, Hong Kong stocks, or BTC ETF to keep related pages close together and reduce orphaned articles.',
        links: [
          { label: 'Tesla / FSD', href: M8_LINKS.teslaFsd },
          { label: 'AI software / agents', href: M8_LINKS.aiAgentPlatforms },
          { label: 'BTC ETF', href: M8_LINKS.btcEtfWatch },
        ],
      },
      {
        step: '03',
        title: 'Then open the full stream',
        description: 'After landing on the right section, use the post archive to continue into the full feed instead of making the homepage carry every article equally.',
        links: [
          { label: 'Browse all posts', href: M8_LINKS.blog },
          { label: 'Research directory', href: M8_LINKS.researchDirectory },
          { label: 'Research method', href: M8_LINKS.researchMethod },
        ],
      },
    ];
  }

  return [
    {
      step: '01',
      title: '先判断问题属于哪条主线',
      description: '先区分是 AI 产业链、A股核心标的、美股重点公司，还是宏观利率问题，再进入对应栏目，而不是先翻文章流。',
      links: [
        { label: 'AI产业链', href: M8_LINKS.aiSupplyChain },
        { label: 'A股核心标的', href: M8_LINKS.aShareCoreCoverage },
        { label: '美股重点标的', href: M8_LINKS.usStockCoreCoverage },
      ],
    },
    {
      step: '02',
      title: '再顺着专题中心做连续阅读',
      description: '像 Tesla / FSD、AI软件 / Agent、港股研究、BTC ETF 这些高意图词，要放在专题中心里持续扩展，不要散在归档里。',
      links: [
        { label: 'Tesla / FSD', href: M8_LINKS.teslaFsd },
        { label: 'AI软件 / Agent', href: M8_LINKS.aiAgentPlatforms },
        { label: 'BTC ETF', href: M8_LINKS.btcEtfWatch },
      ],
    },
    {
      step: '03',
      title: '最后再回到完整文章流',
      description: '首页只放最值得优先进入的模块，完整更新流交给文章归档和研究目录承接，避免首页再次变回普通资讯站。',
      links: [
        { label: '查看全部文章', href: M8_LINKS.blog },
        { label: '研究目录', href: M8_LINKS.researchDirectory },
        { label: '研究方法', href: M8_LINKS.researchMethod },
      ],
    },
  ];
}

export async function handleHome(env: Env, page: number): Promise<Response> {
  const [config, categories, tags, collections, authors, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getCategories(env.CONTENT_BUCKET, env.SITE_ID),
    getTags(env.CONTENT_BUCKET, env.SITE_ID),
    getCollections(env.CONTENT_BUCKET, env.SITE_ID),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  // Load posts from D1 (paginated)
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, config.postsPerPage
  );

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);
  const pagination = buildPagination(total, page, config.postsPerPage, '');

  // Featured: configurable count (default: 3)
  const featuredCount = config.blog?.featuredCount ?? 3;
  const showFeatured = config.blog?.showFeatured !== false;
  
  // For featured posts on subsequent pages, we fetch page 1 again
  let featuredPosts = posts;
  if (showFeatured && page > 1) {
    const p1 = await getPosts(env.DB, env.SITE_ID, 1, featuredCount);
    featuredPosts = p1.posts;
  }
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const enrichAuthor = (p: typeof posts[0]) => ({
    ...p,
    authorDisplayName: authorMap.get(p.author)?.name || p.author,
  });
  const featured = showFeatured ? featuredPosts.slice(0, featuredCount).map(enrichAuthor) : [];
  const postsWithAuthor = posts.map(enrichAuthor);

  // Home config
  const homeConfig = config.home || {};
  const defaultImages = config.defaults || {};
  const isZh = isZhLanguage(config.language);
  const useFocusedHome = page === 1 && (env.SITE_ID === 'm8.com.cn' || homeConfig.showTopics === true);

  const labels = resolveLabels(config.language || 'zh-CN', config.labels);
  // Apply default images and localized name for "uncategorized" (未分类 etc.)
  const categoriesWithDefaults = categories.map((cat) => ({
    ...cat,
    name: isUncategorized(cat.slug) ? labels.uncategorized : cat.name,
    featuredImage: cat.featuredImage || defaultImages.category || '',
  }));
  const postsWithAuthorAndCategoryDisplay = enrichPostsWithCategoryDisplayNames(
    postsWithAuthor,
    categories,
    labels.uncategorized,
  );

  const seo = buildHomeSeo(config, env.EFFECTIVE_ORIGIN);
  // Use home hero image or default OG image
  if (homeConfig.heroImage) seo.ogImage = homeConfig.heroImage;

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const blogPath = buildCollectionPath(config.routes?.blog);
  const categoryPrefix = config.routes?.category;
  const availableCategories = useFocusedHome
    ? categoriesWithDefaults.filter((category) => !M8_HIDDEN_HOME_CATEGORIES.has(category.slug))
    : categoriesWithDefaults;
  const focusCategorySlugs = homeConfig.focusCategories?.length
    ? homeConfig.focusCategories
    : (useFocusedHome ? M8_FOCUS_CATEGORIES : []);
  const availableCategoryMap = new Map(availableCategories.map((category) => [category.slug, category]));
  const focusCategories = focusCategorySlugs
    .map((slug) => availableCategoryMap.get(slug))
    .filter(Boolean) as typeof availableCategories;
  const fallbackTopicCategories = availableCategories.slice(0, 4);
  const topicCategories = (focusCategories.length > 0 ? focusCategories : fallbackTopicCategories).slice(0, 4);
  const topicCards = topicCategories.map((category) => {
    const seoMeta = buildCategorySeoMeta(config, category.slug, category.name, category.description);
    return {
      slug: category.slug,
      name: category.name,
      href: buildCategoryPath(categoryPrefix, category.slug),
      description: trimDescription(category.description || '', seoMeta.description),
      count: category.count,
    };
  });
  const heroActions = useFocusedHome
    ? [
        ...topicCards.map((topic) => ({ label: topic.name, href: topic.href })),
        { label: isZh ? '最新更新' : 'Latest posts', href: blogPath },
      ].slice(0, 5)
    : [];
  const heroHighlights = useFocusedHome
    ? (isZh
        ? [
            '优先跟踪有产业催化、数据验证和价格反馈的重点主题与公司',
            '重点覆盖 AI 算力、半导体、美股龙头财报与 A 股核心公司',
            '从首页专题进入，再延展到栏目页与完整研究归档',
          ]
        : [
            'Prioritize catalyst-driven names with fresh data and market reaction.',
            'Focus on AI infrastructure, semiconductors, US earnings leaders, and core China A-shares.',
            'Use the homepage as a topic hub and keep the full archive behind /blog and core sections.',
          ])
    : [];
  const derivedHeroTitle = useFocusedHome && isBrandLikeTitle(homeConfig.title || '', config.name)
    ? (isZh ? '跨市场投资资讯与核心个股研究' : 'Cross-market research and high-signal stock coverage')
    : (homeConfig.title || config.name);
  const derivedHeroSubtitle = useFocusedHome
    ? (homeConfig.subtitle
      || (isZh
        ? '重点覆盖 AI 算力、半导体、美股龙头财报与 A 股核心公司，先看最新催化，再顺着专题和栏目持续深挖。'
        : 'Focused on AI infrastructure, semiconductors, major US earnings, and core China A-shares, starting from fresh catalysts and drilling deeper by theme.'))
    : (homeConfig.subtitle || config.description);
  const derivedPageTitle = useFocusedHome && isBrandLikeTitle(homeConfig.title || '', config.name)
    ? (isZh
      ? `${config.name} · AI算力、美股财报与A股核心个股研究`
      : `${config.name} · AI infrastructure, earnings, and core stock research`)
    : (homeConfig.title || config.name);
  const derivedPageDescription = useFocusedHome
    ? (isZh
      ? '覆盖 AI 算力、半导体、美股财报、A 股核心公司与跨市场宏观主线的中文投资研究站，优先展示最新重点更新与专题入口。'
      : 'A cross-market investing site focused on AI infrastructure, semiconductors, earnings, and high-signal stock research with curated topic entry points.')
    : (homeConfig.subtitle || config.description);
  const latestPosts = useFocusedHome
    ? postsWithAuthorAndCategoryDisplay.slice(0, homeConfig.latestCount || 6)
    : postsWithAuthorAndCategoryDisplay;
  const categoriesForRender = useFocusedHome ? topicCategories : categoriesWithDefaults;
  const researchTracks = useFocusedHome ? buildM8ResearchTracks(isZh) : [];
  const hubCards = useFocusedHome ? buildM8HubCards(isZh) : [];
  const readingSteps = useFocusedHome ? buildM8ReadingSteps(isZh) : [];
  const showTopicCards = useFocusedHome
    && homeConfig.showTopics !== false
    && topicCards.length > 0
    && researchTracks.length === 0;
  const schema: Record<string, unknown> = {
    website: buildWebSiteSchema(config, base),
  };
  if (page === 1) {
    schema.organization = buildOrganizationSchema(config, base);
  }

  const html = render(config.theme || 'default', 'home', {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: derivedPageTitle,
    pageDescription: derivedPageDescription,
    seo,
    schema,
    handler: 'home',
    fullWidth: useFocusedHome,
    showHeader: true,
    showFooter: true,
    customPartials,
    // Home config
    heroEyebrow: homeConfig.eyebrow || (useFocusedHome ? config.name : ''),
    heroTitle: derivedHeroTitle,
    heroSubtitle: derivedHeroSubtitle,
    heroImage: homeConfig.heroImage || '',
    heroActions,
    heroHighlights,
    showTopicCards,
    topicCards,
    showResearchTracks: researchTracks.length > 0,
    researchTracks,
    researchTracksTitle: isZh ? '先看这四条主线' : 'Start with these four tracks',
    researchTracksDescription: isZh
      ? '首页先把 AI产业链、美股重点、A股核心和宏观利率四条主线讲清，再把更细的问题分发到专题和文章。'
      : 'Use the homepage to establish four primary tracks first, then push narrower questions into topic hubs and articles.',
    showHubCards: hubCards.length > 0,
    hubCards,
    hubCardsTitle: isZh ? '专题中心' : 'Topic hubs',
    hubCardsDescription: isZh
      ? '这里只保留需要持续扩写的高意图专题，避免首页出现过多平行入口。'
      : 'Keep only the highest-intent hubs here so the homepage does not splinter into too many parallel entry points.',
    showReadingSteps: false,
    readingSteps,
    readingStepsTitle: isZh ? '怎么使用这个首页' : 'How to use this homepage',
    readingStepsDescription: isZh
      ? '首页负责分流和组织，不负责把所有文章平铺。先主线、再专题、最后归档。'
      : 'The homepage should organize and route readers, not flatten every article into one stream. Start with a track, then a hub, then the archive.',
    topicsTitle: homeConfig.topicsTitle || (useFocusedHome ? (isZh ? '重点主题入口' : 'Core research tracks') : ''),
    topicsDescription: homeConfig.topicsDescription || (useFocusedHome
      ? (isZh ? '先从最重要的专题进入，再延展到栏目页与完整归档。' : 'Start from the highest-signal topic hubs, then expand into the full archive from section pages.')
      : ''),
    showCategories: useFocusedHome ? homeConfig.showCategories === true : homeConfig.showCategories !== false,
    showTags: useFocusedHome ? homeConfig.showTags === true : homeConfig.showTags !== false,
    showStats: useFocusedHome ? homeConfig.showStats === true : homeConfig.showStats !== false,
    showFeatured,
    featuredTitle: homeConfig.featuredTitle || (useFocusedHome ? (isZh ? '核心专题' : 'Featured deep dives') : ''),
    featuredDescription: homeConfig.featuredDescription || (useFocusedHome
      ? (isZh ? '保留最值得反复阅读的深度文，方便从主题到公司持续追踪。' : 'Keep the strongest deep dives on the homepage so readers can follow each theme over time.')
      : ''),
    latestTitle: homeConfig.latestTitle || (useFocusedHome ? (isZh ? '最新重点更新' : 'Latest priority updates') : ''),
    latestDescription: homeConfig.latestDescription || (useFocusedHome
      ? (isZh ? '最近发布里只保留最关键的一批，完整归档请进入文章列表。' : 'Show only a tighter set of recent posts here; use the blog archive for the full stream.')
      : ''),
    latestCtaHref: useFocusedHome ? blogPath : '',
    latestCtaLabel: useFocusedHome ? (isZh ? '查看全部文章' : 'Browse all posts') : '',
    postsLayout: config.blog?.postsLayout || 'grid',
    defaultPostImage: defaultImages.post || '',
    posts: latestPosts,
    featured,
    categories: categoriesForRender,
    tags,
    collections,
    pagination: useFocusedHome ? undefined : pagination,
    totalPosts: total,
    preloadImage: homeConfig.heroImage || seo.ogImage,
  });

  return htmlResponse(html);
}
