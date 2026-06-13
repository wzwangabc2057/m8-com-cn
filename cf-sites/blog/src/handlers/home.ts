
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getCategories, getTags, getCollections, getAuthors } from '../services/meta.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { buildPagination } from '../utils/pagination.js';
import { render, htmlResponse } from '../renderer.js';
import { enrichPostsWithAuthorIdentity } from '../utils/authors.js';

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

const M8_FOCUS_CATEGORIES = ['a-stocks', 'us-stocks', 'hk-stocks', 'crypto'];
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
  oralGlp1: '/article/oral-glp1-retatrutide-2026-insight',
  hkCnooc: '/article/cnooc-0883hk-oil-dividend-q22026-deep',
  hkXiaomi: '/article/xiaomi-1810hk-su7ultra-aihome-2026-deep',
  cryptoCme: '/article/cme-crypto-index-futures-20260609-insight',
  cryptoCoinbaseBase: '/article/coinbase-base-layer2-ecosystem-2026-deep',
  cryptoMstr: '/article/mstr-btc-treasury-may2026-deep',
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

type HomeSectorSlice = {
  title: string;
  description: string;
  href: string;
  links: HomeLink[];
};

type HomeSectorGroup = {
  market: string;
  title: string;
  description: string;
  items: HomeSectorSlice[];
};

type HomeQuestionCard = {
  question: string;
  answer: string;
  href: string;
  label: string;
};

type HomeFeaturedCard = {
  kicker: string;
  href: string;
  title: string;
  description: string;
  links: HomeLink[];
};

type HomeMagazinePost = {
  slug: string;
  title: string;
  excerpt?: string;
  coverImage?: string;
  publishedAt?: string;
  author?: string;
  authorDisplayName?: string;
  authorCanonicalId?: string;
  categories?: string[];
  categoryDisplayNames?: string[];
};

