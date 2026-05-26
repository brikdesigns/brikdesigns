import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { MegaNavServer } from '@/components/layout/MegaNavServer';
import { Footer } from '@/components/layout/Footer';
import { DevTools } from '@/components/DevTools';
import { poppins } from '@/lib/fonts';
import './globals.css';

const CHROMELESS_PREFIXES = ['/admin', '/login'];

function isChromelessPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return CHROMELESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const metadata: Metadata = {
  title: {
    default: 'Brik Designs | Strategic Branding & Marketing Design Services',
    template: '%s | Brik Designs',
  },
  description:
    'Build a better business — brik by brik. Brik Designs helps small businesses grow with smart branding, marketing, product, and service design. One-time or subscription-based.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com'),
  openGraph: {
    type: 'website',
    siteName: 'Brik Designs',
    title: 'Brik Designs | Strategic Branding & Marketing Design Services',
    description: 'Build a better business — brik by brik. Brik Designs helps small businesses grow with smart branding, marketing, product, and service design.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brik Designs | Strategic Branding & Marketing Design Services',
    description: 'Build a better business — brik by brik.',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/webclip.png',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname');
  const chromeless = isChromelessPath(pathname);

  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${poppins.className} theme-brand-brik`}>
        <ThemeProvider>
          {!chromeless && <MegaNavServer />}
          <main>{children}</main>
          {!chromeless && <Footer />}
          <DevTools />
        </ThemeProvider>
      </body>
    </html>
  );
}
