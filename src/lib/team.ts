/**
 * Brik team roster — the single source of truth for Abbey + Nick.
 *
 * Consumed by the `/about` page (horizontal bio cards) and the home page's
 * `about` section (stacked cards). Extracted from `about/page.tsx` in #1274 so
 * the two surfaces cannot drift.
 *
 * `summary` is the short home-card blurb. It IS `bio[1]` (same reference, not a
 * retyped copy) — the operator copy in #1274 is each member's existing second
 * bio paragraph, so single-sourcing it here guarantees the two surfaces stay in
 * step. `accent` names the service-tier tint the home stacked card paints its
 * headshot panel with (Abbey → brand/yellow, Nick → information/blue).
 */

export interface TeamMember {
  name: string;
  fullName: string;
  role: string;
  image: string;
  /** Full bio (rendered on /about). `bio[1]` is the shared `summary`. */
  bio: string[];
  /** Home stacked-card blurb — the second bio paragraph, single-sourced. */
  summary: string;
  /** Home stacked-card headshot-panel tint. */
  accent: 'brand' | 'information';
  linkedin: string;
  email: string;
  website?: string;
}

const ABBEY_BIO = [
  'Abbey spent over a decade working inside marketing agencies — including a Fortune 500 firm focused on private practices and the dental industry — before launching Brik. She’s worked with hundreds of clients across marketing strategy, operations, and business development, and she’s seen firsthand what actually moves the needle and what’s just noise.',
  'At Brik, Abbey leads strategy and client relationships. She’s the one who gets into your business, figures out what’s slipping, and builds the plan to fix it.',
];

const NICK_BIO = [
  'Nick spent years as a lead designer at scale — iHeartRadio, SimplePractice, and Built — building products that had to work for thousands of users at once. That kind of work teaches you how to think about systems, not just surfaces.',
  'At Brik, Nick leads creative and execution. He’s responsible for making sure everything Brik builds — websites, campaigns, brand assets, client-facing materials — actually works the way it should. Good-looking and functional aren’t competing priorities to Nick. They’re the same thing.',
];

export const TEAM: TeamMember[] = [
  {
    name: 'Abbey',
    fullName: 'Abbey Stanerson',
    role: 'Marketing & Operations',
    image: '/images/Abbey-Headshot.webp',
    bio: ABBEY_BIO,
    summary: ABBEY_BIO[1],
    accent: 'brand',
    linkedin: 'https://www.linkedin.com/in/abbey-stanerson-62682142/',
    email: 'abbey@brikdesigns.com',
  },
  {
    name: 'Nick',
    fullName: 'Nick Stanerson',
    role: 'Creative & Execution',
    image: '/images/Nick-Headshot.webp',
    bio: NICK_BIO,
    summary: NICK_BIO[1],
    accent: 'information',
    linkedin: 'https://www.linkedin.com/in/nickstanerson/',
    email: 'nick@brikdesigns.com',
    website: 'https://nickstanerson.com',
  },
];
