// How It Works page content (brikdesigns#1121 — HIW rebuild, structure-first).
// Figma frame: node 25790-14431 (Brik-Website).
//
// PLACEHOLDER COPY. Like the home TESTIMONIALS block, this ships the section
// STRUCTURE without treating the Figma placeholder text as final marketing
// copy. Notion is the content SoT; real copy lands in a follow-up. The process
// step NAMES (BrikDown Analysis / One-Time Investment / Engagement) and the
// CTA labels are process-structural — not client facts — so they stand.

export interface ProcessChecklistItem {
  /** Short topic label naming what the step examines/produces. */
  title: string;
  /** One-line expansion of the topic. */
  description: string;
}

export interface ProcessStep {
  /** Stable key — drives the section's data-section id and React key. */
  id: string;
  /** Ordinal label rendered above the title ("Step 1"). */
  step: string;
  /** Step name. */
  title: string;
  /** Body paragraphs (Figma shows two per step). */
  paragraphs: string[];
  /** Per-step primary CTA (faithful to the Figma frame — one button per card). */
  cta: { label: string; href: string };
  /** 2×2 checklist rendered in the card's right pane. Exactly four items. */
  checklist: ProcessChecklistItem[];
}

const BRIKDOWN_HREF = '/offers/brikdown-analysis';

export const PROCESS_STEPS: ProcessStep[] = [
  {
    id: 'brikdown-analysis',
    step: 'Step 1',
    title: 'BrikDown Analysis',
    paragraphs: [
      'A short conversation about where your marketing and operations stand today. We look at what is working, what is not, and where the effort is going.',
      'You walk away with a clear picture of your biggest opportunities — no cost and no obligation to go further.',
    ],
    cta: { label: 'Book Your Free BrikDown', href: BRIKDOWN_HREF },
    checklist: [
      { title: 'Lead generation', description: 'How you are currently getting new clients — and where leads are slipping.' },
      { title: 'Follow-up', description: 'What happens after a lead comes in, and how much of it is manual.' },
      { title: 'Operations', description: 'The systems your team relies on, and the ones living in someone’s head.' },
      { title: 'Reporting', description: 'What you can see today, and the numbers you are flying blind on.' },
    ],
  },
  {
    id: 'one-time-investment',
    step: 'Step 2',
    title: 'One-Time Investment',
    paragraphs: [
      'We build the foundation — the brand, the site, and the systems that connect marketing to operations — as a single, scoped project.',
      'One clear price, one timeline, one team. You approve the plan before anything starts.',
    ],
    cta: { label: 'Get Your Free BrikDown', href: BRIKDOWN_HREF },
    checklist: [
      { title: 'Brand & site', description: 'The public-facing foundation, built to convert and easy to run.' },
      { title: 'Systems', description: 'The tools that follow up, track, and keep the process moving.' },
      { title: 'Handover', description: 'Everything documented, so the process does not live in one person.' },
      { title: 'Timeline', description: 'A scoped delivery date you can plan the rest of the year around.' },
    ],
  },
  {
    id: 'engagement',
    step: 'Step 3',
    title: 'Engagement',
    paragraphs: [
      'Once the foundation is live, we stay on as your ongoing marketing and operations partner — running what we built and improving it over time.',
      'A predictable monthly subscription. Cancel or scale as your needs change.',
    ],
    cta: { label: 'Get Your Free BrikDown', href: BRIKDOWN_HREF },
    checklist: [
      { title: 'Marketing', description: 'Campaigns and content that keep the pipeline full month over month.' },
      { title: 'Operations', description: 'The back office running quietly in the background, off your plate.' },
      { title: 'Reporting', description: 'Clear numbers each month, so you always know what is working.' },
      { title: 'Support', description: 'One team to call — no vendor juggling, no dropped handoffs.' },
    ],
  },
];

export interface PracticeCard {
  id: string;
  title: string;
  description: string;
}

// "What It Looks Like In Practice" — two example cards (Figma renders two
// placeholder cards side by side). PLACEHOLDER content; real examples follow.
export const PRACTICE_CARDS: PracticeCard[] = [
  {
    id: 'example-1',
    title: 'Example one',
    description:
      'A short before/after of a real engagement — what was slipping, what we built, and what changed. Replaced with a live client example before launch.',
  },
  {
    id: 'example-2',
    title: 'Example two',
    description:
      'A second engagement in a different industry, showing the same process applied to a different set of problems. Replaced with a live client example before launch.',
  },
];
