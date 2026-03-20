import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { MegaNavServer } from '@/components/layout/MegaNavServer';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Brik Designs | Marketing That Works. Design That Builds.',
    template: '%s | Brik Designs',
  },
  description:
    'We help small businesses show up better, work smarter, and grow faster — brik by brik. Branding, marketing, websites, and back-office design.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com'),
  openGraph: {
    type: 'website',
    siteName: 'Brik Designs',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <MegaNavServer />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
