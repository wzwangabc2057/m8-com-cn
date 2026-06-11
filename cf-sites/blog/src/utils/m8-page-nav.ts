export interface PageBreadcrumbItem {
  name: string;
  url: string;
}

export interface PageCompanionLink {
  label: string;
  href: string;
}

export interface M8PageNavigation {
  breadcrumbs: PageBreadcrumbItem[];
  companionLabel: string;
  companionTitle: string;
  companionSummary: string;
  companionLinks: PageCompanionLink[];
}

export interface M8PostNavigation {
  companionLabel: string;
  companionTitle: string;
  companionSummary: string;
  companionLinks: PageCompanionLink[];
}

interface PageNavDefinition {
  parent?: { slug: string; name: string };
  links: PageCompanionLink[];
}

const ROOT_PAGES: Record<string, string> = {
  'start-here': '开始阅读',
  'research-directory': '研究目录',
  'research-method': '研究方法',
  'about': '关于 m8',
};

const PAGE_NAV_MAP: Record<string, PageNavDefinition> = {
  'start-here': {
    links: [
      { label: '研究目录', href: '/research-directory/' },
      { label: '研究方法', href: '/research-method/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'research-directory': {
    links: [
      { label: '开始阅读', href: '/start-here/' },
      { label: '研究方法', href: '/research-method/' },
      { label: 'A股核心标的', href: '/a-share-core-coverage/' },
      { label: '美股重点标的', href: '/us-stock-core-coverage/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'research-method': {
    links: [
      { label: '开始阅读', href: '/start-here/' },
      { label: '研究目录', href: '/research-directory/' },
      { label: '投资框架中心', href: '/investing-frameworks/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  about: {
    links: [
      { label: '开始阅读', href: '/start-here/' },
      { label: '研究目录', href: '/research-directory/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'a-share-core-coverage': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: 'A股栏目', href: '/category/a-stocks/' },
      { label: 'A股主线中心', href: '/a-share-mainlines/' },
      { label: 'AI产业链中心', href: '/ai-supply-chain/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'us-stock-core-coverage': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '美股栏目', href: '/category/us-stocks/' },
      { label: 'Tesla / FSD 中心', href: '/tesla-fsd/' },
      { label: 'AI产业链中心', href: '/ai-supply-chain/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'hk-tech-dividend': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '港股栏目', href: '/category/hk-stocks/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'btc-etf-watch': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '加密栏目', href: '/category/crypto/' },
      { label: '宏观利率中心', href: '/macro-rate-watch/' },
      { label: '投资框架中心', href: '/investing-frameworks/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'ai-supply-chain': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: 'AI产业链栏目', href: '/category/ai-stocks/' },
      { label: 'A股核心标的', href: '/a-share-core-coverage/' },
      { label: '美股重点标的', href: '/us-stock-core-coverage/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'ai-agent-platforms': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: 'AI产业链栏目', href: '/category/ai-stocks/' },
      { label: '美股重点标的', href: '/us-stock-core-coverage/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'tesla-fsd': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '美股栏目', href: '/category/us-stocks/' },
      { label: '美股重点标的', href: '/us-stock-core-coverage/' },
      { label: 'A股主线中心', href: '/a-share-mainlines/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'a-share-mainlines': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: 'A股栏目', href: '/category/a-stocks/' },
      { label: 'A股核心标的', href: '/a-share-core-coverage/' },
      { label: 'AI产业链中心', href: '/ai-supply-chain/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'macro-rate-watch': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '宏观栏目', href: '/category/macro/' },
      { label: 'BTC ETF 中心', href: '/btc-etf-watch/' },
      { label: '投资框架中心', href: '/investing-frameworks/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'glp1-drug-watch': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '行业研究栏目', href: '/category/industry-research/' },
      { label: '美股重点标的', href: '/us-stock-core-coverage/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
  'investing-frameworks': {
    parent: { slug: 'research-directory', name: '研究目录' },
    links: [
      { label: '投资科普栏目', href: '/category/investing-101/' },
      { label: '开始阅读', href: '/start-here/' },
      { label: '研究方法', href: '/research-method/' },
      { label: '全部归档', href: '/blog' },
    ],
  },
};

export function getM8PageNavigation(slug: string, pageTitle: string): M8PageNavigation | null {
  const definition = PAGE_NAV_MAP[slug];
  if (!definition) return null;

  const breadcrumbs: PageBreadcrumbItem[] = [{ name: 'm8', url: '/' }];
  if (definition.parent) {
    breadcrumbs.push({
      name: definition.parent.name,
      url: `/${definition.parent.slug}/`,
    });
  } else if (ROOT_PAGES[slug] && slug !== 'research-directory') {
    breadcrumbs.push({
      name: ROOT_PAGES[slug],
      url: `/${slug}/`,
    });
  }
  breadcrumbs.push({
    name: pageTitle,
    url: `/${slug}/`,
  });

  return {
    breadcrumbs,
    companionLabel: '继续浏览',
    companionTitle: definition.parent ? '回到上层目录，再进入相邻专题' : '从入口页继续进入主目录和相邻专题',
    companionSummary: definition.parent
      ? '这些链接负责把专题页重新接回研究目录、主栏目与相邻专题，避免页面只剩单向阅读。'
      : '把入口页、目录页和专题页串起来，方便读者与搜索引擎理解站内层级关系。',
    companionLinks: definition.links,
  };
}

function dedupeLinks(links: PageCompanionLink[]): PageCompanionLink[] {
  const seen = new Set<string>();
  const result: PageCompanionLink[] = [];
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    result.push(link);
  }
  return result;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function categoryHubLink(category: string): PageCompanionLink | null {
  switch (category) {
    case 'a-stocks':
      return { label: 'A股核心标的', href: '/a-share-core-coverage' };
    case 'us-stocks':
      return { label: '美股重点标的', href: '/us-stock-core-coverage' };
    case 'hk-stocks':
      return { label: '港股研究中心', href: '/hk-tech-dividend' };
    case 'crypto':
      return { label: 'BTC ETF 中心', href: '/btc-etf-watch' };
    case 'macro':
      return { label: '宏观利率中心', href: '/macro-rate-watch' };
    case 'ai-stocks':
      return { label: 'AI产业链中心', href: '/ai-supply-chain' };
    case 'industry-research':
      return { label: '行业研究主线', href: '/glp1-drug-watch' };
    case 'investing-101':
      return { label: '投资框架中心', href: '/investing-frameworks' };
    default:
      return null;
  }
}

function keywordHubLinks(text: string): PageCompanionLink[] {
  const value = text.toLowerCase();
  const links: PageCompanionLink[] = [];

  if (/(tesla|fsd|robotaxi|optimus)/.test(value)) {
    links.push({ label: 'Tesla / FSD 中心', href: '/tesla-fsd' });
  }
  if (/(glp-?1|wegovy|eli lilly|oral glp|retatrutide)/.test(value)) {
    links.push({ label: 'GLP-1 专题', href: '/glp1-drug-watch' });
  }
  if (/(openai|agent|gpt|xcode|coding agents)/.test(value)) {
    links.push({ label: 'AI 软件 / Agent', href: '/ai-agent-platforms' });
  }
  if (/(bitcoin|btc|crypto|stablecoin|cme)/.test(value)) {
    links.push({ label: '区块链 / BTC ETF', href: '/btc-etf-watch' });
  }
  if (/(hbm|gpu|nvidia|rubin|micron|packaging|advanced packaging)/.test(value)) {
    links.push({ label: 'AI产业链中心', href: '/ai-supply-chain' });
  }

  return links;
}

export function getM8PostNavigation(args: {
  slug: string;
  title: string;
  categories: string[];
  tags: string[];
  authorId?: string;
}): M8PostNavigation {
  const primaryCategory = args.categories[0];
  const links: PageCompanionLink[] = [
    { label: '研究目录', href: '/research-directory' },
    { label: '开始阅读', href: '/start-here' },
  ];

  if (primaryCategory) {
    links.push({ label: '返回所属栏目', href: `/category/${encodeSegment(primaryCategory)}` });
    const hubLink = categoryHubLink(primaryCategory);
    if (hubLink) links.push(hubLink);
  }

  for (const tag of args.tags.slice(0, 3)) {
    links.push({ label: `标签：${tag}`, href: `/tag/${encodeSegment(tag)}` });
  }

  links.push(...keywordHubLinks(`${args.slug} ${args.title} ${args.tags.join(' ')}`));

  if (args.authorId) {
    links.push({ label: '作者页', href: `/author/${encodeSegment(args.authorId)}` });
  }

  links.push({ label: '全部归档', href: '/blog' });

  return {
    companionLabel: '继续延伸',
    companionTitle: '先回到上层栏目，再进入相邻专题',
    companionSummary: '把单篇文章重新接回栏目页、专题页、作者页和研究目录，减少孤立文章，增强站内层级与连续阅读。',
    companionLinks: dedupeLinks(links).slice(0, 8),
  };
}
