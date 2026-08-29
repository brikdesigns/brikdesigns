// R2 "Simple from day one." Workflow section (Homepage-R2 Notion doc).
// Three sequential engagement steps rendered as an alternating timeline over a
// BDS MediaBand (#1056). Copy is the real R2 content, verbatim from the
// Notion doc — the Figma placeholder text ("Healthcare Dashboard POC",
// duplicated titles) is ignored.
//
// Per-step illustration (closes #1073): the design-source export, one
// illustration per step — assessment → BrikDown Analysis, roadmap →
// Foundation, engagement → Monthly Engagement. Source frames are 2140×1840
// (ratio 1.16), so the media panel is a 1:1 slot and the illustration is
// CONTAINED in it — covering would crop ~14% off the sides and slice the device
// frames (see the object-fit note in homepage.css). Three density steps ship per
// illustration (535w / 1070w / 1605w) and the <img> picks by `sizes` — the panel
// is a ~512px half-column on desktop, a full-width 320px band below 991px.

/** Density steps every step illustration exports at, in source pixels. */
export const WORKFLOW_IMAGE_WIDTHS = [535, 1070, 1605] as const;

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  /** Illustration basename under /images/workflow/ — `{base}_{1,2,3}x.webp`. */
  imageBase: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'brikdown-analysis',
    imageBase: 'assessment',
    title: 'BrikDown Analysis',
    description:
      "A 60-minute look at your marketing and operations. We find out where you're losing time and money — and tell you what to fix first. No cost, no pitch.",
  },
  {
    id: 'foundation',
    imageBase: 'roadmap',
    title: 'Foundation',
    description:
      'We build your strategy and a 90-day roadmap so everything has a plan behind it. $5,000 for both sides, $2,500 for one.',
  },
  {
    id: 'monthly-engagement',
    imageBase: 'engagement',
    title: 'Monthly Engagement',
    description:
      "Advisory means you execute with our direction. Managed means we take care of it. Either way, you're not doing it alone.",
  },
];
