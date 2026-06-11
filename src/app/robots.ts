import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Allow crawling only on production with indexing explicitly switched on.
  // Until the #371 DNS cutover flips NEXT_PUBLIC_ALLOW_INDEXING, the Netlify
  // production deploy (brikdesigns.netlify.app) stays disallowed so it isn't
  // indexed as a duplicate of the still-Webflow www.brikdesigns.com. Keep in
  // sync with the X-Robots-Tag gate in next.config.mjs.
  const indexingAllowed =
    process.env.NEXT_PUBLIC_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

  if (!indexingAllowed) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://www.brikdesigns.com/sitemap.xml',
  };
}
