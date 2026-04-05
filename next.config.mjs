import path from 'path';
import { fileURLToPath } from 'url';
import createMDX from '@next/mdx';
import { withSentryConfig } from '@sentry/nextjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  images: {
    qualities: [75, 90],
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

export default withSentryConfig(withMDX(nextConfig), {
  // Upload source maps for readable stack traces in Sentry
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress Sentry CLI logs during build
  silent: !process.env.CI,

  // Tunnel events through the app to avoid ad blockers
  tunnelRoute: '/monitoring',

  // Automatically tree-shake Sentry logger in production
  disableLogger: true,
});
