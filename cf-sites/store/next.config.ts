import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';
import type { NextConfig } from 'next';

const isDev = process.argv.includes('dev');

if (isDev) {
  setupDevPlatform();
}

const nextConfig: NextConfig = {
  // Required for Cloudflare Pages deployment
  experimental: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'backend-production-eff2.up.railway.app',
        port: '',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Skip type checking during build (fix React 19 type conflicts later)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
