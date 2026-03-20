import path from 'path';
import { fileURLToPath } from 'url';
import createMDX from '@next/mdx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
      { hostname: 'cdn.prod.website-files.com' }, // Webflow CDN (during migration)
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      '@bds/components': path.resolve(__dirname, 'brik-bds/components'),
      '@bds/tokens': path.resolve(__dirname, 'brik-bds/tokens'),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@bds/components': path.resolve(__dirname, 'brik-bds/components'),
      '@bds/tokens': path.resolve(__dirname, 'brik-bds/tokens'),
    };
    return config;
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
