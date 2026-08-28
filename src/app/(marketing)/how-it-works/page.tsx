import type { Metadata } from 'next';
import HomePage from '../page';

// Establishes /how-it-works in the site structure (nav item added in #TBD).
// For starters it adopts the home page layout wholesale — the section content
// diverges in a follow-up, at which point this forks into its own markup.
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: '/how-it-works' },
  title: 'How It Works | Brik Designs',
  description:
    'How Brik takes marketing and back-office operations off your plate — so leads get followed up, your team has a process, and you can focus on the work.',
};

export default function HowItWorksPage() {
  return <HomePage />;
}
