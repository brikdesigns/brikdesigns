# Visual parity capture

Side-by-side full-page screenshots of `brikdesigns.com` (Webflow target) vs the Netlify deploy preview, at 4 viewports (`wide` 1600 · `desktop` 1280 · `tablet` 768 · `mobile` 375) × 2 themes. Used to drive page-by-page visual parity work during the Webflow → Next.js migration.

`wide` sits above the 1440px `--site-content-width` cap so a change to the cap is visible at all; below it every container is viewport-bound and no capture can see one (#1124).

## Usage

Capture against the latest deploy preview:

```bash
NETLIFY_URL=https://deploy-preview-52--brikdesigns.netlify.app npm run visual-parity
```

Or pass as an argument:

```bash
npm run visual-parity -- https://deploy-preview-52--brikdesigns.netlify.app
```

For local dev (run `npm run dev` first in another terminal):

```bash
NETLIFY_URL=http://localhost:3000 npm run visual-parity
```

When done, open the report:

```bash
open tests/visual-parity/screenshots/index.html
```

## Configuration

Env vars (all optional except `NETLIFY_URL`):

| Var | Default | Purpose |
|---|---|---|
| `NETLIFY_URL` | (required) | Netlify deploy-preview or localhost URL |
| `WEBFLOW_URL` | `https://www.brikdesigns.com` | Webflow target |
| `THEMES` | `light,dark` | Comma-separated themes to capture |

Routes + viewports live at the top of `scripts/visual-parity.mjs`. Edit there to add/remove pages.

## Notes

- Screenshots are full-page (`fullPage: true`) so the entire scroll height is visible side-by-side. The pane `<img>` is responsive so the report scales to your screen.
- The script scrolls each page top-to-bottom before capturing to trigger lazy images and scroll-reveal animations, then scrolls back to top — `reducedMotion: 'reduce'` is set so animation states don't randomize the capture.
- Themes are forced via `localStorage.theme` (read by the anti-FOUC script in `app/layout.tsx`) plus `prefers-color-scheme` emulation. The Webflow site doesn't respond to either — its captures will be identical across themes (that's expected; Webflow has no theme toggle).
- Screenshots are gitignored (build artifacts). Only commit the script + report HTML template.
- Capture failures are logged inline (`<route>.error.txt`) and the report shows "Capture failed" for that pane. Single-route failures don't stop the run.

## `figma` mode — fidelity against the design of record (#1392)

The three modes above all compare a rendering against another **rendering** — Webflow, staging, or a blessed capture of our own pipeline. None of them can see a page that renders consistently and *wrongly*, which is what every defect on the Figma rebuilds turned out to be (#1287 shipped 2 of 6 designed card slots; #1371's price overlapped its title). `figma` mode makes the Figma node the reference.

It diffs **per section**, not per page. A plan-detail page is ~6000px of mostly CMS copy, and copy drift would drown a layout regression in the aggregate — and a section is the unit the design is authored in (the frames are literally `section-hero`, `section-intro`, `section-cta`).

```bash
npm run visual-figma -- https://deploy-preview-N--brikdesigns.netlify.app
open tests/visual-parity/screenshots-figma/index.html
```

### Declaring a route

In `ROUTES` (`scripts/visual-parity.mjs`), beside `mockup`:

```js
figma: {
  fileKey: 'yhLkzLUnG71UFTgURDvgnv',   // Brik-Website
  themes: ['light'],                    // frames are authored light-only
  sections: {
    hero: '26144:9053',                 // → [data-section="hero"]
    'what-you-get': { node: '26144:9066', selector: '[aria-labelledby="what-you-get-title"]' },
  },
},
```

A bare node id defaults to the `data-section` convention. Declare a `selector` for the two shapes that convention does not reach: a BDS blueprint section (which identifies itself with `aria-labelledby`), and a CMS landing route (whose regions are `<div>`s inside one `<section>` — `/offers/brikdown` uses `.lp-split` / `.lp-split__trailer`).

### Re-baselining after a design change

Baselines are checked-in PNGs exported straight from the Figma node, so a design change re-baselines deterministically — you never hand-crop anything.

```bash
set -a; source ~/.secrets/figma.env; set +a
UPDATE_FIGMA_BASELINES=1 npm run visual-figma -- https://staging--brikdesigns.netlify.app
git add tests/visual-parity/figma/
```

Eyeball each regenerated PNG before committing. A re-baseline is an assertion that the *design* moved; running it to make a red section go green silently converts a fidelity defect into the new reference, which is the one way this gate stops being a gate.

This step is **local-operator-only, and CI has no Figma token by design.** CI reads the committed PNGs; only re-authoring calls Figma. A token in CI would mean every run re-renders the design of record — the one thing a baseline must not do.

### Reading the numbers

The shorter side is padded white before comparison, so the console prints both heights beside the percentage:

```
🔴 diff: 68.28%  (figma 1471px vs build 564px)
🔴 diff:  9.65%  (figma 1001px vs build 550px)
```

Those two are not the same finding. The first is structural — a section built at a third of its designed height. The second is a section whose shared region matches closely and simply ends sooner. Without the height pair the percentages are indistinguishable, and they need opposite fixes.

**The threshold is off, and `continue-on-error` is set in CI.** Unlike mockup mode — where the baseline is a capture of the same pipeline and the pass-case floor is ~0% — this mode's two sides are different renderers (Chromium vs Figma). The floor is a real number that has to be measured per section before it can block. Until then the report is the deliverable (#1392 § Out of scope: "start permissive and ratchet"). What *does* block: a missing baseline or a failed capture, exit 2 and 1 respectively — the same refusal as mockup mode, for the same reason (#822 survived four days as a silently-skipped comparison).

Figma copy is **not** a reference. The file is the source of truth for visual style and layout structure only; its copy, prices and counts are placeholder and routinely wrong. Real content lives in Notion/the CMS. A text diff inside a section is expected and is not a finding.

## When to run

- Before opening any visual-parity PR — capture against the deploy preview, verify the diff matches the user's expectation.
- After a visual-parity PR merges — re-capture to confirm parity tightened.
- When investigating a "doesn't look right" report — run locally, see the side-by-side.
