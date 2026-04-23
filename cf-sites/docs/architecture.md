# Architecture: Split Service Design

## Overview

The platform uses a **split-service architecture** with three independent services unified under one domain via an Edge Router Worker.

```
Browser -> Edge Router Worker -> Blog Service (Handlebars + CF Pages)
                              -> Store Service (Next.js + CF Pages)

CMS Admin (separate subdomain) -> R2 + D1
```

## Services

### 1. Blog Service (`blog/`)

- **Technology**: Handlebars templating + Cloudflare Pages Functions
- **Purpose**: Multi-theme blog/CMS content rendering
- **Bindings**: R2 (content), D1 (metadata), KV (cache), Analytics Engine
- **Themes**: `default` and `minimal` in `templates/`
- **Deployment**: `cloudflare-sites` Pages project

### 2. Store Service (`store/`)

- **Technology**: Next.js 15 (App Router) + `@cloudflare/next-on-pages`
- **Purpose**: Ecommerce storefront powered by Medusa backend
- **Bindings**: KV (cache), Queue (events), Edge Services (DO), Analytics Engine
- **Key pages**: Product listing, product detail, cart, checkout, account
- **Deployment**: `cloudflare-store` Pages project

### 3. CMS Admin (`cms/`)

- **Technology**: Next.js 15 + `@cloudflare/next-on-pages`
- **Purpose**: Content management dashboard
- **Bindings**: R2, D1, Queue (cache invalidation)
- **Deployment**: `cloudflare-sites-cms` Pages project
- **Domain**: `cms.example.com`

## Edge Infrastructure (`workers/`)

### Edge Router (`workers/router/`)

Path-based request routing Worker. Routes `/store`, `/products`, `/cart`, `/checkout`, `/account` to the Store service; everything else to the Blog service.

### Edge Services (`workers/edge-services/`)

Hosts Durable Objects and Queue Consumer:

- **CartSessionDO**: Strongly consistent cart state (SQLite-backed, 24h abandon alarm)
- **InventoryHoldDO**: 5-minute inventory reservation during checkout
- **RateLimiterDO**: Sliding window rate limiting
- **Queue Consumer**: Processes cache invalidation, analytics, notifications

## Shared Resources (`shared/`)

- `schema.sql`: D1 database schema
- `styles/tokens.css`: Design token CSS variables shared between blog and store

## Data Flow

### Content Publishing
```
CMS -> R2 + D1 -> Queue (cache-invalidate) -> Queue Consumer -> KV delete
```

### Blog Page Request
```
Browser -> Router -> Blog -> KV cache hit? -> Return cached
                          -> KV miss -> R2/D1 -> Render -> KV put -> Return
```

### Store Page Request
```
Browser -> Router -> Store (SSR) -> KV cache hit? -> Return cached
                                 -> KV miss -> Medusa API -> KV put -> Return
```

### Cart Flow
```
Store Client -> /api/cart -> Edge Services -> CartSessionDO
                          -> Set cookie (cart_count) for blog badge sync
```

## Deployment Order

1. Create KV namespace + Queue
2. Deploy `workers/edge-services/`
3. Deploy `blog/`
4. Deploy `store/`
5. Deploy `workers/router/`
6. Bind Router Worker to domain
