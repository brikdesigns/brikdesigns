// R2 "Simple from day one." Workflow section (Homepage-R2 Notion doc).
// Three sequential engagement steps rendered as an alternating timeline over a
// BDS ZIndexMediaBand (#1056). Copy is the real R2 content, verbatim from the
// Notion doc — the Figma placeholder text ("Healthcare Dashboard POC",
// duplicated titles) is ignored. The per-step decorative illustration is
// deferred (structure ships now; real step art tracked in a follow-up), so no
// `imageUrl` here yet — the media panel renders as a neutral tinted surface.

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'brikdown-analysis',
    title: 'BrikDown Analysis',
    description:
      "A 60-minute look at your marketing and operations. We find out where you're losing time and money — and tell you what to fix first. No cost, no pitch.",
  },
  {
    id: 'foundation',
    title: 'Foundation',
    description:
      'We build your strategy and a 90-day roadmap so everything has a plan behind it. $5,000 for both sides, $2,500 for one.',
  },
  {
    id: 'monthly-engagement',
    title: 'Monthly Engagement',
    description:
      "Advisory means you execute with our direction. Managed means we take care of it. Either way, you're not doing it alone.",
  },
];
