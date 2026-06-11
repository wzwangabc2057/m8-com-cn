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
