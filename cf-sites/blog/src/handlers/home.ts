
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
        kicker: 'China A-Shares',
        title: 'A-share core coverage',
        description: 'Use the A-share market entrance to organize semicap, servers, domestic substitution, dividends, and market structure work.',
        href: M8_LINKS.aShareCoreCoverage,
        cta: 'Open A-share coverage',
        links: [
          { label: 'A-share mainlines', href: M8_LINKS.aShareMainlines },
          { label: 'Zhongwei deep dive', href: M8_LINKS.zhongwei },
          { label: 'Market mechanics', href: M8_LINKS.astockMechanics },
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
          { label: 'Oral GLP-1', href: M8_LINKS.oralGlp1 },
        ],
      },
      {
        kicker: 'Hong Kong',
        title: 'Hong Kong stock coverage',
        description: 'Use Hong Kong stocks as a separate market entrance for internet platforms, insurers, exporters, and high-dividend defensives.',
        href: M8_LINKS.hkTechDividend,
        cta: 'Open Hong Kong coverage',
        links: [
          { label: 'CNOOC deep dive', href: M8_LINKS.hkCnooc },
          { label: 'Xiaomi deep dive', href: M8_LINKS.hkXiaomi },
          { label: 'HK research hub', href: M8_LINKS.hkTechDividend },
        ],
      },
      {
        kicker: 'Blockchain',
        title: 'Blockchain and crypto assets',
        description: 'Give BTC ETF, crypto beta, stablecoin regulation, and on-chain ecosystem names their own market-level entrance.',
        href: M8_LINKS.btcEtfWatch,
        cta: 'Open blockchain coverage',
        links: [
          { label: 'BTC ETF center', href: M8_LINKS.btcEtfWatch },
          { label: 'CME crypto basket', href: M8_LINKS.cryptoCme },
          { label: 'Coinbase Base ecosystem', href: M8_LINKS.cryptoCoinbaseBase },
        ],
      },
    ];
  }

  return [
    {
      kicker: 'A Shares',
      title: 'A股主线与核心标的',
      description: '把半导体设备、服务器链、国产替代、高股息和市场机制收成统一的 A 股研究入口，先看主线，再进公司与板块。',
      href: M8_LINKS.aShareCoreCoverage,
      cta: '进入 A股研究主线',
      links: [
        { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
        { label: '中微公司深度', href: M8_LINKS.zhongwei },
        { label: 'A股市场机制', href: M8_LINKS.astockMechanics },
      ],
    },
    {
      kicker: 'US Stocks',
      title: '美股重点标的与财报线',
      description: '把 AI 龙头、Tesla、半导体设备和创新药主线收成长期覆盖池，让美股入口按市场而不是按零散事件组织。',
      href: M8_LINKS.usStockCoreCoverage,
      cta: '进入 美股重点标的',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'NVIDIA 系统级资本开支', href: M8_LINKS.nvidiaSystem },
        { label: '口服 GLP-1', href: M8_LINKS.oralGlp1 },
      ],
    },
    {
      kicker: 'Hong Kong',
      title: '港股平台、红利与制造链',
      description: '把港股互联网平台、保险、高股息、出海制造和南向资金逻辑单独收口，避免港股内容被并进其他市场栏目。',
      href: M8_LINKS.hkTechDividend,
      cta: '进入 港股研究中心',
      links: [
        { label: '港股研究中心', href: M8_LINKS.hkTechDividend },
        { label: '中海油 0883.HK', href: M8_LINKS.hkCnooc },
        { label: '小米 1810.HK', href: M8_LINKS.hkXiaomi },
      ],
    },
    {
      kicker: 'Blockchain',
      title: '区块链与加密资产主线',
      description: '围绕 BTC ETF、交易所、稳定币监管、链上生态和加密风险偏好，建立独立的区块链研究入口。',
      href: M8_LINKS.btcEtfWatch,
      cta: '进入 区块链研究中心',
      links: [
        { label: 'BTC ETF 中心', href: M8_LINKS.btcEtfWatch },
        { label: 'CME 加密指数期货', href: M8_LINKS.cryptoCme },
        { label: 'Coinbase Base 生态', href: M8_LINKS.cryptoCoinbaseBase },
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
      kicker: 'Sector',
      title: 'AI产业链专题',
      description: '把 HBM、先进封装、数据中心资本开支、GPU 和 AI 软件层落地放到同一个板块专题里持续扩写。',
      href: M8_LINKS.aiSupplyChain,
      cta: '打开 AI产业链专题',
      links: [
        { label: 'HBM / 先进封装', href: M8_LINKS.besiHbm4 },
        { label: 'AI软件 / Agent', href: M8_LINKS.aiAgentPlatforms },
      ],
    },
    {
      kicker: 'Sector',
      title: 'Tesla / FSD / 机器人链',
      description: '把 Tesla、FSD、Robotaxi、Optimus 和供应链映射收成持续阅读的一个板块层，而不是碎片事件稿。',
      href: M8_LINKS.teslaFsd,
      cta: '打开 Tesla / FSD 专题',
      links: [
        { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
        { label: 'Optimus 供应链', href: M8_LINKS.teslaOptimus },
      ],
    },
    {
      kicker: 'Sector',
      title: '创新药 / GLP-1 专题',
      description: '把口服 GLP-1、减重药竞争格局、创新药支付与供应链映射整理成独立的长期专题。',
      href: '/glp1-drug-watch',
      cta: '打开 创新药专题',
      links: [
        { label: 'GLP-1 供应链', href: M8_LINKS.glp1Supply },
        { label: '口服 GLP-1', href: M8_LINKS.oralGlp1 },
      ],
    },
    {
      kicker: 'Framework',
      title: '研究方法与市场机制',
      description: '把估值、财报质量、仓位管理、市场机制和研究方法保留为常青层，服务四条市场主线的基础阅读。',
      href: M8_LINKS.investingFrameworks,
      cta: '打开 研究方法层',
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
      description: '把 A股继续拆成半导体设备、AI服务器链、国产算力、高股息与市场机制，不再只保留一个总入口。',
      items: [
        {
          title: '半导体设备与先进制造',
          description: '围绕刻蚀、薄膜沉积、先进制程设备和国产替代，把最核心的设备链单独做厚。',
          href: M8_LINKS.zhongwei,
          links: [
            { label: 'A股核心标的', href: M8_LINKS.aShareCoreCoverage },
            { label: '中微公司深度', href: M8_LINKS.zhongwei },
          ],
        },
        {
          title: 'AI服务器链 / PCB / 制造链',
          description: '把 AI 服务器、交换、PCB、上游制造协同放进一个 A股算力配套板块里，方便持续补公司。',
          href: M8_LINKS.aShareCoreCoverage,
          links: [
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
          ],
        },
        {
          title: '国产算力 / 政策催化 / 市场机制',
          description: '把国产算力、政策催化和 A股交易制度放在一起，解决“逻辑对了但市场不一样”的阅读断层。',
          href: M8_LINKS.astockMechanics,
          links: [
            { label: 'A股市场机制', href: M8_LINKS.astockMechanics },
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
          ],
        },
        {
          title: '高股息 / 红利资产 / 资源股',
          description: '把高股息央企、红利资产和资源股从成长主线里拆出来，形成单独的防御资产阅读口。',
          href: M8_LINKS.aShareMainlines,
          links: [
            { label: 'A股主线中心', href: M8_LINKS.aShareMainlines },
            { label: 'A股核心标的', href: M8_LINKS.aShareCoreCoverage },
          ],
        },
      ],
    },
    {
      market: '美股',
      title: '美股细分板块',
      description: '把美股继续拆成 AI算力、半导体设备、Tesla / FSD、AI软件 / Agent、创新药 / GLP-1，方便做长期覆盖池。',
      items: [
        {
          title: 'AI算力 / GPU / HBM',
          description: '把 NVIDIA、HBM、先进封装和数据中心资本开支放进一条 AI 基建板块里，不和泛科技稿混在一起。',
          href: M8_LINKS.aiSupplyChain,
          links: [
            { label: 'AI产业链中心', href: M8_LINKS.aiSupplyChain },
            { label: 'NVIDIA 系统级资本开支', href: M8_LINKS.nvidiaSystem },
          ],
        },
        {
          title: 'Tesla / FSD / Robotaxi / 机器人',
          description: '把 Tesla 财报、FSD 进度、Robotaxi 估值逻辑和 Optimus 供应链拆成独立长线专题。',
          href: M8_LINKS.teslaFsd,
          links: [
            { label: 'Tesla / FSD 中心', href: M8_LINKS.teslaFsd },
            { label: 'Tesla Q1 2026', href: M8_LINKS.teslaQ1 },
          ],
        },
        {
          title: 'AI软件 / Agent / 模型平台',
          description: '把 OpenAI、Agent、企业级 AI 软件和开发者工作流单独列出，避免只被归到 AI 硬件下面。',
          href: M8_LINKS.aiAgentPlatforms,
          links: [
            { label: 'AI软件 / Agent', href: M8_LINKS.aiAgentPlatforms },
            { label: 'GPT-5 企业版', href: M8_LINKS.openaiGpt5 },
          ],
        },
        {
          title: '创新药 / GLP-1 / 医疗支付',
          description: '把减重药、口服 GLP-1、支付渠道和创新药竞争格局收成独立的美股医疗板块层。',
          href: '/glp1-drug-watch',
          links: [
            { label: '创新药 / GLP-1 中心', href: '/glp1-drug-watch' },
            { label: '口服 GLP-1', href: M8_LINKS.oralGlp1 },
          ],
        },
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
  const featured = showFeatured
    ? enrichPostsWithAuthorIdentity(featuredPosts.slice(0, featuredCount), authors, env.SITE_ID)
    : [];
  const postsWithAuthor = enrichPostsWithAuthorIdentity(posts, authors, env.SITE_ID);

  // Home config
  const homeConfig = config.home || {};
  const defaultImages = config.defaults || {};
  const isZh = isZhLanguage(config.language);
  const useM8LockedHome = page === 1 && env.SITE_ID === 'm8.com.cn';
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
            ? '把平台互联网、保险、高股息、出海制造和南向资金逻辑收成独立的港股研究入口。'
            : 'Create a dedicated Hong Kong market entrance for platforms, insurers, dividends, and exporters.',
        },
        crypto: {
          name: isZh ? '区块链' : 'Blockchain',
          href: M8_LINKS.btcEtfWatch,
          description: isZh
            ? '围绕 BTC ETF、交易所、稳定币监管和链上生态，建立独立的区块链与加密资产入口。'
            : 'Create a separate blockchain and crypto entrance around BTC ETF, exchanges, stablecoins, and on-chain ecosystems.',
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
    ? [
        ...topicCards.map((topic) => ({ label: topic.name, href: topic.href })),
        { label: isZh ? '最新更新' : 'Latest posts', href: blogPath },
      ].slice(0, 5)
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
      ? '先从四个市场入口进入，再顺着 AI、半导体、创新药、高股息和 BTC ETF 等板块持续往下深挖。'
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
  const researchTracks: HomeResearchTrack[] = [];
  const hubCards = useFocusedHome ? buildM8HubCards(isZh) : [];
  const sectorGroups = useFocusedHome ? buildM8SectorGroups(isZh) : [];
  const readingSteps = useFocusedHome ? buildM8ReadingSteps(isZh) : [];
  const showTopicCards = useFocusedHome
    && topicCards.length > 0;
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
    showResearchTracks: false,
    researchTracks,
    researchTracksTitle: isZh ? '四大市场主线' : 'Four market tracks',
    researchTracksDescription: isZh
      ? '先从四个市场入口进入，再延展到专题和文章。'
      : 'Start from the four market entrances, then move into hubs and articles.',
    showHubCards: hubCards.length > 0,
    hubCards,
    hubCardsTitle: isZh ? '核心板块专题' : 'Core sector hubs',
    hubCardsDescription: isZh
      ? '把 AI、Tesla / FSD、创新药和研究方法放在第二层，作为四条市场主线下面的持续扩写板块。'
      : 'Keep AI, Tesla / FSD, healthcare, and frameworks on the second layer under the four market entrances.',
    showSectorGroups: sectorGroups.length > 0,
    sectorGroups,
    sectorGroupsTitle: isZh ? 'A股与美股细分板块' : 'Granular A-share and US stock sectors',
    sectorGroupsDescription: isZh
      ? '主线先按市场分，第二层继续按行业与板块展开，后面再落到公司、财报和专题长文。'
      : 'Start with market entrances, then split them into sectors before moving down to companies, earnings, and deep dives.',
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
    showCategories: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showCategories === true : homeConfig.showCategories !== false),
    showTags: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showTags === true : homeConfig.showTags !== false),
    showStats: useM8LockedHome ? false : (useFocusedHome ? homeConfig.showStats === true : homeConfig.showStats !== false),
    showFeatured,
    featuredTitle: useM8LockedHome
      ? (isZh ? '重点深度研究' : 'Featured deep dives')
      : (homeConfig.featuredTitle || (useFocusedHome ? (isZh ? '重点深度研究' : 'Featured deep dives') : '')),
    featuredDescription: useM8LockedHome
      ? (isZh ? '保留最值得反复阅读的一批深度文章，方便从市场入口继续往公司与产业链下钻。' : 'Keep the strongest deep dives on the homepage so readers can move from markets into companies and sectors.')
      : (homeConfig.featuredDescription || (useFocusedHome
        ? (isZh ? '保留最值得反复阅读的一批深度文章，方便从市场入口继续往公司与产业链下钻。' : 'Keep the strongest deep dives on the homepage so readers can move from markets into companies and sectors.')
        : '')),
    latestTitle: useM8LockedHome
      ? (isZh ? '最新更新' : 'Latest updates')
      : (homeConfig.latestTitle || (useFocusedHome ? (isZh ? '最新更新' : 'Latest updates') : '')),
    latestDescription: useM8LockedHome
      ? (isZh ? '按时间查看最近的更新，完整归档与全部文章请进入文章列表。' : 'Use this section for recent updates and the archive for the full stream.')
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
