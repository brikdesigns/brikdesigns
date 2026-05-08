# Visual parity capture

Side-by-side full-page screenshots of `brikdesigns.com` (Webflow target) vs the Netlify deploy preview, at 3 viewports × 2 themes. Used to drive page-by-page visual parity work during the Webflow → Next.js migration.

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

## When to run

- Before opening any visual-parity PR — capture against the deploy preview, verify the diff matches the user's expectation.
- After a visual-parity PR merges — re-capture to confirm parity tightened.
- When investigating a "doesn't look right" report — run locally, see the side-by-side.
