import createMDX from '@next/mdx';
import { withSentryConfig } from '@sentry/nextjs';

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
    const baseHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];

    // Block crawlers on every non-production deploy. NEXT_PUBLIC_ENV is
    // set by netlify.toml: production=production, branch-deploy=staging,
    // deploy-preview=preview. Netlify's per-context [[headers]] blocks are
    // silently ignored, so we set this from Next.js where env is reliable.
    if (process.env.NEXT_PUBLIC_ENV !== 'production') {
      baseHeaders.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    }

    return [{ source: '/:path*', headers: baseHeaders }];
  },
  // Webflow → Netlify URL migration. All 301 (permanent) so Google
  // transfers link equity. See `docs/cutover-redirects.md` for the source
  // of truth and how to add a new mapping.
  async redirects() {
    return [
      // ── Customer story singular → plural
      { source: '/customer-story/:slug', destination: '/customer-stories/:slug', permanent: true },

      // ── /industries/:slug → /customers/:slug (canonical route)
      { source: '/industries/:slug', destination: '/customers/:slug', permanent: true },

      // ── Pricing alias → plans
      { source: '/pricing', destination: '/plans', permanent: true },

      // ── Brikdown analysis renamed → free marketing analysis
      { source: '/brikdown-analysis', destination: '/free-marketing-analysis', permanent: true },

      // ── Webflow "support" landing pages → /plans (the unified replacement)
      { source: '/category/back-office-support', destination: '/plans', permanent: true },
      { source: '/category/marketing-support', destination: '/plans', permanent: true },
      { source: '/category/product-support', destination: '/plans', permanent: true },

      // ── Per-service redirects: /service/{webflow-slug} → /services/{line}/{netlify-slug}
      // Order: hand-curated mapping. Where a Webflow service has no exact
      // Netlify match (e.g. business-card, email-signature, stationary all
      // merged into business-stationery), redirect to the closest equivalent.
      { source: '/service/automated-workflow-and-ai-integration', destination: '/services/service/ai-workflow-integration', permanent: true },
      { source: '/service/brand-guidelines', destination: '/services/brand/brand-guidelines', permanent: true },
      { source: '/service/business-card', destination: '/services/brand/business-stationery', permanent: true },
      { source: '/service/business-listings', destination: '/services/brand/online-business-listings', permanent: true },
      { source: '/service/crm-setup-and-data-cleanup', destination: '/services/service/crm-setup', permanent: true },
      { source: '/service/digital-file-organization', destination: '/services/service/digital-file-organization', permanent: true },
      { source: '/service/email-marketing', destination: '/services/marketing/email-marketing', permanent: true },
      { source: '/service/email-signature', destination: '/services/brand/business-stationery', permanent: true },
      { source: '/service/infographic', destination: '/services/information/infographics', permanent: true },
      { source: '/service/intake-forms', destination: '/services/information/intake-forms', permanent: true },
      { source: '/service/journey-map', destination: '/services/service/customer-journey-mapping', permanent: true },
      { source: '/service/landing-page', destination: '/services/marketing/landing-pages', permanent: true },
      { source: '/service/layout-design', destination: '/services/information/layout-design', permanent: true },
      { source: '/service/logo-design', destination: '/services/brand/logo-design', permanent: true },
      { source: '/service/marketing-consulting', destination: '/services/marketing/marketing-consulting', permanent: true },
      { source: '/service/patient-experience-mapping', destination: '/services/marketing/patient-experience-mapping', permanent: true },
      { source: '/service/presentation-design', destination: '/services/information/presentation-design', permanent: true },
      { source: '/service/sales-resources', destination: '/services/information/sales-resources', permanent: true },
      { source: '/service/signage-design', destination: '/services/information/signage-design', permanent: true },
      { source: '/service/social', destination: '/services/marketing/social-media-graphics', permanent: true },
      { source: '/service/software-automation-setup', destination: '/services/service/software-automation-setup', permanent: true },
      { source: '/service/software-subscription-audit', destination: '/services/service/software-subscription-audit', permanent: true },
      { source: '/service/sop-creation', destination: '/services/service/sop-creation', permanent: true },
      { source: '/service/stationary', destination: '/services/brand/business-stationery', permanent: true },
      { source: '/service/swag', destination: '/services/marketing/swag-merchandise-design', permanent: true },
      { source: '/service/training-setup-organization', destination: '/services/service/training-setup', permanent: true },
      { source: '/service/web-design', destination: '/services/marketing/web-design-development', permanent: true },
      { source: '/service/website-experience-mapping', destination: '/services/marketing/website-experience-mapping', permanent: true },
      { source: '/service/welcome-onboarding-kit', destination: '/services/information/welcome-onboarding-kit', permanent: true },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(
  withSentryConfig(nextConfig, {
    silent: !process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: false,
    disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
    disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  })
);
