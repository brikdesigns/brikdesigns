// How We Work page content (brikdesigns#1121, #1123; renamed from How It Works #1171).
// Figma frame: node 25790-14431 → process 25880-4743 (style + structure only;
// Figma copy/data are placeholder — Notion is the copy SoT, Supabase the data
// SoT). Each process step has a distinct right pane, so ProcessStep is a
// discriminated union on `kind`:
//   • checklist   — Step 1: a 2×2 checklist
//   • tiers       — Step 2: a SegmentedControl over service-line plans, each
//                   showing its Managed monthly price (pulled live) + bullets
//   • engagement  — Step 3: two stacked mode sub-cards (Advisory / Managed)

const BRIKDOWN_HREF = '/offers/brikdown-analysis';

export interface ProcessChecklistItem {
  title: string;
  description: string;
}

// Step 2 segment — one service line offered as a plan. Price is NOT stored
// here; it is resolved live from service_plan_tiers (Managed) by planSlug.
export interface FoundationSegment {
  id: string;
  /** SegmentedControl label. */
  label: string;
  /** service_plans.slug → the Managed monthly price shown in the block. */
  planSlug: string;
  /** Detail bullets for this segment. */
  bullets: ProcessChecklistItem[];
}

// Step 3 engagement mode — a sub-card.
export interface EngagementMode {
  id: string;
  title: string;
  description: string;
  bestFor: string;
}

interface ProcessStepBase {
  id: string;
  /** Ordinal + cadence label rendered above the title ("Step 1 — Free"). */
  step: string;
  title: string;
  paragraphs: string[];
  cta: { label: string; href: string };
}

export type ProcessStep =
  | (ProcessStepBase & { kind: 'checklist'; checklist: ProcessChecklistItem[] })
  | (ProcessStepBase & { kind: 'tiers'; segments: FoundationSegment[] })
  | (ProcessStepBase & { kind: 'engagement'; modes: EngagementMode[] });

// Marketing and Back Office share their Foundation details for now (#1123) —
// one list referenced by both segments.
const SINGLE_SIDE_BULLETS: ProcessChecklistItem[] = [
  { title: 'Strategy + 90-day action plan', description: 'Built for your chosen side of the business.' },
  { title: 'Knowledge base', description: 'Documented and built out for that side.' },
  { title: 'The foundation for Step 3', description: 'Everything the ongoing engagement is built on.' },
];

export const PROCESS_STEPS: ProcessStep[] = [
  {
    kind: 'checklist',
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
    kind: 'tiers',
    id: 'foundation',
    step: 'Step 2 — One-time investment',
    title: 'Foundation',
    paragraphs: [
      'Foundation is where we go deep before the ongoing work begins. Through weekly calls and Brik’s own research, we map every relevant area of your business — marketing, sales, operations, tech stack, team structure, KPIs, and service management — and document it into a pre-structured knowledge base built for your engagement.',
      'You walk away with a clear 90-day action plan and everything Step 3 needs to hit the ground running. Foundation is required before Step 3 and typically takes 3–4 weeks.',
    ],
    cta: { label: 'Start with your free BrikDown', href: BRIKDOWN_HREF },
    segments: [
      {
        id: 'full-stack',
        label: 'Full Stack',
        planSlug: 'full-stack-support',
        bullets: [
          { title: 'Marketing strategy + 90-day plan', description: 'Built for your business.' },
          { title: 'Back office strategy + 90-day plan', description: 'Built for your business.' },
          { title: 'Knowledge base', description: 'Built out across marketing and back office.' },
          { title: 'The foundation for Step 3', description: 'Everything the ongoing engagement is built on.' },
        ],
      },
      {
        id: 'marketing',
        label: 'Marketing',
        planSlug: 'marketing-support',
        bullets: SINGLE_SIDE_BULLETS,
      },
      {
        id: 'back-office',
        label: 'Back Office',
        planSlug: 'back-office-support',
        bullets: SINGLE_SIDE_BULLETS,
      },
    ],
  },
  {
    kind: 'engagement',
    id: 'ongoing-engagement',
    step: 'Step 3 — Monthly',
    title: 'Ongoing Engagement',
    paragraphs: [
      'This is where the real work happens. You choose how deep you want Brik involved — Advisory if you want to keep your team executing, Managed if you want us to take it off your plate entirely.',
      'You can start Advisory and move to Managed, or run one side Advisory and the other Managed. We build the engagement around what makes sense for your business.',
      'Not sure which level is right? That’s exactly what the BrikDown figures out — no commitment until you’re ready to move forward.',
    ],
    cta: { label: 'See all plans and pricing', href: '/plans' },
    modes: [
      {
        id: 'advisory',
        title: 'Advisory (you execute)',
        description:
          'You and your team do the work — Brik gives you the direction. We meet regularly, review what’s working, adjust the plan, and make sure you’re always moving toward the right things.',
        bestFor:
          'Best for: owners who have a team to execute but need a clear strategy and someone to hold the plan accountable.',
      },
      {
        id: 'managed',
        title: 'Managed (we execute)',
        description:
          'Brik handles it. Campaigns, content, follow-up, workflows, systems — we take care of the execution and report back on results. Your team stays focused on patients and clients.',
        bestFor:
          'Best for: owners who want it off their plate entirely, or who don’t have internal capacity to execute consistently.',
      },
    ],
  },
];

export interface PracticeCard {
  id: string;
  title: string;
  description: string;
  /** Deep-link to this practice's customer story, when one is published. Cards
   *  without an href stay display-only (the section CTA covers the index). */
  href?: string;
}

// "What it looks like in practice" — two case studies, verbatim from the Notion
// content SoT. A card gets a per-story link only once its customer_stories slug
// exists (#1128): Vale Partners is published (`vale-partners-website`); Renew
// Dental has no story yet, so it stays display-only until one is.
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
    href: '/customer-stories/vale-partners-website',
  },
];
