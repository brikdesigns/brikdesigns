// How It Works page content (brikdesigns#1121 — HIW rebuild, structure-first).
// Figma frame: node 25790-14431 (Brik-Website).
//
// Copy source: the Notion "How It Works" page (content SoT).
// Step 1 + PRACTICE_CARDS carry the real Notion copy. Steps 2 & 3 keep
// PLACEHOLDER copy on purpose: their real content (Foundation's two pricing
// tiers; Engagement's Advisory/Managed modes) does not fit the uniform 2×2
// checklist card, so their structure is held for a follow-up decision (#1121).

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
    step: 'Step 1 — Free',
    title: 'The BrikDown Analysis',
    paragraphs: [
      'A free 60-minute call where we look at your marketing and your operations together. We ask the right questions, find out where you’re losing time and money, and tell you exactly what to fix first.',
      'You walk away with a clear picture of your biggest opportunities — at no cost and no obligation. Most clients tell us it’s the most useful 60 minutes they’ve spent on the business.',
    ],
    cta: { label: 'Book your free BrikDown', href: BRIKDOWN_HREF },
    checklist: [
      { title: 'Lead generation', description: 'How you’re currently getting new patients or clients — and where leads are slipping.' },
      { title: 'Existing marketing efforts', description: 'What marketing is happening, what isn’t, and what’s actually worth doing.' },
      { title: 'Existing operations', description: 'How your operations run — scheduling, follow-up, onboarding, internal processes.' },
      { title: 'Team check', description: 'Where your team is losing time to tasks that should be automated or documented.' },
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

// "What it looks like in practice" — two case studies, verbatim from the Notion
// content SoT. Cards are display-only for now; per-story links wait on the
// customer-story slugs (the section CTA points at the /customer-stories index).
export const PRACTICE_CARDS: PracticeCard[] = [
  {
    id: 'renew-dental',
    title: 'How Renew Dental stopped training new hires by hand',
    description:
      'A growing dental practice in Clarksville, TN — Brik built their training system, centralized their tools, and gave the team a real playbook to run from.',
  },
  {
    id: 'vale-partners',
    title: 'How Vale Partners rebuilt their brand, website, and operations from the ground up',
    description:
      'A boutique commercial real estate brokerage in Brentwood, TN mid-rebrand — Brik built their brand identity, website, CRM, and agent onboarding from scratch, and made them run without the founders having to touch them.',
  },
];
