This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Google Search Console (GSC)

The dashboard can show Search Console data (clicks, impressions, top queries) when configured:

1. **Env**: Set `GSC_SERVICE_ACCOUNT_JSON` to the **entire JSON string** of your service account key (the contents of the `.json` key file from Google Cloud).
   - Local: in `cms/.dev.vars` add one line: `GSC_SERVICE_ACCOUNT_JSON={"type":"service_account",...}` (escape quotes if needed).
   - Production: from the `cms` directory run  
     `npm run gsc:secret`  
     (this pipes `config/poised-lens-472416-d2-c0a6b8bf1d7d.json` into `wrangler pages secret put GSC_SERVICE_ACCOUNT_JSON`).  
     Or set it manually in Cloudflare Pages → Settings → Environment variables.

2. **GSC**: For each site property (e.g. `https://test.ai-ball.me/`), open Search Console → Settings → Users and add the service account email (e.g. `gsc-xxx@project.iam.gserviceaccount.com`) with “Full” or “Restrict” permission.

3. The site’s GSC property URL is derived from the site config `url` or the first bound domain.