type HomeMagazineSection = {
  slug: string;
  label: string;
  title: string;
  href: string;
  posts: HomeMagazinePost[];
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

function buildM8MagazineSections(
  posts: HomeMagazinePost[],
  isZh: boolean,
  categoryPrefix?: string,
): HomeMagazineSection[] {
  const sectionConfigs = isZh
    ? [
        { slug: 'us-stocks', label: '美股', title: '美股 / US Stocks' },
        { slug: 'a-stocks', label: 'A 股', title: 'A 股 / China A-Shares' },
        { slug: 'ai-stocks', label: 'AI 产业链', title: 'AI 产业链 / AI Supply Chain' },
        { slug: 'hk-stocks', label: '港股', title: '港股 / Hong Kong' },
        { slug: 'industry-research', label: '行业研究', title: '行业研究 / Industry Research' },
        { slug: 'macro', label: '宏观', title: '宏观 / Macro' },
        { slug: 'crypto', label: '加密', title: '加密 / Crypto' },
        { slug: 'investing-101', label: '投资科普', title: '投资科普 / Investing 101' },
      ]
    : [
        { slug: 'us-stocks', label: 'US stocks', title: 'US Stocks' },
        { slug: 'a-stocks', label: 'A-shares', title: 'China A-Shares' },
        { slug: 'ai-stocks', label: 'AI supply chain', title: 'AI Supply Chain' },
        { slug: 'hk-stocks', label: 'Hong Kong', title: 'Hong Kong Stocks' },
        { slug: 'industry-research', label: 'Industry', title: 'Industry Research' },
        { slug: 'macro', label: 'Macro', title: 'Macro' },
        { slug: 'crypto', label: 'Crypto', title: 'Crypto' },
        { slug: 'investing-101', label: 'Investing 101', title: 'Investing 101' },
      ];

  const leadSlugs = new Set(
    posts.slice(0, 4).map((post) => post.slug).filter(Boolean),
  );
  const globallyUsed = new Set<string>(leadSlugs);

  return sectionConfigs
    .map((section) => {
      const matchingPosts = posts.filter((post) =>
        post.slug
        && !leadSlugs.has(post.slug)
        && Array.isArray(post.categories)
        && post.categories.includes(section.slug),
      );

      const uniquePosts = matchingPosts
        .filter((post) => !globallyUsed.has(post.slug))
        .slice(0, 4);

      const selectedSlugs = new Set(uniquePosts.map((post) => post.slug));
      const fillPosts = matchingPosts
        .filter((post) => !selectedSlugs.has(post.slug))
        .slice(0, Math.max(0, 4 - uniquePosts.length));

      const sectionPosts = [...uniquePosts, ...fillPosts];
      sectionPosts.forEach((post) => globallyUsed.add(post.slug));

      return {
        ...section,
        href: buildCategoryPath(categoryPrefix, section.slug),
        posts: sectionPosts,
      };
    })
    .filter((section) => section.posts.length > 0);
}

function buildM8FeaturedCards(isZh: boolean): HomeFeaturedCard[] {
  if (!isZh) {
    return [
      {
        kicker: 'FOCUS COMPANY',
        href: M8_LINKS.zhongwei,
        title: 'Zhongwei / 688012.SH',
        description: 'A durable China semicap sample for etch equipment, domestic substitution, and advanced-node capex.',
        links: [
          { label: 'A-share coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'AI supply chain', href: M8_LINKS.aiSupplyChain },
        ],
      },
      {
        kicker: 'FOCUS COMPANY',
        href: '/article/haiguang-688041-ai-chip-2026-deep',
        title: 'Hygon / 688041.SH',
        description: 'A long-term sample for domestic CPU and GPU autonomy inside China compute infrastructure.',
        links: [
          { label: 'A-share coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
        ],
      },
      {
        kicker: 'FOCUS COMPANY',
        href: '/article/catl-300750-q2-2026-delivery-20260603-trending',
        title: 'CATL / 300750.SZ',
        description: 'Still a key sample for battery manufacturing scale, overseas expansion, and industrial execution.',
        links: [
          { label: 'A-share coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'Browse archive', href: M8_LINKS.blog },
        ],
      },
      {
        kicker: 'FOCUS COMPANY',
        href: '/article/gold-record-high-macro-may2026-20260511-trending',
        title: 'Zijin Mining / 601899.SH',
        description: 'A bridge between gold, copper, the dollar cycle, and macro-sensitive resource allocation.',
        links: [
          { label: 'A-share coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'Macro rate watch', href: M8_LINKS.macroRateWatch },
        ],
      },
    ];
  }

  return [
    {
      kicker: 'FOCUS COMPANY',
      href: M8_LINKS.zhongwei,
      title: '中微公司 / 688012.SH',
      description: '国产刻蚀设备的长期锚点，适合承接 A 股半导体设备与国产替代主线。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: 'AI产业链专题', href: M8_LINKS.aiSupplyChain },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: M8_LINKS.aShareCoreCoverage,
      title: '工业富联 / 601138.SH',
      description: '北美云厂商 AI 服务器资本开支向制造端传导的核心映射标的之一。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: 'AI产业链专题', href: M8_LINKS.aiSupplyChain },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: '/article/haiguang-688041-ai-chip-2026-deep',
      title: '海光信息 / 688041.SH',
      description: '国产算力与 CPU / GPU 自主可控的长期观察入口。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: 'A股主线专题', href: M8_LINKS.aShareMainlines },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: M8_LINKS.aShareMainlines,
      title: '沪电股份 / 002463.SZ',
      description: '高速 PCB 与 AI 服务器配套环节确定性强，适合承接中游景气跟踪。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: 'AI产业链专题', href: M8_LINKS.aiSupplyChain },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: '/article/catl-300750-q2-2026-delivery-20260603-trending',
      title: '宁德时代 / 300750.SZ',
      description: '新能源虽然不是唯一主线，但宁德仍是电池出海和制造龙头的重要样本。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: '查看更多文章', href: M8_LINKS.blog },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: '/article/el-nino-coal-cycle-2026-trending',
      title: '中国神华 / 601088.SH',
      description: '高股息与煤价周期的交叉点，适合作为防御层的长期配置样本。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: '宏观利率专题', href: M8_LINKS.macroRateWatch },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: '/article/gold-record-high-macro-may2026-20260511-trending',
      title: '紫金矿业 / 601899.SH',
      description: '黄金与铜双金属敞口，让资源股研究可以和通胀、美元与周期变量打通。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: '宏观利率专题', href: M8_LINKS.macroRateWatch },
      ],
    },
    {
      kicker: 'FOCUS COMPANY',
      href: '/article/zhongji-xuchuang-300308-q1-2026-deep',
      title: '中际旭创 / 300308.SZ',
      description: '光模块是 A 股 AI 出海链最重要的子主题之一，中际适合作为长期光通信入口。',
      links: [
        { label: 'A股栏目', href: M8_LINKS.aShareCoreCoverage },
        { label: 'AI产业链专题', href: M8_LINKS.aiSupplyChain },
      ],
    },
  ];
}

function buildM8ResearchTracks(isZh: boolean): HomeResearchTrack[] {
  if (!isZh) {
    return [
      {
        kicker: 'China A-Shares',
        title: 'A-share core coverage',
        description: 'Use the A-share market entrance to organize semicap, servers, domestic substitution, dividends, and market structure work.',
        href: M8_LINKS.aShareCoreCoverage,
        cta: 'Open A-share coverage',
        links: [
          { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
          { label: 'Zhongwei deep dive', href: M8_LINKS.zhongwei },
        ],
      },
      {
        kicker: 'US Stocks',
        title: 'US priority names',
        description: 'Group AI leaders, Tesla, semicap, and biotech into one durable US stock research pool.',
        href: M8_LINKS.usStockCoreCoverage,
        cta: 'Open US core coverage',
        links: [
          { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
          { label: 'NVIDIA system cycle', href: M8_LINKS.nvidiaSystem },
        ],
      },
      {
        kicker: 'Hong Kong',
        title: 'Hong Kong stock coverage',
        description: 'Use Hong Kong stocks as a separate market entrance for internet platforms, consumer electronics, exporters, energy dividends, insurers, and southbound flow.',
        href: M8_LINKS.hkTechDividend,
        cta: 'Open Hong Kong coverage',
        links: [
          { label: 'CNOOC deep dive', href: M8_LINKS.hkCnooc },
          { label: 'Xiaomi deep dive', href: M8_LINKS.hkXiaomi },
        ],
      },
      {
        kicker: 'Blockchain',
        title: 'Blockchain and crypto assets',
        description: 'Give BTC ETF flows, exchange infrastructure, treasury beta, stablecoin regulation, and on-chain ecosystems their own market-level entrance.',
        href: M8_LINKS.btcEtfWatch,
        cta: 'Open blockchain coverage',
        links: [
          { label: 'BTC ETF center', href: M8_LINKS.btcEtfWatch },
          { label: 'CME crypto basket', href: M8_LINKS.cryptoCme },
        ],
      },
    ];
  }

  return [
    {
      kicker: 'A股入口',
      title: 'A股主线与核心标的',
      description: '把半导体设备、服务器链、国产替代、高股息和市场机制收成统一的 A 股研究入口，先看主线，再进公司与板块。',
      href: M8_LINKS.aShareCoreCoverage,
      cta: '进入A股研究主线',
      links: [
        { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
        { label: '中微公司深度', href: M8_LINKS.zhongwei },
      ],
    },
    {
      kicker: '美股入口',
      title: '美股重点标的与财报线',
      description: '把 AI 龙头、Tesla、半导体设备和创新药主线收成长期覆盖池，让美股入口按市场而不是按零散事件组织。',
      href: M8_LINKS.usStockCoreCoverage,
      cta: '进入美股重点标的',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'NVIDIA 系统级资本开支', href: M8_LINKS.nvidiaSystem },
      ],
    },
    {
      kicker: '港股入口',
      title: '港股平台、红利与制造链',
      description: '把港股平台互联网、消费电子 / 智能硬件、高股息能源 / 电信、保险和南向资金逻辑单独收口，避免港股内容被并进其他市场栏目。',
      href: M8_LINKS.hkTechDividend,
      cta: '进入港股研究中心',
      links: [
        { label: '港股研究中心', href: M8_LINKS.hkTechDividend },
        { label: '中海油 0883.HK', href: M8_LINKS.hkCnooc },
      ],
    },
    {
      kicker: '加密入口',
      title: '区块链与加密资产主线',
      description: '围绕 BTC ETF 资金流、交易所 / 托管基础设施、稳定币监管、链上生态和 Treasury Beta，建立独立的区块链研究入口。',
      href: M8_LINKS.btcEtfWatch,
      cta: '进入区块链研究中心',
      links: [
        { label: 'BTC ETF 中心', href: M8_LINKS.btcEtfWatch },
        { label: 'CME 加密指数期货', href: M8_LINKS.cryptoCme },
      ],
    },
  ];
}

function buildM8HubCards(isZh: boolean): HomeHubCard[] {
  if (!isZh) {
    return [
      {
        kicker: 'Sector',
        title: 'AI supply chain',
        description: 'Keep HBM, advanced packaging, data center capex, and compute infrastructure in one expandable sector hub.',
        href: M8_LINKS.aiSupplyChain,
        cta: 'Open AI sector hub',
        links: [
          { label: 'HBM / advanced packaging', href: M8_LINKS.besiHbm4 },
          { label: 'AI software / agents', href: M8_LINKS.aiAgentPlatforms },
        ],
      },
      {
        kicker: 'Sector',
        title: 'Tesla / FSD / robotics',
        description: 'Keep Tesla, FSD, Robotaxi, Optimus, and supplier mapping in one persistent market-to-industry hub.',
        href: M8_LINKS.teslaFsd,
        cta: 'Open Tesla hub',
        links: [
          { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
          { label: 'Optimus supply chain', href: M8_LINKS.teslaOptimus },
        ],
      },
      {
        kicker: 'Sector',
        title: 'GLP-1 and innovative drugs',
        description: 'Keep obesity drugs, oral GLP-1, biopharma pipelines, and market leaders in one sector layer.',
        href: '/glp1-drug-watch',
        cta: 'Open healthcare hub',
        links: [
          { label: 'GLP-1 supply chain', href: M8_LINKS.glp1Supply },
          { label: 'Oral GLP-1', href: M8_LINKS.oralGlp1 },
        ],
      },
      {
        kicker: 'Framework',
        title: 'Research method and market structure',
        description: 'Use one evergreen layer for valuation, earnings quality, market mechanism, and research process.',
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
      kicker: '产业专题',
      title: 'AI产业链专题',
      description: '把 HBM、先进封装、数据中心资本开支、GPU 和 AI 软件层落地放到同一个板块专题里持续扩写。',
      href: M8_LINKS.aiSupplyChain,
      cta: '进入AI产业链专题',
      links: [
        { label: 'HBM / 先进封装', href: M8_LINKS.besiHbm4 },
        { label: 'AI软件 / Agent', href: M8_LINKS.aiAgentPlatforms },
      ],
    },
    {
      kicker: '公司专题',
      title: 'Tesla / FSD / 机器人链',
      description: '把 Tesla、FSD、Robotaxi、Optimus 和供应链映射收成持续阅读的一个板块层，而不是碎片事件稿。',
      href: M8_LINKS.teslaFsd,
      cta: '进入Tesla / FSD专题',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'Optimus 供应链', href: M8_LINKS.teslaOptimus },
      ],
    },
    {
      kicker: '医药专题',
      title: '创新药 / GLP-1 专题',
      description: '把口服 GLP-1、减重药竞争格局、创新药支付与供应链映射整理成独立的长期专题。',
      href: '/glp1-drug-watch',
      cta: '进入创新药专题',
      links: [
        { label: 'GLP-1 供应链', href: M8_LINKS.glp1Supply },
        { label: '口服 GLP-1', href: M8_LINKS.oralGlp1 },
      ],
    },
    {
      kicker: '研究框架',
      title: '研究方法与市场机制',
      description: '把估值、财报质量、仓位管理、市场机制和研究方法保留为常青层，服务四条市场主线的基础阅读。',
      href: M8_LINKS.investingFrameworks,
      cta: '进入研究方法层',
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

function buildM8SectorGroups(isZh: boolean): HomeSectorGroup[] {
  if (!isZh) {
    return [
      {
        market: 'A-Shares',
        title: 'A-share sector slices',
        description: 'Break China coverage into semicap, servers, domestic compute, dividends, and market structure instead of one broad bucket.',
        items: [
          {
            title: 'Semicap and advanced manufacturing',
            description: 'Use semicap leaders and process tools as the spearhead for domestic substitution and capex cycle work.',
            href: M8_LINKS.zhongwei,
            links: [
              { label: 'A-share core coverage', href: M8_LINKS.aShareCoreCoverage },
              { label: 'Zhongwei deep dive', href: M8_LINKS.zhongwei },
            ],
          },
          {
            title: 'AI servers, PCB, and supply chain',
            description: 'Keep AI servers, networking, PCB, and adjacent manufacturing names inside one A-share compute slice.',
            href: M8_LINKS.aShareCoreCoverage,
            links: [
              { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
              { label: 'AI supply chain', href: M8_LINKS.aiSupplyChain },
            ],
          },
          {
            title: 'Domestic compute and market structure',
            description: 'Link domestic compute, policy support, and A-share microstructure so market-specific research is easier to find.',
            href: M8_LINKS.astockMechanics,
            links: [
              { label: 'Market mechanics', href: M8_LINKS.astockMechanics },
              { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
            ],
          },
          {
            title: 'Dividends, SOEs, and defensive assets',
            description: 'Separate dividend and resource defensives from growth narratives so readers can land on the right A-share style.',
            href: M8_LINKS.aShareMainlines,
            links: [
              { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
              { label: 'A-share core coverage', href: M8_LINKS.aShareCoreCoverage },
            ],
          },
        ],
      },
      {
        market: 'US Stocks',
        title: 'US sector slices',
        description: 'Break US stock coverage into AI compute, semicap, Tesla, software agents, and healthcare instead of one generic market page.',
        items: [
          {
            title: 'AI compute, GPU, and HBM',
            description: 'Track NVIDIA, HBM, advanced packaging, and capex transmission as one AI infrastructure lane.',
            href: M8_LINKS.aiSupplyChain,
            links: [
              { label: 'AI supply chain', href: M8_LINKS.aiSupplyChain },
              { label: 'NVIDIA system cycle', href: M8_LINKS.nvidiaSystem },
            ],
          },
          {
            title: 'Tesla, FSD, and robotics',
            description: 'Keep Tesla, FSD, Robotaxi, Optimus, and supplier mapping in one durable operating lane.',
            href: M8_LINKS.teslaFsd,
            links: [
              { label: 'Tesla / FSD hub', href: M8_LINKS.teslaFsd },
              { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
            ],
          },
          {
            title: 'AI software and agent platforms',
            description: 'Separate model platforms, coding agents, and enterprise AI software from hardware-heavy names.',
            href: M8_LINKS.aiAgentPlatforms,
            links: [
              { label: 'AI software / agents', href: M8_LINKS.aiAgentPlatforms },
              { label: 'GPT-5 enterprise', href: M8_LINKS.openaiGpt5 },
            ],
          },
          {
            title: 'Biotech, GLP-1, and healthcare',
            description: 'Treat GLP-1, obesity drugs, payment channels, and biotech pipelines as a dedicated healthcare layer.',
            href: '/glp1-drug-watch',
            links: [
              { label: 'GLP-1 hub', href: '/glp1-drug-watch' },
              { label: 'Oral GLP-1', href: M8_LINKS.oralGlp1 },
            ],
          },
        ],
      },
    ];
  }

  return [
    {
      market: 'A股',
      title: 'A股细分板块',
      description: '把 A股继续拆成半导体设备 / 材料、光模块 / 服务器链、液冷 / 配电、高股息 / 资源与市场机制，不再只保留一个总入口。',
      items: [
        {
          title: '半导体设备 / 量检测 / 先进制造',
          description: '围绕刻蚀、量检测、先进制程设备和国产替代，把最核心的设备与工艺链单独做厚。',
          href: M8_LINKS.zhongwei,
          links: [
            { label: 'A股核心标的', href: M8_LINKS.aShareCoreCoverage },
            { label: '中微公司深度', href: M8_LINKS.zhongwei },
          ],
        },
        {
          title: '光模块 / 连接 / 服务器链',
          description: '把光模块、高速连接、PCB、交换与服务器制造协同放进一个 A股算力配套板块里，方便持续补公司。',
          href: M8_LINKS.aShareCoreCoverage,
          links: [
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
          ],
        },
        {
          title: '液冷 / 配电 / 电力设备',
          description: '把液冷、配电、电力设备与数据中心电力基础设施拆成独立层，承接 AI 电力约束和算电协同逻辑。',
          href: M8_LINKS.astockMechanics,
          links: [
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
          ],
        },
        {
          title: '高股息 / 资源 / 市场机制',
          description: '把高股息央企、资源股、防御资产和 A股交易制度拆开理解，形成单独的风格与制度阅读口。',
          href: M8_LINKS.aShareMainlines,
          links: [
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
            { label: 'A股市场机制', href: M8_LINKS.astockMechanics },
          ],
        },
      ],
    },
    {
      market: '美股',
      title: '美股细分板块',
      description: '把美股继续拆成半导体设备 / 材料、光通信 / 光器件、AI网络 / ASIC、电力设备 / 配电，再把 Tesla 和 GLP-1 保留在专题层。',
      items: [
        {
          title: '半导体设备 / 检测 / 材料',
          description: '把量检测、工艺控制、半导体材料与设备链单独列出，承接 ONTO、CAMT、ENTG、AXTI 这类卡脖子环节。',
          href: M8_LINKS.aiSupplyChain,
          links: [
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
            { label: '美股重点标的', href: M8_LINKS.usStockCoreCoverage },
          ],
        },
        {
          title: '光通信 / 激光 / 光器件',
          description: '把光通信、激光、相干链路和光器件拆成独立层，承接 COHR 这类 AI 光链标的和相邻供应链。',
          href: M8_LINKS.usStockCoreCoverage,
          links: [
            { label: '美股重点标的', href: M8_LINKS.usStockCoreCoverage },
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
          ],
        },
        {
          title: 'AI网络 / ASIC / 平台',
          description: '把交换、网络、定制 ASIC、平台型 AI 基建拆成单独层，承接 AVGO 这类 AI 网络与平台资产。',
          href: M8_LINKS.aiSupplyChain,
          links: [
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
            { label: 'GPT-5 企业版', href: M8_LINKS.openaiGpt5 },
          ],
        },
        {
          title: '电力设备 / 配电 / 电网升级',
          description: '把配电、功率管理、电网升级和算电基础设施拆成独立板块，承接 GEV、ETN 这类电力设备资产。',
          href: M8_LINKS.usStockCoreCoverage,
          links: [
            { label: '美股重点标的', href: M8_LINKS.usStockCoreCoverage },
            { label: '宏观利率中心', href: M8_LINKS.macroRateWatch },
          ],
        },
      ],
    },
  ];
}

function buildM8QuestionCards(isZh: boolean): HomeQuestionCard[] {
  if (!isZh) {
    return [
      {
        question: 'Where should a first-time reader start?',
        answer: 'Start with the market entrance, then move to the matching hub and only then the post stream.',
        href: M8_LINKS.startHere,
        label: 'Open start here',
      },
      {
        question: 'How are A-shares, US stocks, Hong Kong, and blockchain separated?',
        answer: 'Each market gets its own entrance so sector pages and pillar articles stop competing inside one feed.',
        href: M8_LINKS.researchDirectory,
        label: 'Open research directory',
      },
      {
        question: 'Which themes should keep accumulating long-form coverage?',
        answer: 'AI supply chain, Tesla / FSD, GLP-1, and macro rates remain the highest-intent expansion hubs.',
        href: M8_LINKS.aiSupplyChain,
        label: 'Open theme hubs',
      },
      {
        question: 'Where do frameworks and evergreen guides live?',
        answer: 'Use the support layer for investing frameworks, market mechanics, and research method pages.',
        href: M8_LINKS.investingFrameworks,
        label: 'Open support layer',
      },
    ];
  }

  return [
    {
      question: '第一次来 m8，应该先从哪里开始？',
      answer: '先从市场入口进入，再顺着专题页和核心长文往下读，不要先扎进完整文章流。',
      href: M8_LINKS.startHere,
      label: '先看开始阅读',
    },
    {
      question: 'A股、美股、港股、区块链为什么要拆成四个入口？',
      answer: '因为四个市场的搜索意图、研究框架和专题扩展方式不同，不能继续混在一个资讯流里。',
      href: M8_LINKS.researchDirectory,
      label: '进入研究目录',
    },
    {
      question: '哪些专题页最值得长期往下做厚？',
      answer: 'AI产业链、Tesla / FSD、创新药 / GLP-1、宏观利率路径是当前最该沉淀的高意图专题层。',
      href: M8_LINKS.aiSupplyChain,
      label: '进入重点专题',
    },
    {
      question: '估值、财报质量和市场机制这类常青内容放在哪里？',
      answer: '放在研究方法、投资框架和市场机制这些支撑层，不再和市场入口抢位置。',
      href: M8_LINKS.investingFrameworks,
      label: '进入支撑层',
    },
  ];
}

function buildM8SupportCards(isZh: boolean): HomeHubCard[] {
  if (!isZh) {
    return [
      {
        kicker: 'Support',
        title: 'Research method',
        description: 'Explain how m8 moves from macro and sectors into company work, instead of burying methodology in single posts.',
        href: M8_LINKS.researchMethod,
        cta: 'Open research method',
        links: [
          { label: 'Start here', href: M8_LINKS.startHere },
          { label: 'Research directory', href: M8_LINKS.researchDirectory },
        ],
      },
      {
        kicker: 'Support',
        title: 'Investing frameworks',
        description: 'Keep valuation, earnings quality, and position management inside one evergreen support layer.',
        href: M8_LINKS.investingFrameworks,
        cta: 'Open investing frameworks',
        links: [
          { label: 'Research method', href: M8_LINKS.researchMethod },
          { label: 'Blog archive', href: M8_LINKS.blog },
        ],
      },
      {
        kicker: 'Support',
        title: 'A-share mechanics',
        description: 'Use one evergreen page for market structure, trading rules, and style rotation before readers move into companies.',
        href: M8_LINKS.astockMechanics,
        cta: 'Open market mechanics',
        links: [
          { label: 'A-share coverage', href: M8_LINKS.aShareCoreCoverage },
          { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
        ],
      },
      {
        kicker: 'Support',
        title: 'Full archive',
        description: 'Use the archive only after the reader already knows the market and topic path they want to follow.',
        href: M8_LINKS.blog,
        cta: 'Open the archive',
        links: [
          { label: 'Latest posts', href: M8_LINKS.blog },
          { label: 'Research directory', href: M8_LINKS.researchDirectory },
        ],
      },
    ];
  }

  return [
    {
      kicker: '研究方法',
      title: '研究方法',
      description: '解释 m8 如何从宏观、行业到个股组织研究，让方法论不再散落在单篇文章里。',
      href: M8_LINKS.researchMethod,
      cta: '查看研究方法',
      links: [
        { label: '开始阅读', href: M8_LINKS.startHere },
        { label: '研究目录', href: M8_LINKS.researchDirectory },
      ],
    },
    {
      kicker: '投资框架',
      title: '投资框架中心',
      description: '把估值、财报质量、仓位管理和市场机制这类常青内容收成统一支撑层。',
      href: M8_LINKS.investingFrameworks,
      cta: '查看投资框架中心',
      links: [
        { label: '研究方法', href: M8_LINKS.researchMethod },
        { label: 'investing-101', href: '/category/investing-101/' },
      ],
    },
    {
      kicker: '市场机制',
      title: 'A股市场机制',
      description: '把注册制、T+1、涨跌停和风格切换单独拎出来，先补制度框架再回到公司研究。',
      href: M8_LINKS.astockMechanics,
      cta: '查看A股市场机制',
      links: [
        { label: 'A股核心标的', href: M8_LINKS.aShareCoreCoverage },
        { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
      ],
    },
    {
      kicker: '完整归档',
      title: '完整文章归档',
      description: '归档页只负责完整更新流，前面几个层级先负责分流和组织，避免首页再次变回普通资讯站。',
      href: M8_LINKS.blog,
      cta: '查看全部文章',
      links: [
        { label: '最新更新', href: M8_LINKS.blog },
        { label: '研究目录', href: M8_LINKS.researchDirectory },
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

  const useM8LockedHome = page === 1 && env.SITE_ID === 'm8.com.cn';
  const homePageSize = useM8LockedHome
    ? Math.max(config.postsPerPage || 12, 64)
    : config.postsPerPage;

  // Load posts from D1 (paginated)
  const { posts, total } = await getPosts(
    env.DB, env.SITE_ID, page, homePageSize,
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
  const featured = showFeatured
    ? enrichPostsWithAuthorIdentity(featuredPosts.slice(0, featuredCount), authors, env.SITE_ID)
    : [];
  const postsWithAuthor = enrichPostsWithAuthorIdentity(posts, authors, env.SITE_ID);

  // Home config
  const homeConfig = config.home || {};
  const defaultImages = config.defaults || {};
  const isZh = isZhLanguage(config.language);
  const useFocusedHome = page === 1 && (useM8LockedHome || homeConfig.showTopics === true);

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
  const focusCategorySlugs = useM8LockedHome
    ? M8_FOCUS_CATEGORIES
    : (homeConfig.focusCategories?.length
      ? homeConfig.focusCategories
      : (useFocusedHome ? M8_FOCUS_CATEGORIES : []));
  const availableCategoryMap = new Map(availableCategories.map((category) => [category.slug, category]));
  const focusCategories = focusCategorySlugs
    .map((slug) => availableCategoryMap.get(slug))
    .filter(Boolean) as typeof availableCategories;
  const fallbackTopicCategories = availableCategories.slice(0, 4);
  const topicCategories = (focusCategories.length > 0 ? focusCategories : fallbackTopicCategories).slice(0, 4);
  const marketCardOverrides = useFocusedHome
    ? {
        'a-stocks': {
          name: isZh ? 'A股' : 'A-shares',
          href: M8_LINKS.aShareCoreCoverage,
          description: isZh
            ? '围绕半导体设备、服务器链、国产替代、高股息和市场机制组织 A 股核心研究入口。'
            : 'Organize semicap, servers, domestic substitution, dividends, and market structure under one A-share entrance.',
        },
        'us-stocks': {
          name: isZh ? '美股' : 'US stocks',
          href: M8_LINKS.usStockCoreCoverage,
          description: isZh
            ? '围绕 AI 龙头、Tesla、半导体设备和创新药主线，收成长期跟踪的美股重点标的池。'
            : 'Use one market entrance for AI leaders, Tesla, semicap, and biotech coverage.',
        },
        'hk-stocks': {
          name: isZh ? '港股' : 'Hong Kong stocks',
          href: M8_LINKS.hkTechDividend,
          description: isZh
            ? '把平台互联网、消费电子 / 智能硬件、高股息能源 / 电信、保险和南向资金逻辑收成独立的港股研究入口。'
            : 'Create a dedicated Hong Kong market entrance for platforms, consumer electronics, dividends, insurers, and southbound flow.',
        },
        crypto: {
          name: isZh ? '区块链' : 'Blockchain',
          href: M8_LINKS.btcEtfWatch,
          description: isZh
            ? '围绕 BTC ETF 资金流、交易所 / 托管基础设施、稳定币监管、Treasury Beta 和链上生态，建立独立的区块链与加密资产入口。'
            : 'Create a separate blockchain and crypto entrance around BTC ETF flows, exchange infrastructure, treasury beta, stablecoins, and on-chain ecosystems.',
        },
      }
    : {};
  const topicCards = topicCategories.map((category) => {
    const override = marketCardOverrides[category.slug as keyof typeof marketCardOverrides];
    const seoMeta = buildCategorySeoMeta(config, category.slug, category.name, category.description);
    return {
      slug: category.slug,
      name: override?.name || category.name,
      href: override?.href || buildCategoryPath(categoryPrefix, category.slug),
      description: trimDescription(override?.description || category.description || '', seoMeta.description),
      count: category.count,
    };
  });
  const heroActions = useFocusedHome
    ? (useM8LockedHome
      ? topicCards.map((topic) => ({ label: topic.name, href: topic.href })).slice(0, 4)
      : [
          ...topicCards.map((topic) => ({ label: topic.name, href: topic.href })),
          { label: isZh ? '最新更新' : 'Latest posts', href: blogPath },
        ].slice(0, 5))
    : [];
  const heroHighlights = useFocusedHome
    ? []
    : [];
  const derivedHeroTitle = useM8LockedHome
    ? (isZh ? 'A股、美股、港股与区块链研究' : 'A-shares, US stocks, Hong Kong, and blockchain research')
    : (useFocusedHome && isBrandLikeTitle(homeConfig.title || '', config.name)
    ? (isZh ? 'A股、美股、港股与区块链研究' : 'A-shares, US stocks, Hong Kong, and blockchain research')
    : (homeConfig.title || config.name));
  const derivedHeroSubtitle = useM8LockedHome
    ? (isZh
      ? '先从四个市场入口进入，再顺着专题和深度文章往下读。'
      : 'Start from the four market entrances, then drill down into sector hubs such as AI, semiconductors, healthcare, dividends, and BTC ETF.')
    : (useFocusedHome
    ? (homeConfig.subtitle
      || (isZh
        ? '先从四个市场入口进入，再顺着 AI、半导体、创新药、高股息和 BTC ETF 等板块持续往下深挖。'
        : 'Start from the four market entrances, then drill down into sector hubs such as AI, semiconductors, healthcare, dividends, and BTC ETF.'))
    : (homeConfig.subtitle || config.description));
  const derivedPageTitle = useM8LockedHome
    ? (isZh
      ? `${config.name} · A股、美股、港股与区块链研究`
      : `${config.name} · A-shares, US stocks, Hong Kong, and blockchain research`)
    : (useFocusedHome && isBrandLikeTitle(homeConfig.title || '', config.name)
    ? (isZh
      ? `${config.name} · A股、美股、港股与区块链研究`
      : `${config.name} · A-shares, US stocks, Hong Kong, and blockchain research`)
    : (homeConfig.title || config.name));
  const derivedPageDescription = useM8LockedHome
    ? (isZh
      ? '围绕 A股、美股、港股与区块链四条主线组织中文投资研究，首页先给市场入口，再往下展开板块、专题和重点文章。'
      : 'A cross-market research site organized around A-shares, US stocks, Hong Kong, and blockchain, starting with market entrances and expanding into sector hubs.')
    : (useFocusedHome
    ? (isZh
      ? '围绕 A股、美股、港股与区块链四条主线组织中文投资研究，首页先给市场入口，再往下展开板块、专题和重点文章。'
      : 'A cross-market research site organized around A-shares, US stocks, Hong Kong, and blockchain, starting with market entrances and expanding into sector hubs.')
    : (homeConfig.subtitle || config.description));
  const latestPosts = useFocusedHome
    ? postsWithAuthorAndCategoryDisplay.slice(0, homeConfig.latestCount || 6)
    : postsWithAuthorAndCategoryDisplay;
  const categoriesForRender = useFocusedHome ? topicCategories : categoriesWithDefaults;
  const researchTracks = useFocusedHome && !useM8LockedHome ? buildM8ResearchTracks(isZh) : [];
  const hubCards = useFocusedHome && !useM8LockedHome ? buildM8HubCards(isZh) : [];
  const questionCards = useFocusedHome && !useM8LockedHome ? buildM8QuestionCards(isZh) : [];
  const supportCards = useFocusedHome && !useM8LockedHome ? buildM8SupportCards(isZh) : [];
  const featuredCards = useM8LockedHome ? [] : (useFocusedHome ? buildM8FeaturedCards(isZh) : []);
  const sectorGroups = useFocusedHome && !useM8LockedHome ? buildM8SectorGroups(isZh) : [];
  const readingSteps = useFocusedHome && !useM8LockedHome ? buildM8ReadingSteps(isZh) : [];
  const m8MagazineSections = useM8LockedHome
    ? buildM8MagazineSections(
        postsWithAuthorAndCategoryDisplay as HomeMagazinePost[],
        isZh,
        categoryPrefix,
      )
    : [];
  const m8LeadMain = useM8LockedHome
    ? (postsWithAuthorAndCategoryDisplay[0] as HomeMagazinePost | undefined)
    : undefined;
  const m8LeadSecondary = useM8LockedHome
    ? (postsWithAuthorAndCategoryDisplay.slice(1, 4) as HomeMagazinePost[])
    : [];
  const m8MagazineNav = m8MagazineSections.map((section) => ({
    label: section.label,
    href: section.href,
  }));
  const showTopicCards = useFocusedHome
    && topicCards.length > 0
    && !useM8LockedHome;
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
    showHeader: !useM8LockedHome,
    showFooter: !useM8LockedHome,
    customPartials,
    showM8MagazineHome: useM8LockedHome,
    m8MagazineTagline: isZh
      ? '跨市场投资研究 · 美股 · A 股 · 港股 · 加密'
      : 'Cross-market investment research · US · China A-shares · Hong Kong · Crypto',
    m8MagazineNav,
    m8LeadMain,
    m8LeadSecondary,
    m8MagazineSections,
    m8SectionMoreLabel: isZh ? '全部 →' : 'All →',
    m8BandTitle: isZh ? '每日深度更新' : 'Daily deep updates',
    m8BandDescription: isZh
      ? '数据驱动 · 标注引用 · 中性研究 · 跨市场视角'
      : 'Data-backed research, explicit sources, neutral framing, and cross-market context.',
    m8BandHref: blogPath,
    m8BandCtaLabel: isZh ? '浏览全部文章' : 'Browse all posts',
    // Home config
    heroEyebrow: useM8LockedHome
      ? (isZh ? 'm8 核心入口' : 'm8 focus')
      : (homeConfig.eyebrow || (useFocusedHome ? config.name : '')),
    heroTitle: derivedHeroTitle,
    heroSubtitle: derivedHeroSubtitle,
    heroImage: homeConfig.heroImage || '',
    heroActions,
    heroHighlights,
    showTopicCards,
    topicCards,
    showResearchTracks: researchTracks.length > 0,
    researchTracks,
    showQuestionCards: useM8LockedHome ? false : questionCards.length > 0,
    questionCards,
    questionCardsTitle: isZh ? '这页回答什么问题' : 'What this homepage answers',
    questionCardsDescription: isZh
      ? '先把首页应该承接的搜索意图和阅读路径说清楚，再把读者送到市场页、专题页和深度文。'
      : 'Make the homepage intent explicit first, then route readers into markets, hubs, and pillar articles.',
    researchTracksTitle: isZh ? '四大市场入口' : 'Four market entrances',
    researchTracksDescription: isZh
      ? '先从四个市场入口进入，再延展到专题和文章。'
      : 'Start from A-shares, US stocks, Hong Kong, and blockchain, then move into sectors, companies, and deep dives.',
    showHubCards: hubCards.length > 0,
    hubCards,
    hubCardsTitle: isZh ? '重点专题' : 'Priority research hubs',
    hubCardsDescription: isZh
      ? '把最值得长期做厚的主题收在第二层，继续往下承接阅读。'
      : 'Use the second layer for durable research hubs instead of flattening more entrances onto the homepage.',
    showSectorGroups: useM8LockedHome ? false : sectorGroups.length > 0,
    sectorGroups,
    sectorGroupsTitle: isZh ? 'A股与美股板块地图' : 'A-share and US stock sector map',
    sectorGroupsDescription: isZh
      ? '市场入口下面继续按行业和板块展开，方便把公司、财报和专题长文放进更清晰的站内路径里。'
      : 'Split each market entrance into cleaner sector paths before moving down to companies, earnings, and deep dives.',
    showReadingSteps: false,
    readingSteps,
    readingStepsTitle: isZh ? '怎么使用这个首页' : 'How to use this homepage',
    readingStepsDescription: isZh
      ? '首页负责分流和组织，不负责把所有文章平铺。先主线、再专题、最后归档。'
      : 'The homepage should organize and route readers, not flatten every article into one stream. Start with a track, then a hub, then the archive.',
    topicsTitle: useM8LockedHome
      ? (isZh ? '四大市场主线' : 'Four market entrances')
      : (homeConfig.topicsTitle || (useFocusedHome ? (isZh ? '四大市场主线' : 'Four market entrances') : '')),
    topicsDescription: useM8LockedHome
      ? (isZh ? '首页先给 A股、美股、港股、区块链 四个入口，后面再顺着页面里的板块和文章往下读。' : 'Start from A-shares, US stocks, Hong Kong, and blockchain, then follow the linked sectors and articles.')
      : (homeConfig.topicsDescription || (useFocusedHome
        ? (isZh ? '首页先给 A股、美股、港股、区块链 四个入口，后面再顺着页面里的板块和文章往下读。' : 'Start from A-shares, US stocks, Hong Kong, and blockchain, then follow the linked sectors and articles.')
        : '')),
    showSupportCards: useM8LockedHome ? false : supportCards.length > 0,
    supportCards,
    supportCardsTitle: isZh ? '研究支撑层' : 'Support layer',
    supportCardsDescription: isZh
      ? '把研究方法、投资框架、市场机制和完整归档留在支撑层，服务市场页和专题页，而不是让这些常青页继续抢首页入口。'
      : 'Keep frameworks, mechanics, and the full archive inside a support layer that serves the market and topic hubs.',
    showCategories: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showCategories === true : homeConfig.showCategories !== false),
    showTags: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showTags === true : homeConfig.showTags !== false),
    showStats: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showStats === true : homeConfig.showStats !== false),
    showFeatured,
    showFeaturedTextCards: useM8LockedHome && featuredCards.length > 0,
    featuredCards,
    featuredTitle: useM8LockedHome
      ? (isZh ? '重点公司样本' : 'Focus company samples')
      : (homeConfig.featuredTitle || (useFocusedHome ? (isZh ? '精选深度研究' : 'Featured deep dives') : '')),
    featuredDescription: useM8LockedHome
      ? (isZh ? '先看一组适合长期跟踪的样本公司，再继续往专题和文章下钻。' : 'Start with a small set of durable company samples before moving deeper into hubs and posts.')
      : (homeConfig.featuredDescription || (useFocusedHome
        ? (isZh ? '保留最值得反复阅读的一批深度文章，方便从市场入口继续往公司与产业链下钻。' : 'Keep the strongest deep dives on the homepage so readers can move from markets into companies and sectors.')
        : '')),
    latestTitle: useM8LockedHome
      ? (isZh ? '延伸阅读' : 'Further reading')
      : (homeConfig.latestTitle || (useFocusedHome ? (isZh ? '最新更新' : 'Latest updates') : '')),
    latestDescription: useM8LockedHome
      ? (isZh ? '这些文章与当前专题关键词、栏目和标题高度相关，适合作为第二层阅读路径。' : 'Use these posts as the second reading layer after the market and company cards.')
      : (homeConfig.latestDescription || (useFocusedHome
        ? (isZh ? '按时间查看最近的更新，完整归档与全部文章请进入文章列表。' : 'Use this section for recent updates and the archive for the full stream.')
        : '')),
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
