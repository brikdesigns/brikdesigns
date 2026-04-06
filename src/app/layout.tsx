import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { GoogleTagManager } from '@next/third-parties/google';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { MegaNavServer } from '@/components/layout/MegaNavServer';
import { Footer } from '@/components/layout/Footer';
import { OrganizationJsonLd } from '@/components/seo/JsonLd';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com';
const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

export const metadata: Metadata = {
  title: {
    default: 'Brik Designs | Strategic Branding & Marketing Design Services',
    template: '%s | Brik Designs',
  },
  description:
    'Build a better business — brik by brik. Brik Designs helps small businesses grow with smart branding, marketing, product, and service design. One-time or subscription-based.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    siteName: 'Brik Designs',
    title: 'Brik Designs | Strategic Branding & Marketing Design Services',
    description: 'Build a better business — brik by brik. Brik Designs helps small businesses grow with smart branding, marketing, product, and service design.',
    url: siteUrl,
    images: [{ url: '/images/brik_designs_4x.webp', width: 1200, height: 630, alt: 'Brik Designs' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brik Designs | Strategic Branding & Marketing Design Services',
    description: 'Build a better business — brik by brik.',
    images: ['/images/brik_designs_4x.webp'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/webclip.png',
  },
  alternates: {
    canonical: siteUrl,
  },
};

/**
 * Anti-FOUC script: reads localStorage/prefers-color-scheme and sets
 * data-theme on <html> before React hydrates. Prevents flash of wrong theme.
 */
const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://rnspxmrkpoukccahggli.supabase.co" />
        <link rel="dns-prefetch" href="https://rnspxmrkpoukccahggli.supabase.co" />
      </head>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body>
        <OrganizationJsonLd />
        <ThemeProvider>
          <MegaNavServer />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
