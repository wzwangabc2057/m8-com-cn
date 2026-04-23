/**
 * i18n: template label translations.
 *
 * Labels are resolved in order:
 *   1. site.labels (custom overrides in config.json)
 *   2. Built-in translations for site.language
 *   3. Fallback to zh-CN defaults
 */

export interface Labels {
  // Category / Tag page hero labels
  category: string;
  tag: string;

  // Home page sections
  featured: string;
  browseCategories: string;
  latestPosts: string;
  popularTags: string;

  // Home hero stats
  statPosts: string;
  statCategories: string;
  statTags: string;

  // Category card count
  postsCount: string;        // e.g. "篇文章" / "posts" / "artikel"

  // Pagination
  prevPage: string;
  nextPage: string;

  // Sidebar
  sidebarCategories: string;
  sidebarTags: string;

  // Misc
  readMore: string;
  allPosts: string;
  skipToContent: string;
  blog: string;  // Blog list page hero title (e.g. "Blog" / "Tin tức" / "文章")
  uncategorized: string;  // Default category label (e.g. "未分类" / "Chưa phân loại" / "Uncategorized")
}

/** Built-in translations keyed by language code */
const builtInTranslations: Record<string, Labels> = {
  'zh-CN': {
    category: '分类',
    tag: '标签',
    featured: '精选推荐',
    browseCategories: '分类浏览',
    latestPosts: '最新文章',
    popularTags: '热门标签',
    statPosts: '篇文章',
    statCategories: '个分类',
    statTags: '个标签',
    postsCount: '篇文章',
    prevPage: '上一页',
    nextPage: '下一页',
    sidebarCategories: '分类',
    sidebarTags: '标签',
    readMore: '阅读更多',
    allPosts: '查看全部文章',
    skipToContent: '跳至主要内容',
    blog: '文章',
    uncategorized: '未分类',
  },
  'zh': {
    category: '分类',
    tag: '标签',
    featured: '精选推荐',
    browseCategories: '分类浏览',
    latestPosts: '最新文章',
    popularTags: '热门标签',
    statPosts: '篇文章',
    statCategories: '个分类',
    statTags: '个标签',
    postsCount: '篇文章',
    prevPage: '上一页',
    nextPage: '下一页',
    sidebarCategories: '分类',
    sidebarTags: '标签',
    readMore: '阅读更多',
    allPosts: '查看全部文章',
    skipToContent: '跳至主要内容',
    blog: '文章',
    uncategorized: '未分类',
  },
  'en': {
    category: 'Category',
    tag: 'Tag',
    featured: 'Featured',
    browseCategories: 'Categories',
    latestPosts: 'Latest Posts',
    popularTags: 'Popular Tags',
    statPosts: 'posts',
    statCategories: 'categories',
    statTags: 'tags',
    postsCount: 'posts',
    prevPage: 'Previous',
    nextPage: 'Next',
    sidebarCategories: 'Categories',
    sidebarTags: 'Tags',
    readMore: 'Read More',
    allPosts: 'View All Posts',
    skipToContent: 'Skip to main content',
    blog: 'Blog',
    uncategorized: 'Uncategorized',
  },
  'id': {
    category: 'Kategori',
    tag: 'Tag',
    featured: 'Unggulan',
    browseCategories: 'Jelajahi Kategori',
    latestPosts: 'Artikel Terbaru',
    popularTags: 'Tag Populer',
    statPosts: 'artikel',
    statCategories: 'kategori',
    statTags: 'tag',
    postsCount: 'artikel',
    prevPage: 'Sebelumnya',
    nextPage: 'Berikutnya',
    sidebarCategories: 'Kategori',
    sidebarTags: 'Tag',
    readMore: 'Baca Selengkapnya',
    allPosts: 'Lihat Semua Artikel',
    skipToContent: 'Langsung ke konten utama',
    blog: 'Blog',
    uncategorized: 'Tidak berkategori',
  },
  'ja': {
    category: 'カテゴリ',
    tag: 'タグ',
    featured: 'おすすめ',
    browseCategories: 'カテゴリ一覧',
    latestPosts: '最新記事',
    popularTags: '人気タグ',
    statPosts: '記事',
    statCategories: 'カテゴリ',
    statTags: 'タグ',
    postsCount: '記事',
    prevPage: '前へ',
    nextPage: '次へ',
    sidebarCategories: 'カテゴリ',
    sidebarTags: 'タグ',
    readMore: '続きを読む',
    allPosts: 'すべての記事',
    skipToContent: 'メインコンテンツへ',
    blog: 'ブログ',
    uncategorized: '未分類',
  },
  'ko': {
    category: '카테고리',
    tag: '태그',
    featured: '추천',
    browseCategories: '카테고리 둘러보기',
    latestPosts: '최신 글',
    popularTags: '인기 태그',
    statPosts: '개 글',
    statCategories: '개 카테고리',
    statTags: '개 태그',
    postsCount: '개 글',
    prevPage: '이전',
    nextPage: '다음',
    sidebarCategories: '카테고리',
    sidebarTags: '태그',
    readMore: '더 읽기',
    allPosts: '모든 글 보기',
    skipToContent: '본문으로 건너뛰기',
    blog: '블로그',
    uncategorized: '미분류',
  },
  'vi': {
    category: 'Danh mục',
    tag: 'Thẻ',
    featured: 'Nổi bật',
    browseCategories: 'Duyệt danh mục',
    latestPosts: 'Bài viết mới nhất',
    popularTags: 'Thẻ phổ biến',
    statPosts: 'bài viết',
    statCategories: 'danh mục',
    statTags: 'thẻ',
    postsCount: 'bài viết',
    prevPage: 'Trang trước',
    nextPage: 'Trang sau',
    sidebarCategories: 'Danh mục',
    sidebarTags: 'Thẻ',
    readMore: 'Đọc thêm',
    allPosts: 'Xem tất cả bài viết',
    skipToContent: 'Chuyển tới nội dung chính',
    blog: 'Tin tức',
    uncategorized: 'Chưa phân loại',
  },
  'vi-VN': {
    category: 'Danh mục',
    tag: 'Thẻ',
    featured: 'Nổi bật',
    browseCategories: 'Duyệt danh mục',
    latestPosts: 'Bài viết mới nhất',
    popularTags: 'Thẻ phổ biến',
    statPosts: 'bài viết',
    statCategories: 'danh mục',
    statTags: 'thẻ',
    postsCount: 'bài viết',
    prevPage: 'Trang trước',
    nextPage: 'Trang sau',
    sidebarCategories: 'Danh mục',
    sidebarTags: 'Thẻ',
    readMore: 'Đọc thêm',
    allPosts: 'Xem tất cả bài viết',
    skipToContent: 'Chuyển tới nội dung chính',
    blog: 'Tin tức',
    uncategorized: 'Chưa phân loại',
  },
  'th': {
    category: 'หมวดหมู่',
    tag: 'แท็ก',
    featured: 'แนะนำ',
    browseCategories: 'เรียกดูหมวดหมู่',
    latestPosts: 'บทความล่าสุด',
    popularTags: 'แท็กยอดนิยม',
    statPosts: 'บทความ',
    statCategories: 'หมวดหมู่',
    statTags: 'แท็ก',
    postsCount: 'บทความ',
    prevPage: 'ก่อนหน้า',
    nextPage: 'ถัดไป',
    sidebarCategories: 'หมวดหมู่',
    sidebarTags: 'แท็ก',
    readMore: 'อ่านเพิ่มเติม',
    allPosts: 'ดูทั้งหมด',
    skipToContent: 'ข้ามไปเนื้อหาหลัก',
    blog: 'บล็อก',
    uncategorized: 'ไม่มีหมวดหมู่',
  },
  'th-TH': {
    category: 'หมวดหมู่',
    tag: 'แท็ก',
    featured: 'แนะนำ',
    browseCategories: 'เรียกดูหมวดหมู่',
    latestPosts: 'บทความล่าสุด',
    popularTags: 'แท็กยอดนิยม',
    statPosts: 'บทความ',
    statCategories: 'หมวดหมู่',
    statTags: 'แท็ก',
    postsCount: 'บทความ',
    prevPage: 'ก่อนหน้า',
    nextPage: 'ถัดไป',
    sidebarCategories: 'หมวดหมู่',
    sidebarTags: 'แท็ก',
    readMore: 'อ่านเพิ่มเติม',
    allPosts: 'ดูทั้งหมด',
    skipToContent: 'ข้ามไปเนื้อหาหลัก',
    blog: 'บล็อก',
    uncategorized: 'ไม่มีหมวดหมู่',
  },
};

// Default fallback
const defaultLabels = builtInTranslations['zh-CN'];

/**
 * Resolve labels for a site: merge built-in defaults with custom overrides.
 */
export function resolveLabels(language: string, customLabels?: Partial<Labels>): Labels {
  // Try exact match, then base language (e.g. "zh-CN" → "zh")
  const base = language.split('-')[0];
  const builtIn = builtInTranslations[language]
    || builtInTranslations[base]
    || builtInTranslations['en']  // fallback to English for unknown languages
    || defaultLabels;

  if (!customLabels || Object.keys(customLabels).length === 0) {
    return builtIn;
  }

  // Merge: custom overrides take priority
  return { ...builtIn, ...customLabels };
}
