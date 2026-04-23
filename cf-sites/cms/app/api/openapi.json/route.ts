
import { jsonResponse } from '@/lib/api-utils';

export const runtime = 'edge';

const R = (desc: string) => ({ "200": { description: desc } });
const J = (desc: string, schema: object) => ({
  "200": { description: desc, content: { "application/json": { schema } } },
});
const Err = {
  "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "400": { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "409": { description: "Conflict (already exists)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
};

const siteIdQ = { name: "siteId", in: "query", required: true, schema: { type: "string" }, description: "Site identifier" } as const;
const siteIdP = { name: "siteId", in: "path", required: true, schema: { type: "string" } } as const;

export async function GET() {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Cloudflare Sites CMS API",
      version: "2.1.0",
      description: "Multi-site CMS on Cloudflare (R2 + D1 + Workers). Manage sites, posts, pages, assets, config, meta, store content, products, and orders.\n\n**Auth:** All endpoints require `Authorization: Bearer <API_KEY>` except those tagged `Discovery` and `GET /api/site-assets`.\n\n**Pattern:** Most endpoints are scoped via `?siteId=<id>` query parameter.\n\n**Discovery:** Start with `GET /api/skills` to list capabilities, then `GET /api/skills/{id}` for detailed guides.",
    },
    servers: [{ url: "/", description: "Current CMS instance" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API_KEY set in cms/.dev.vars (local) or Cloudflare Secrets (production)" },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string", description: "Error message" } },
          example: { error: "Missing siteId" },
        },
        SuccessResult: {
          type: "object",
          properties: { success: { type: "boolean" } },
        },
        SeoConfig: {
          type: "object",
          properties: {
            title: { type: "string", description: "Custom meta title" },
            description: { type: "string", description: "Custom meta description" },
            canonical: { type: "string", description: "Canonical URL" },
            ogImage: { type: "string", description: "Open Graph image URL" },
            noindex: { type: "boolean", description: "Prevent indexing" },
          },
        },
        NavItem: {
          type: "object",
          required: ["label", "href"],
          properties: { label: { type: "string" }, href: { type: "string" } },
          example: { label: "Blog", href: "/blog" },
        },
        HeaderConfig: {
          type: "object",
          properties: {
            logo: { type: "string", description: "Logo image URL" },
            logoText: { type: "string", description: "Logo text (overrides site.name)" },
            showNav: { type: "boolean", description: "Show navigation (default: true)" },
            sticky: { type: "boolean", description: "Sticky header (default: true)" },
            transparent: { type: "boolean", description: "Transparent header for hero pages" },
            customHtml: { type: "boolean", description: "Load custom header from R2 partials/header.html" },
          },
        },
        FooterConfig: {
          type: "object",
          properties: {
            copyright: { type: "string", description: "Custom copyright text (supports {{year}}, {{name}})" },
            showPoweredBy: { type: "boolean" },
            links: { type: "array", items: { $ref: "#/components/schemas/NavItem" } },
            social: { type: "array", items: { $ref: "#/components/schemas/SocialLink" } },
            customHtml: { type: "boolean", description: "Load custom footer from R2 partials/footer.html" },
          },
        },
        SocialLink: {
          type: "object",
          properties: {
            platform: { type: "string", description: "e.g. github, twitter, email" },
            url: { type: "string" },
            label: { type: "string" },
          },
        },
        RouteMapping: {
          type: "object",
          description: "URL prefix overrides for blog routes",
          properties: {
            blog: { type: "string", description: "Blog listing prefix (default: 'blog')" },
            post: { type: "string", description: "Post prefix (default: 'blog'); set to '' for /{slug}" },
            category: { type: "string", description: "Default: 'category'" },
            tag: { type: "string", description: "Default: 'tag'" },
            author: { type: "string", description: "Default: 'author'" },
          },
        },
        HomeConfig: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            heroImage: { type: "string" },
            showCategories: { type: "boolean" },
            showTags: { type: "boolean" },
            showStats: { type: "boolean" },
          },
        },
        BlogConfig: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            coverImage: { type: "string" },
            postsLayout: { type: "string", enum: ["grid", "list"] },
            featuredCount: { type: "integer" },
            showFeatured: { type: "boolean" },
          },
        },
        DefaultImages: {
          type: "object",
          properties: {
            post: { type: "string" },
            category: { type: "string" },
            tag: { type: "string" },
            collection: { type: "string" },
            author: { type: "string" },
          },
        },
        SiteConfig: {
          type: "object",
          properties: {
            name: { type: "string" },
            displayName: { type: "string" },
            description: { type: "string" },
            language: { type: "string" },
            url: { type: "string" },
            theme: { type: "string", enum: ["default", "minimal"] },
            postsPerPage: { type: "integer" },
            customCss: { type: "string", description: "URL to custom CSS file (uploaded via /api/assets)" },
            customJs: { type: "string", description: "URL to custom JS file" },
            favicon: { type: "string" },
            nav: { type: "array", items: { $ref: "#/components/schemas/NavItem" } },
            routes: { $ref: "#/components/schemas/RouteMapping" },
            header: { $ref: "#/components/schemas/HeaderConfig" },
            footer: { $ref: "#/components/schemas/FooterConfig" },
            social: { type: "array", items: { $ref: "#/components/schemas/SocialLink" } },
            home: { $ref: "#/components/schemas/HomeConfig" },
            blog: { $ref: "#/components/schemas/BlogConfig" },
            defaults: { $ref: "#/components/schemas/DefaultImages" },
            labels: { type: "object", description: "Custom i18n label overrides", additionalProperties: { type: "string" } },
            seo: {
              type: "object",
              properties: {
                googleVerification: { type: "string" },
                bingVerification: { type: "string" },
                titleSeparator: { type: "string" },
                defaultOgImage: { type: "string" },
                twitterHandle: { type: "string" },
                robotsExtra: { type: "string", description: "Additional robots.txt rules" },
              },
            },
          },
        },
        PostSummary: {
          type: "object",
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string" },
            coverImage: { type: "string" },
            author: { type: "string" },
            categories: { type: "array", items: { type: "string" }, description: "Category slugs" },
            tags: { type: "array", items: { type: "string" }, description: "Tag slugs" },
            collection: { type: "string" },
            publishedAt: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["published", "draft", "archived"] },
            seo: { $ref: "#/components/schemas/SeoConfig" },
          },
        },
        Post: {
          allOf: [
            { $ref: "#/components/schemas/PostSummary" },
            { type: "object", properties: { content: { type: "string", description: "HTML content. External images are auto-downloaded to R2." }, updatedAt: { type: "string", format: "date-time" } } },
          ],
        },
        Page: {
          allOf: [
            { $ref: "#/components/schemas/PostSummary" },
            { type: "object", properties: { content: { type: "string" }, updatedAt: { type: "string", format: "date-time" }, layout: { type: "string", enum: ["default", "full_width", "wide", "withheader", "landing", "blank"] }, showTitle: { type: "boolean" }, showHeader: { type: "boolean" }, showFooter: { type: "boolean" }, containerClass: { type: "string" }, customCss: { type: "string" } } },
          ],
        },
        StoreConfig: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            medusaSalesChannelId: { type: "string" },
            medusaPublishableKey: { type: "string" },
            paymentMethods: { type: "object", properties: { cod: { type: "object", properties: { enabled: { type: "boolean" }, label: { type: "string" } } }, stripe: { type: "object", properties: { enabled: { type: "boolean" }, publishableKey: { type: "string" } } } } },
            checkout: { type: "object", properties: { guestCheckout: { type: "boolean" } } },
          },
        },
        StoreContent: {
          type: "object",
          properties: {
            id: { type: "string" }, type: { type: "string", enum: ["banner", "promo"] }, title: { type: "string" }, subtitle: { type: "string" },
            link: { type: "string" }, imageUrl: { type: "string" }, startAt: { type: "string", format: "date-time" }, endAt: { type: "string", format: "date-time" },
            sortOrder: { type: "integer" }, status: { type: "string", enum: ["active", "draft"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "string" }, title: { type: "string" }, handle: { type: "string" }, description: { type: "string" }, thumbnail: { type: "string" },
            variants: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, price: { type: "number" }, inventory_quantity: { type: "number" } } } },
          },
        },
        MetaData: {
          type: "object",
          properties: {
            authors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, bio: { type: "string" }, avatar: { type: "string" }, count: { type: "number" } } } },
            categories: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" }, description: { type: "string" }, featuredImage: { type: "string" }, count: { type: "number" } } } },
            tags: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" }, description: { type: "string" }, count: { type: "number" } } } },
          },
        },
        AssetInfo: {
          type: "object",
          properties: {
            key: { type: "string" }, size: { type: "integer" }, uploaded: { type: "string", format: "date-time" },
            url: { type: "string", description: "CMS proxy URL" }, publicUrl: { type: "string", description: "Public URL on blog (/site-assets/...)" },
          },
        },
        SiteSummary: {
          type: "object",
          properties: {
            siteId: { type: "string" }, name: { type: "string" }, displayName: { type: "string" },
            description: { type: "string" }, language: { type: "string" }, url: { type: "string" },
            theme: { type: "string" }, domains: { type: "array", items: { type: "string" } }, disabled: { type: "boolean" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      // ── Auth ───────────────────────────────────────────────
      "/api/auth/verify": {
        post: {
          operationId: "verifyAuth",
          tags: ["Auth"],
          summary: "Verify API key and get auth cookie",
          description: "Validates the API key and sets an httpOnly auth cookie. Use as a health-check to confirm your API key works.",
          security: [],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["apiKey"], properties: { apiKey: { type: "string", description: "Your API_KEY" } } }, example: { apiKey: "your-api-key" } } },
          },
          responses: {
            ...J("Auth valid", { type: "object", properties: { ok: { type: "boolean" } }, example: { ok: true } }),
            "401": Err["401"],
          },
        },
      },

      // ── Sites ──────────────────────────────────────────────
      "/api/sites": {
        get: {
          operationId: "listSites",
          tags: ["Sites"],
          summary: "List all sites or lookup by domain",
          description: "Without params: returns all sites with config summaries and domain mappings. With ?domain=xxx: returns the config for that domain.",
          parameters: [{ name: "domain", in: "query", schema: { type: "string" }, description: "Lookup by domain (e.g. example.com)" }],
          responses: {
            ...J("Site list", { type: "object", properties: { sites: { type: "array", items: { $ref: "#/components/schemas/SiteSummary" } } }, example: { sites: [{ siteId: "my-blog", name: "My Blog", domains: ["blog.example.com"], theme: "default" }] } }),
            "401": Err["401"],
          },
        },
        post: {
          operationId: "createSite",
          tags: ["Sites"],
          summary: "Create a new site",
          description: "Creates config.json, empty post index, and empty meta files in R2. Optionally binds a domain. **Idempotency:** returns 409 if siteId already exists.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["siteId"], properties: { siteId: { type: "string", description: "Unique site ID (lowercase alphanumeric, hyphens, dots)" }, name: { type: "string" }, displayName: { type: "string" }, description: { type: "string" }, language: { type: "string", default: "zh-CN" }, theme: { type: "string", enum: ["default", "minimal"], default: "default" }, domain: { type: "string", description: "Optional: bind domain on creation" } } }, example: { siteId: "my-blog", name: "My Blog", language: "en", theme: "default", domain: "blog.example.com" } } },
          },
          responses: {
            "201": { description: "Site created", content: { "application/json": { schema: { type: "object", properties: { siteId: { type: "string" }, created: { type: "boolean" }, domainBinding: { type: "object" } } }, example: { siteId: "my-blog", created: true } } } },
            "400": Err["400"], "401": Err["401"], "409": Err["409"],
          },
        },
      },
      "/api/sites/{siteId}/domains": {
        get: {
          operationId: "listDomains",
          tags: ["Sites"],
          summary: "List domains for a site",
          parameters: [siteIdP],
          responses: { ...J("Domain list", { type: "object", properties: { siteId: { type: "string" }, domains: { type: "array", items: { type: "string" } } }, example: { siteId: "my-blog", domains: ["blog.example.com"] } }), "401": Err["401"] },
        },
        post: {
          operationId: "bindDomain",
          tags: ["Sites"],
          summary: "Bind a domain to a site",
          description: "Creates DNS record + Workers Routes + domain map. Without CF_API_TOKEN: only updates domain map (manual DNS needed).",
          parameters: [siteIdP],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["domain"], properties: { domain: { type: "string" } } }, example: { domain: "blog.example.com" } } } },
          responses: { ...J("Domain bound", { type: "object", properties: { siteId: { type: "string" }, domain: { type: "string" }, bound: { type: "boolean" } } }), "400": Err["400"], "401": Err["401"], "409": Err["409"] },
        },
        delete: {
          operationId: "unbindDomain",
          tags: ["Sites"],
          summary: "Unbind a domain from a site",
          description: "At least one domain must remain on the site.",
          parameters: [siteIdP],
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["domain"], properties: { domain: { type: "string" } } } } } },
          responses: { ...J("Domain unbound", { type: "object", properties: { siteId: { type: "string" }, domain: { type: "string" }, unbound: { type: "boolean" } } }), "400": Err["400"], "401": Err["401"] },
        },
      },
      "/api/sites/{siteId}/rename": {
        post: {
          operationId: "renameSite",
          tags: ["Sites"],
          summary: "Rename a site",
          description: "Lightweight rename via contentSourceId pointer. No bulk file copy.",
          parameters: [siteIdP],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["newSiteId"], properties: { newSiteId: { type: "string" } } }, example: { newSiteId: "new-blog" } } } },
          responses: { ...J("Site renamed", { type: "object", properties: { success: { type: "boolean" }, oldSiteId: { type: "string" }, newSiteId: { type: "string" } } }), "400": Err["400"], "401": Err["401"], "404": Err["404"] },
        },
      },

      // ── Config ─────────────────────────────────────────────
      "/api/config": {
        get: {
          operationId: "getConfig",
          tags: ["Config"],
          summary: "Get site configuration",
          parameters: [siteIdQ],
          responses: { ...J("Site config", { type: "object", properties: { config: { $ref: "#/components/schemas/SiteConfig" }, siteBaseUrl: { type: "string" } } }), "401": Err["401"] },
        },
        put: {
          operationId: "updateConfig",
          tags: ["Config"],
          summary: "Update site configuration (merge)",
          description: "Merges provided fields into existing config. Omitted fields are preserved.",
          parameters: [siteIdQ],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/SiteConfig" }, example: { nav: [{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }], seo: { titleSeparator: " | " }, header: { logo: "/site-assets/2026/02/logo.webp", sticky: true } } } } },
          responses: { ...J("Updated config", { type: "object", properties: { success: { type: "boolean" }, config: { $ref: "#/components/schemas/SiteConfig" } } }), "400": Err["400"], "401": Err["401"] },
        },
      },
      "/api/settings": {
        get: { operationId: "getStoreSettings", tags: ["Config"], summary: "Get store settings", parameters: [siteIdQ], responses: { ...J("Store settings", { type: "object", properties: { store: { $ref: "#/components/schemas/StoreConfig" } } }), "401": Err["401"] } },
        post: { operationId: "updateStoreSettings", tags: ["Config"], summary: "Update store settings", parameters: [siteIdQ], requestBody: { content: { "application/json": { schema: { type: "object", properties: { store: { $ref: "#/components/schemas/StoreConfig" } } } } } }, responses: { ...R("Updated"), "401": Err["401"] } },
      },
      "/api/global-settings": {
        get: { operationId: "getGlobalSettings", tags: ["Config"], summary: "Get platform-level global settings", responses: { ...R("Global settings"), "401": Err["401"] } },
        put: { operationId: "updateGlobalSettings", tags: ["Config"], summary: "Update platform-level global settings", requestBody: { content: { "application/json": { schema: { type: "object", description: "Partial PlatformSettings to merge" } } } }, responses: { ...R("Updated"), "401": Err["401"] } },
      },
      "/api/partials/{name}": {
        get: {
          operationId: "getPartial",
          tags: ["Config"],
          summary: "Get partial HTML (header/footer)",
          parameters: [{ name: "name", in: "path", required: true, schema: { type: "string", enum: ["header", "footer"] } }, siteIdQ],
          responses: { ...J("HTML content", { type: "object", properties: { content: { type: "string" } } }), "401": Err["401"] },
        },
        put: {
          operationId: "updatePartial",
          tags: ["Config"],
          summary: "Update partial HTML (header/footer)",
          description: "Enable customHtml in config header/footer first, then upload HTML here.",
          parameters: [{ name: "name", in: "path", required: true, schema: { type: "string", enum: ["header", "footer"] } }, siteIdQ],
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["content"], properties: { content: { type: "string", description: "Raw HTML" } } }, example: { content: "<header class=\"custom\"><nav>...</nav></header>" } } } },
          responses: { ...J("Updated", { type: "object", properties: { success: { type: "boolean" }, key: { type: "string" } } }), "400": Err["400"], "401": Err["401"] },
        },
      },

      // ── Assets ─────────────────────────────────────────────
      "/api/assets": {
        get: {
          operationId: "listAssets",
          tags: ["Assets"],
          summary: "List assets",
          parameters: [siteIdQ],
          responses: { ...J("Asset list", { type: "object", properties: { assets: { type: "array", items: { $ref: "#/components/schemas/AssetInfo" } } } }), "401": Err["401"] },
        },
        post: {
          operationId: "uploadAsset",
          tags: ["Assets"],
          summary: "Upload a file (image, CSS, JS)",
          description: "Uploads to R2 at sites/{siteId}/assets/YYYY/MM/{filename}. **Best practice:** use webp for all images. Returns publicUrl for use in content/config.",
          parameters: [siteIdQ, { name: "overwrite", in: "query", schema: { type: "string", enum: ["true", "false"], default: "true" }, description: "'false' to skip if file exists" }],
          requestBody: { content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" }, filename: { type: "string", description: "Override filename" } } } } } },
          responses: { ...J("Uploaded", { type: "object", properties: { success: { type: "boolean" }, key: { type: "string", description: "R2 key" }, url: { type: "string", description: "CMS proxy URL" }, publicUrl: { type: "string", description: "Public blog URL (/site-assets/...)" }, existing: { type: "boolean", description: "true if file existed and overwrite=false" } }, example: { success: true, key: "sites/my-blog/assets/2026/02/logo.webp", publicUrl: "/site-assets/2026/02/logo.webp" } }), "400": Err["400"], "401": Err["401"] },
        },
        delete: {
          operationId: "deleteAsset",
          tags: ["Assets"],
          summary: "Delete an asset",
          parameters: [siteIdQ, { name: "key", in: "query", required: true, schema: { type: "string" }, description: "Full R2 key" }],
          responses: { ...J("Deleted", { $ref: "#/components/schemas/SuccessResult" }), "400": Err["400"], "401": Err["401"] },
        },
      },
      "/api/site-assets": {
        get: {
          operationId: "serveSiteAsset",
          tags: ["Assets"],
          summary: "Serve a site asset (no auth)",
          description: "Public endpoint serving assets from R2. Used by CMS editor preview and blog /site-assets/* path.",
          security: [],
          parameters: [siteIdQ, { name: "path", in: "query", required: true, schema: { type: "string" }, description: "Asset path, e.g. 2026/02/image.webp" }],
          responses: { "200": { description: "Binary file with correct content-type" }, "404": Err["404"] },
        },
      },

      // ── Posts ──────────────────────────────────────────────
      "/api/posts": {
        get: {
          operationId: "listPosts",
          tags: ["Posts"],
          summary: "List posts (paginated)",
          parameters: [siteIdQ, { name: "page", in: "query", schema: { type: "integer", default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", default: 20 } }, { name: "search", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["published", "draft", "archived", "all"], default: "all" } }],
          responses: { ...J("Post list", { type: "object", properties: { posts: { type: "array", items: { $ref: "#/components/schemas/PostSummary" } }, total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } } }), "401": Err["401"] },
        },
        post: {
          operationId: "createPost",
          tags: ["Posts"],
          summary: "Create a new post",
          description: "External images in content are auto-downloaded to R2. **Idempotency:** creating with an existing slug overwrites the post (upsert).",
          parameters: [siteIdQ],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "slug"], properties: { title: { type: "string" }, slug: { type: "string" }, content: { type: "string", description: "HTML content. External image URLs are auto-downloaded." }, excerpt: { type: "string" }, coverImage: { type: "string" }, author: { type: "string" }, categories: { type: "array", items: { type: "string" } }, tags: { type: "array", items: { type: "string" } }, collection: { type: "string" }, status: { type: "string", enum: ["published", "draft"], default: "draft" }, publishedAt: { type: "string", format: "date-time" }, seo: { $ref: "#/components/schemas/SeoConfig" } } }, example: { title: "Hello World", slug: "hello-world", content: "<p>Welcome!</p>", author: "admin", categories: ["tech"], status: "published", publishedAt: "2026-02-25T00:00:00Z" } } } },
          responses: { ...J("Created", { type: "object", properties: { success: { type: "boolean" }, slug: { type: "string" } } }), "400": Err["400"], "401": Err["401"] },
        },
      },
      "/api/posts/{slug}": {
        get: {
          operationId: "getPost",
          tags: ["Posts"],
          summary: "Get a single post (with content)",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          responses: { ...J("Post", { type: "object", properties: { post: { $ref: "#/components/schemas/Post" } } }), "401": Err["401"], "404": Err["404"] },
        },
        put: {
          operationId: "updatePost",
          tags: ["Posts"],
          summary: "Update a post (partial merge)",
          description: "Only provided fields are changed. External images auto-downloaded.",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, excerpt: { type: "string" }, coverImage: { type: "string" }, author: { type: "string" }, categories: { type: "array", items: { type: "string" } }, tags: { type: "array", items: { type: "string" } }, collection: { type: "string" }, status: { type: "string", enum: ["published", "draft", "archived"] }, publishedAt: { type: "string", format: "date-time" }, seo: { $ref: "#/components/schemas/SeoConfig" } } } } } },
          responses: { ...J("Updated", { type: "object", properties: { success: { type: "boolean" }, slug: { type: "string" } } }), "400": Err["400"], "401": Err["401"], "404": Err["404"] },
        },
        delete: {
          operationId: "deletePost",
          tags: ["Posts"],
          summary: "Delete a post",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          responses: { ...J("Deleted", { $ref: "#/components/schemas/SuccessResult" }), "401": Err["401"] },
        },
      },

      // ── Pages ──────────────────────────────────────────────
      "/api/pages": {
        get: {
          operationId: "listPages",
          tags: ["Pages"],
          summary: "List pages (paginated)",
          parameters: [siteIdQ, { name: "page", in: "query", schema: { type: "integer", default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", default: 20 } }, { name: "search", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["published", "draft", "archived", "all"], default: "all" } }],
          responses: { ...J("Page list", { type: "object", properties: { pages: { type: "array", items: { $ref: "#/components/schemas/Page" } }, total: { type: "integer" }, page: { type: "integer" }, limit: { type: "integer" } } }), "401": Err["401"] },
        },
        post: {
          operationId: "createPage",
          tags: ["Pages"],
          summary: "Create a new page",
          description: "Creates a page (type=page). External images auto-downloaded. **Idempotency:** creating with an existing slug overwrites (upsert).",
          parameters: [siteIdQ],
          requestBody: { content: { "application/json": { schema: { type: "object", required: ["title", "slug"], properties: { title: { type: "string" }, slug: { type: "string" }, content: { type: "string" }, excerpt: { type: "string" }, layout: { type: "string", enum: ["default", "full_width", "wide", "withheader", "landing", "blank"] }, showTitle: { type: "boolean", default: true }, showHeader: { type: "boolean", default: true }, showFooter: { type: "boolean", default: true }, containerClass: { type: "string" }, customCss: { type: "string" }, status: { type: "string", enum: ["published", "draft"], default: "draft" }, seo: { $ref: "#/components/schemas/SeoConfig" } } }, example: { title: "About", slug: "about", content: "<p>About us</p>", layout: "default", showTitle: true, status: "published" } } } },
          responses: { ...J("Created", { type: "object", properties: { success: { type: "boolean" }, slug: { type: "string" } } }), "400": Err["400"], "401": Err["401"] },
        },
      },
      "/api/pages/{slug}": {
        get: {
          operationId: "getPage",
          tags: ["Pages"],
          summary: "Get a single page (with content)",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          responses: { ...J("Page", { type: "object", properties: { post: { $ref: "#/components/schemas/Page" } } }), "401": Err["401"], "404": Err["404"] },
        },
        put: {
          operationId: "updatePage",
          tags: ["Pages"],
          summary: "Update a page (partial merge)",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, excerpt: { type: "string" }, layout: { type: "string", enum: ["default", "full_width", "wide", "withheader", "landing", "blank"] }, showTitle: { type: "boolean" }, showHeader: { type: "boolean" }, showFooter: { type: "boolean" }, containerClass: { type: "string" }, customCss: { type: "string" }, status: { type: "string", enum: ["published", "draft", "archived"] }, seo: { $ref: "#/components/schemas/SeoConfig" } } } } } },
          responses: { ...J("Updated", { type: "object", properties: { success: { type: "boolean" }, slug: { type: "string" } } }), "400": Err["400"], "401": Err["401"], "404": Err["404"] },
        },
        delete: {
          operationId: "deletePage",
          tags: ["Pages"],
          summary: "Delete a page",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, siteIdQ],
          responses: { ...J("Deleted", { $ref: "#/components/schemas/SuccessResult" }), "401": Err["401"] },
        },
      },

      // ── Meta ───────────────────────────────────────────────
      "/api/meta": {
        get: {
          operationId: "getMeta",
          tags: ["Meta"],
          summary: "Get site meta (authors, categories, tags)",
          description: "With withCounts=true, categories and tags include postCount from D1.",
          parameters: [siteIdQ, { name: "withCounts", in: "query", required: false, schema: { type: "string", enum: ["true", "false"] }, description: "Include postCount per category/tag from D1" }],
          responses: { ...J("Meta data", { $ref: "#/components/schemas/MetaData" }), "401": Err["401"] },
        },
        post: {
          operationId: "updateMeta",
          tags: ["Meta"],
          summary: "Update site meta (authors, categories, tags)",
          description: "Replaces entire arrays for provided fields. Omitted arrays are untouched.",
          parameters: [siteIdQ],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/MetaData" }, example: { authors: [{ id: "admin", name: "Admin", count: 0 }], categories: [{ slug: "tech", name: "Tech", description: "", count: 0 }] } } } },
          responses: { ...R("Meta updated"), "401": Err["401"] },
        },
      },
      "/api/meta/count": {
        get: {
          operationId: "getMetaCount",
          tags: ["Meta"],
          summary: "Get post and page count",
          parameters: [siteIdQ],
          responses: { ...J("Counts", { type: "object", properties: { posts: { type: "integer" }, pages: { type: "integer" } }, example: { posts: 42, pages: 5 } }), "401": Err["401"] },
        },
      },
      "/api/meta/categories-cleanup": {
        post: {
          operationId: "categoriesCleanup",
          tags: ["Meta"],
          summary: "Remove categories and reassign posts",
          description: "Remove given category slugs from meta and reassign their posts in D1 to mergeInto (default: uncategorized). For subagent/AI-driven cleanup of unreasonable or unused categories.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["siteId", "removeSlugs"],
                  properties: {
                    siteId: { type: "string" },
                    removeSlugs: { type: "array", items: { type: "string" } },
                    mergeInto: { type: "string", description: "Target category slug; default uncategorized" },
                  },
                },
              },
            },
          },
          responses: { ...J("Cleanup result", { type: "object", properties: { success: { type: "boolean" }, removed: { type: "integer" }, keptCount: { type: "integer" }, d1Updated: { type: "integer" }, mergeInto: { type: "string" }, message: { type: "string" } } }), "401": Err["401"] },
        },
      },
      "/api/taxonomies": {
        get: {
          operationId: "listTaxonomies",
          tags: ["Meta"],
          summary: "List taxonomies (categories or tags)",
          parameters: [siteIdQ, { name: "type", in: "query", required: true, schema: { type: "string", enum: ["category", "tag"] } }],
          responses: { ...R("Taxonomy values"), "401": Err["401"] },
        },
      },
      "/api/authors": {
        get: {
          operationId: "listAuthors",
          tags: ["Meta"],
          summary: "List authors",
          parameters: [siteIdQ],
          responses: { ...R("Author list"), "401": Err["401"] },
        },
      },

      // ── Operations ─────────────────────────────────────────
      "/api/rebuild": {
        post: {
          operationId: "rebuildIndex",
          tags: ["Operations"],
          summary: "Rebuild D1 index from R2 content",
          description: "Scans all posts and pages in R2 and re-indexes into D1. Use after bulk imports.",
          parameters: [siteIdQ],
          responses: { ...J("Rebuild result", { type: "object", properties: { success: { type: "boolean" }, scanned: { type: "integer" }, indexed: { type: "integer" }, errors: { type: "array", items: { type: "object" } } }, example: { success: true, scanned: 150, indexed: 148, errors: [] } }), "401": Err["401"] },
        },
      },
      "/api/analytics": {
        get: {
          operationId: "getAnalytics",
          tags: ["Operations"],
          summary: "Get site analytics",
          description: "Fetches traffic analytics from Cloudflare for the site's domains.",
          parameters: [siteIdQ, { name: "range", in: "query", schema: { type: "string", default: "7d", description: "1d, 7d, 30d" } }],
          responses: { ...R("Analytics data"), "401": Err["401"] },
        },
      },

      // ── Store Content ──────────────────────────────────────
      "/api/store-content": {
        get: { operationId: "listStoreContent", tags: ["Store Content"], summary: "List banners and promos", parameters: [siteIdQ, { name: "status", in: "query", schema: { type: "string", enum: ["active", "draft"] } }], responses: { ...J("Store content list", { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/StoreContent" } } } }), "401": Err["401"] } },
        post: { operationId: "createStoreContent", tags: ["Store Content"], summary: "Create store content", parameters: [siteIdQ], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/StoreContent" } } } }, responses: { ...R("Created"), "401": Err["401"] } },
      },
      "/api/store-content/{id}": {
        get: { operationId: "getStoreContent", tags: ["Store Content"], summary: "Get a store content item", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, siteIdQ], responses: { ...J("Item", { $ref: "#/components/schemas/StoreContent" }), "401": Err["401"], "404": Err["404"] } },
        put: { operationId: "updateStoreContent", tags: ["Store Content"], summary: "Update a store content item", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, siteIdQ], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/StoreContent" } } } }, responses: { ...J("Updated", { $ref: "#/components/schemas/SuccessResult" }), "401": Err["401"] } },
        delete: { operationId: "deleteStoreContent", tags: ["Store Content"], summary: "Delete a store content item", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, siteIdQ], responses: { ...J("Deleted", { $ref: "#/components/schemas/SuccessResult" }), "401": Err["401"] } },
      },

      // ── Products ───────────────────────────────────────────
      "/api/products": {
        get: { operationId: "listProducts", tags: ["Products"], summary: "List products (Medusa)", parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 20 } }, { name: "offset", in: "query", schema: { type: "integer", default: 0 } }, { name: "q", in: "query", schema: { type: "string" } }], responses: { ...R("Product list"), "401": Err["401"] } },
        post: { operationId: "createProduct", tags: ["Products"], summary: "Create product (Medusa)", requestBody: { content: { "application/json": { schema: { type: "object", required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, options: { type: "array", items: { type: "object" } }, variants: { type: "array", items: { type: "object" } } } } } } }, responses: { ...R("Created"), "401": Err["401"] } },
      },
      "/api/products/{id}": {
        get: { operationId: "getProduct", tags: ["Products"], summary: "Get a product", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { ...J("Product", { $ref: "#/components/schemas/Product" }), "401": Err["401"] } },
        post: { operationId: "updateProduct", tags: ["Products"], summary: "Update a product", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { ...R("Updated"), "401": Err["401"] } },
        delete: { operationId: "deleteProduct", tags: ["Products"], summary: "Delete a product", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { ...J("Deleted", { $ref: "#/components/schemas/SuccessResult" }), "401": Err["401"] } },
      },

      // ── Orders ─────────────────────────────────────────────
      "/api/orders": {
        get: { operationId: "listOrders", tags: ["Orders"], summary: "List orders (Medusa)", parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 20 } }, { name: "offset", in: "query", schema: { type: "integer", default: 0 } }, { name: "status", in: "query", schema: { type: "string" } }, { name: "payment_status", in: "query", schema: { type: "string" } }, { name: "fulfillment_status", in: "query", schema: { type: "string" } }], responses: { ...R("Order list"), "401": Err["401"] } },
      },
      "/api/orders/{id}": {
        get: { operationId: "getOrder", tags: ["Orders"], summary: "Get a single order", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { ...R("Order details"), "401": Err["401"] } },
        post: { operationId: "orderAction", tags: ["Orders"], summary: "Perform order action", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { action: { type: "string", description: "fulfill, cancel, etc." } } } } } }, responses: { ...R("Action result"), "401": Err["401"] } },
      },

      // ── Discovery (no auth) ────────────────────────────────
      "/api/openapi.json": {
        get: { operationId: "getOpenApiSpec", tags: ["Discovery"], summary: "OpenAPI 3.0 specification", security: [], responses: R("OpenAPI JSON") },
      },
      "/api/skills": {
        get: {
          operationId: "listSkills",
          tags: ["Discovery"],
          summary: "Skills & tools guide (text/markdown with YAML frontmatter)",
          description: "Returns a Markdown document: quick start, tool download URL, skill list with links, and API reference. No auth required. Entry point for agents.",
          security: [],
          responses: {
            "200": { description: "Markdown guide with YAML frontmatter (title, tool URL, openapi URL, auth)", content: { "text/markdown": { schema: { type: "string" } } } },
          },
        },
      },
      "/api/skills/{id}": {
        get: {
          operationId: "getSkill",
          tags: ["Discovery"],
          summary: "Get a single skill guide (text/markdown with YAML frontmatter)",
          description: "Returns a Markdown document with YAML frontmatter containing metadata (id, name, description, category, endpoints). No auth required.",
          security: [],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Skill ID: cms-guide, cms-site-new, cms-site-pages" }],
          responses: {
            "200": { description: "Markdown with YAML frontmatter", content: { "text/markdown": { schema: { type: "string" } } } },
            "404": Err["404"],
          },
        },
      },
    },
  };

  return jsonResponse(spec);
}
