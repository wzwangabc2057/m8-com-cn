export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  relatedEndpoints: string[];
  content: string;
}

const TOOL_URL = 'https://site-dev-tool.pages.dev/site-dev.cjs';

export const SKILL_INDEX: SkillEntry[] = [
  {
    id: "cms-guide",
    name: "CMS Guide",
    description: "Setup, authentication, API overview, error handling.",
    category: "getting-started",
    relatedEndpoints: ["/api/openapi.json", "/api/skills", "/api/auth/verify", "/api/sites"],
    content: `# CMS Guide

## Prerequisites

- Node.js 18+
- tailwindcss CLI: \`npm install -g @tailwindcss/cli\`

## Install site-dev Tool

\`\`\`bash
curl -fsSL ${TOOL_URL} -o site-dev.cjs
\`\`\`

## Configure

\`\`\`bash
cat > .env << 'EOF'
CMS_BASE_URL=https://your-cms.pages.dev
CMS_API_KEY=your-api-key
EOF
\`\`\`

## Verify

\`\`\`bash
node site-dev.cjs list
\`\`\`

## Commands

| Command | Description |
|---|---|
| \`node site-dev.cjs list [search]\` | List/search sites |
| \`node site-dev.cjs create <id> [--domain=... --lang=... --theme=...]\` | Scaffold new site |
| \`node site-dev.cjs pull <id>\` | Download site to local |
| \`node site-dev.cjs dev <id>\` | Local preview (http://localhost:4321) |
| \`node site-dev.cjs push <id>\` | Compile CSS + push to CMS |

## Skills

| Skill | When to Use |
|---|---|
| \`cms-guide\` | Setup, overview |
| \`cms-site-new\` | Create a new site |
| \`cms-site-pages\` | Edit and update existing site pages |

## API Reference

Full spec: \`GET /api/openapi.json\`

Auth: \`Authorization: Bearer <API_KEY>\` (except /api/skills, /api/openapi.json, /api/site-assets)

## Errors

| Status | Action |
|---|---|
| 400 | Fix request |
| 401 | Check API_KEY |
| 404 | Check siteId/slug |
| 409 | Already exists |
| 500 | Retry (2s → 5s → 10s) |
`,
  },

  {
    id: "cms-site-new",
    name: "Create New Site",
    description: "Scaffold a new site with pages, partials, and Tailwind CSS.",
    category: "site-management",
    relatedEndpoints: ["/api/sites", "/api/config", "/api/pages", "/api/meta", "/api/partials/{name}"],
    content: `# Create New Site

## Step 1: Install

\`\`\`bash
curl -fsSL ${TOOL_URL} -o site-dev.cjs
npm install -g @tailwindcss/cli
cat > .env << 'EOF'
CMS_BASE_URL=https://your-cms.pages.dev
CMS_API_KEY=your-api-key
EOF
\`\`\`

## Step 2: Create

\`\`\`bash
node site-dev.cjs create <siteId> --domain=<domain> --theme=default --lang=en
\`\`\`

| Flag | Default | Values |
|---|---|---|
| --name | siteId | Any string |
| --domain | — | Domain to bind |
| --theme | default | default, minimal |
| --lang | zh-CN | en, zh-CN, th, ja |

Creates:

\`\`\`
sites/<siteId>/
├── config.json           # Nav, SEO, theme, header, footer
├── meta.json             # Authors, categories, tags
├── pages/
│   ├── about.json        # Page metadata
│   ├── about.html        # Page HTML (Tailwind classes)
│   ├── contact.json
│   └── contact.html
├── partials/
│   ├── header.html       # Site header
│   └── footer.html       # Site footer
└── images/               # Put images here (auto webp + upload on push)
\`\`\`

## Step 3: Edit Pages

All styling uses Tailwind classes directly in HTML.
Images: put files in \`images/\` folder, reference as \`/images/filename.png\` in HTML.

**pages/about.html:**
\`\`\`html
<section class="max-w-4xl mx-auto py-12 px-4">
  <h2 class="text-3xl font-bold text-gray-900 mb-6">About Us</h2>
  <img src="/images/team.jpg" alt="Team photo" class="w-full rounded-lg mb-8" />
  <p class="text-lg text-gray-600 leading-relaxed">We build amazing things.</p>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
    <div class="bg-white rounded-lg shadow p-6">
      <img src="/images/icon-mission.png" alt="" class="w-12 h-12 mb-4" />
      <h3 class="font-semibold text-xl mb-2">Mission</h3>
      <p class="text-gray-500">...</p>
    </div>
  </div>
</section>
\`\`\`

**pages/about.json:**
\`\`\`json
{
  "slug": "about",
  "title": "About Us",
  "layout": "default",
  "showTitle": true,
  "status": "published",
  "seo": { "title": "About Us | Site Name", "description": "Learn about our team" }
}
\`\`\`

**partials/header.html:**
\`\`\`html
<header class="bg-gray-900 text-white">
  <nav class="max-w-6xl mx-auto flex items-center justify-between py-4 px-4">
    <a href="/" class="flex items-center gap-2">
      <img src="/images/logo.png" alt="Logo" class="h-8" />
      <span class="text-xl font-bold">Site Name</span>
    </a>
    <div class="flex gap-6">
      <a href="/blog" class="hover:text-blue-300">Blog</a>
      <a href="/about" class="hover:text-blue-300">About</a>
    </div>
  </nav>
</header>
\`\`\`

## Images

Put image files in the \`images/\` folder. Reference them as \`/images/filename\` in HTML.

\`\`\`
images/
├── logo.png              → use as /images/logo.png
├── team.jpg              → use as /images/team.jpg
├── hero-bg.webp          → use as /images/hero-bg.webp
└── icon-mission.png      → use as /images/icon-mission.png
\`\`\`

**In HTML:**
\`\`\`html
<img src="/images/logo.png" alt="Logo" class="h-8" />
<div style="background-image: url('/images/hero-bg.webp')">...</div>
\`\`\`

**What happens on push:**
1. jpg/png/gif/avif → auto-converted to webp (if sharp is installed)
2. Uploaded to CMS (R2)
3. HTML paths auto-rewritten: \`/images/logo.png\` → \`/site-assets/2026/02/logo.webp\`
4. Local files not modified — only the pushed content is rewritten

**Local dev:** \`/images/*\` served directly from local \`images/\` folder.

**Install sharp** for auto webp conversion:
\`\`\`bash
npm install sharp
\`\`\`

Without sharp, images are uploaded as-is (no format conversion).

## Step 4: Preview

\`\`\`bash
node site-dev.cjs dev <siteId>
# → http://localhost:4321
\`\`\`

Tailwind auto-compiles. Images served from local \`images/\`. Browser auto-refreshes.

## Step 5: Push

\`\`\`bash
# Full install (first time)
npm install -g @tailwindcss/cli
npm install sharp          # optional: auto webp conversion

node site-dev.cjs push <siteId>
\`\`\`

Push flow:
1. Images: convert to webp + upload
2. Tailwind: compile pages + partials → CSS + upload
3. Config: update customCss URL
4. HTML: rewrite \`/images/xxx\` → \`/site-assets/.../xxx.webp\`
5. Push: config → meta → partials → pages

## Adding Pages

\`\`\`bash
# Create metadata
cat > sites/<siteId>/pages/services.json << 'EOF'
{
  "slug": "services",
  "title": "Services",
  "layout": "default",
  "showTitle": true,
  "status": "published"
}
EOF

# Create HTML
cat > sites/<siteId>/pages/services.html << 'EOF'
<div class="max-w-5xl mx-auto py-12 px-4">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    <div class="border rounded-xl p-6 hover:shadow-lg transition">
      <h3 class="text-xl font-bold mb-3">Service 1</h3>
      <p class="text-gray-600">Description</p>
    </div>
  </div>
</div>
EOF

# Push
node site-dev.cjs push <siteId>
\`\`\`

## Page Layouts

| Layout | Use For |
|---|---|
| default | Standard page (container + title) |
| full_width | Landing page (no container, no title) |
| landing | Same as full_width |
| blank | Raw HTML (no header/footer) |

Set in .json: \`{ "layout": "full_width", "showTitle": false }\`
`,
  },

  {
    id: "cms-site-pages",
    name: "Update Site Pages",
    description: "Pull existing site, edit pages/partials with Tailwind, preview locally, push.",
    category: "site-management",
    relatedEndpoints: ["/api/config", "/api/pages", "/api/partials/{name}"],
    content: `# Update Site Pages

## Step 1: Find Site

\`\`\`bash
node site-dev.cjs list
node site-dev.cjs list <keyword>    # search
\`\`\`

## Step 2: Pull

\`\`\`bash
node site-dev.cjs pull <siteId>
\`\`\`

Creates:
\`\`\`
sites/<siteId>/
├── config.json
├── meta.json
├── pages/
│   ├── about.json + about.html
│   ├── contact.json + contact.html
│   └── ...
├── partials/
│   ├── header.html
│   └── footer.html
└── images/               # Put new images here
\`\`\`

## Step 3: Edit

### Page HTML (Tailwind classes + images)

\`\`\`html
<!-- pages/about.html -->
<section class="py-16 px-4">
  <div class="max-w-4xl mx-auto">
    <img src="/images/about-hero.jpg" alt="About" class="w-full rounded-xl mb-8" />
    <h2 class="text-4xl font-bold text-gray-900 mb-8">About</h2>
    <div class="prose prose-lg max-w-none">
      <p>Content here...</p>
    </div>
  </div>
</section>
\`\`\`

Images use \`/images/filename\` path — put the file in \`images/\` folder.

### Page Metadata

\`\`\`json
{
  "slug": "about",
  "title": "About",
  "layout": "default",
  "showTitle": false,
  "status": "published",
  "seo": { "title": "About | Site Name", "description": "..." }
}
\`\`\`

### Partials

\`\`\`html
<!-- partials/header.html -->
<header class="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
  <nav class="max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
    <a href="/" class="font-bold text-xl">Site Name</a>
    <div class="flex items-center gap-8">
      <a href="/blog" class="text-gray-600 hover:text-gray-900">Blog</a>
      <a href="/about" class="text-gray-600 hover:text-gray-900">About</a>
    </div>
  </nav>
</header>
\`\`\`

Note: Set \`"header": { "customHtml": true }\` in config.json for custom header to load on the live site.

### Config

\`\`\`json
{
  "nav": [
    { "label": "Home", "href": "/" },
    { "label": "Blog", "href": "/blog" }
  ],
  "header": { "customHtml": true, "sticky": true },
  "footer": { "customHtml": true },
  "seo": { "titleSeparator": " | " }
}
\`\`\`

### Images

Put new images in \`images/\` folder, reference as \`/images/filename\` in HTML:

\`\`\`bash
# Copy images into the site
cp ~/Downloads/hero.jpg sites/<siteId>/images/
cp ~/Downloads/logo.png sites/<siteId>/images/
\`\`\`

In HTML:
\`\`\`html
<img src="/images/hero.jpg" alt="Hero" class="w-full" />
<img src="/images/logo.png" alt="Logo" class="h-10" />
\`\`\`

On push: jpg/png/gif → auto webp conversion + upload. HTML paths auto-rewritten.
Already-uploaded images (\`/site-assets/...\`) are not affected.

## Step 4: Preview

\`\`\`bash
node site-dev.cjs dev <siteId>
# → http://localhost:4321/about
\`\`\`

Tailwind compiles automatically. Images served from local \`images/\`. Browser auto-refreshes.

## Step 5: Push

\`\`\`bash
node site-dev.cjs push <siteId>
\`\`\`

Output:
\`\`\`
Pushing <siteId> (all) → CMS
  images/ (3 → webp, 1 as-is)
  Compiling Tailwind CSS...
  ✓ Tailwind CSS compiled
  css → /site-assets/2026/02/site-styles.css
  config.json
  meta.json
  partials/
  pages/ (5 pages)
Done.
\`\`\`

Push single page (images + CSS still processed):
\`\`\`bash
node site-dev.cjs push <siteId> about
\`\`\`

## Adding a New Page

\`\`\`bash
SITE=<siteId>

cat > sites/\$SITE/pages/faq.json << 'EOF'
{ "slug": "faq", "title": "FAQ", "layout": "default", "showTitle": true, "status": "published" }
EOF

cat > sites/\$SITE/pages/faq.html << 'EOF'
<div class="max-w-3xl mx-auto py-12 px-4 space-y-6">
  <details class="border rounded-lg p-4">
    <summary class="font-semibold cursor-pointer">Question 1?</summary>
    <p class="mt-2 text-gray-600">Answer...</p>
  </details>
  <details class="border rounded-lg p-4">
    <summary class="font-semibold cursor-pointer">Question 2?</summary>
    <p class="mt-2 text-gray-600">Answer...</p>
  </details>
</div>
EOF

node site-dev.cjs push \$SITE
\`\`\`

## Deleting a Page

\`\`\`bash
curl -X DELETE -H "Authorization: Bearer \$CMS_API_KEY" \\
  "\$CMS_BASE_URL/api/pages/<slug>?siteId=<siteId>"
rm sites/<siteId>/pages/<slug>.*
\`\`\`
`,
  },
];

export const SKILLS_MAP = new Map(SKILL_INDEX.map((s) => [s.id, s]));
