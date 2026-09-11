# Accessibility tests

Automated WCAG 2.1 AA audit using `@axe-core/playwright`. Runs against every
PR's Netlify deploy-preview, and locally via `npm run test:a11y`.

## Hard rules (per cross-repo CLAUDE.md § Accessibility)

1. **Conformance level locked to WCAG 2.1 AA** (`wcag2a`, `wcag2aa`, `wcag21a`,
   `wcag21aa`). Don't silently bump the level to 2.2 or AAA without a
   decisions-log entry. The tag set also includes **`best-practice`** — not a
   level bump, but the only way to enable axe's landmark rules (`region`,
   `landmark-one-main`, `landmark-unique`, `heading-order`), which carry no WCAG
   tag. These are `moderate` impact → advisory, never block. This is the
   `build-standards/page-structure` landmark gate (brik-bds #824), mirroring
   brik-client-portal #961.
2. **Per-route baseline only.** Never `disableRules` whole-app — partial
   disable weakens the ADA defense story ("we run WCAG 2.1 AA"). Every waiver
   is scoped to one route and one theme.
3. **CI runs against the Netlify deploy-preview**, not a CI-side rebuild.
   Avoids exposing Supabase secrets to GitHub Actions for a low-risk gate.
4. **`reducedMotion: 'reduce'`** in the Playwright config — bypasses
   scroll-reveal opacity:0 false-positives that would otherwise spam
   contrast violations on first paint.

## Files

| File | Purpose |
|------|---------|
| `public-routes.spec.ts` | Iterates the public route list, runs axe on each, fails on new serious/critical |
| `baseline.json` | Per-(route, theme, rule, colour-pair) allowlist for pre-existing debt. Populated only when something is too expensive to fix immediately, and burned down monthly |
| `lib/baseline-match.ts` | The matcher — turns a finding into a stable fingerprint and decides whether it is waived |
| `lib/baseline-match.test.ts` | Offline self-test for the matcher + the live `baseline.json` shape (`npm run test:a11y-baseline`, wired into `verify`) |
| `README.md` | This file |

## Adding a route

Add it to `PUBLIC_ROUTES` in `public-routes.spec.ts`. Dynamic routes are
covered by one representative slug per family (`/services/brand`, `/blog/<slug>`,
etc.) — pick a route that's representative of the layout, not edge cases.

## When axe finds something on a new PR

**Default**: fix it. The blocking rule set (serious + critical) is small;
most fixes are 1-line CSS changes.

**Escape hatch**: if the fix is genuinely too expensive for the current PR,
add the violation's **fingerprint** — the colour pair axe names in the failure
summary — under the route and theme it fires on:

```json
{
  "fingerprints": {
    "/services/brand": {
      "color-contrast": ["#ffffff on #e35335"]
    }
  },
  "fingerprintsDark": {}
}
```

Open a follow-up issue in the same commit and record it in the change log at
the bottom of this file. Burn-down expectation: first Monday of every month,
ship a PR removing the cheapest-to-fix entries. Don't accumulate.

### The key is the violation, not the selector (#1361)

`baseline.json` used to waive by CSS selector. That key is unstable: axe
re-roots a selector whenever the DOM around the element changes — a wrapper
inserted, a class set that stops being unique, a slug renamed — so the ratchet
read the *same already-accepted violation* as new and the waiver had to be
re-pointed by hand. The file recorded its own cost: **21 hand-maintenance
passes** (7 RE-INDEX, 8 EXPANSION, 6 BURN-DOWN) and a 13,090-character
changelog inside a JSON string value, doing the job of a git history because
the identity keys were unstable.

A `color-contrast` finding's identity is its colour pair, and that survives
every DOM change. Measured against `staging--brikdesigns.netlify.app` on
2026-09-10 — all 21 routes × both themes, 211 serious/critical nodes:

| Nodes | Fingerprint | Owner |
|---|---|---|
| 210 | `#ffffff on #e35335` | accepted brand debt — #1263 / brik-bds#479 (BDS-22) |
| 1 | `#27ae60 on #bef4d4` | `.bds-badge`, /how-we-work, dark theme |

Two facts, encoded as 160 selectors. 89 of those 160 (56%) had already stopped
matching anything.

**Scope.** A fingerprint is scoped to one route and one theme. A new route
rendering white-on-poppy body copy still **fails** and needs a deliberate
entry — that is what stops a waiver rotting into a rubber stamp for every page
added later, and it is why the site-wide alternative was rejected. Widening it
to a site-wide predicate needs a matching update to the brik-bds
`contrast-pairings.json` policy.

**Colourless rules.** A rule that names no colour (`link-name`, `image-alt`, …)
has no fingerprint, so it still waives by selector under `routes` /
`routesDark`, with `:nth-child(N)` / `:nth-of-type(N)` stripped on both sides
(#40). Both are empty today. A `color-contrast` finding never falls back to the
selector path — otherwise the unstable key returns through the escape hatch.

The matcher is `lib/baseline-match.ts`; `npm run test:a11y-baseline` asserts it
offline and runs in `verify`.

### Reading a fingerprint off a failing run

The failure message names the selector; the fingerprint is in axe's summary.
Either read it from the per-route report in the `playwright-report` artifact
(`test-results/**/axe-report.json` → `blocking[].failureSummary`), or from a
local run of the suite. The two hex values in
`foreground color: #xxxxxx, background color: #yyyyyy` are the entry, lower-cased.

## Excluded from the audit

The axe run excludes two environment-only overlays that aren't production
content:

- `iframe[title="Netlify Drawer"]` — Netlify deploy-preview admin UI.
- `.bdb-bar` — the **Brik Dev Bar** (`BrikDevBar`), injected client-side when
  `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` (see `src/components/DevTools.tsx`). It's
  absent in production. Before it was excluded it produced a **flaky blocking**
  white-on-poppy `color-contrast` finding (`.bdb-logo`, 3.78:1) and a spurious
  `region` finding — flaky because it mounts after `load`. `.bdb-logo` is inside
  `.bdb-bar`, so the one exclude covers the whole subtree.

## Landmark audit findings (captured 2026-06-04, staging)

Surfaced once the landmark rules were enabled (brik-bds #824). All `moderate`
→ advisory, never block; none baselined (baseline is serious/critical only).
Captured against `staging--brikdesigns.netlify.app` — the Next.js rebuild.
(`www.brikdesigns.com` is still the legacy Webflow site and is **not** a valid
target for this gate.)

| Rule | Selector | Routes | Owner |
|------|----------|--------|-------|
| `heading-order` | `.bds-footer__column > h6` | all standard-layout routes | BDS Footer — `h6` follows higher headings |
| `heading-order` | card headings (`.story-card`, `.about-team-name`, `.bds-pricing-card__title`, `.customer-topic-grid h3`) | /results, /about, /plans, /customers/dental | brikdesigns page components |
| `landmark-complementary-is-top-level` | `aside` | /services/brand/logo-design | `aside` nested inside another landmark |
| `landmark-unique` | `.mega-nav__main` | /value | nav landmark needs a distinct accessible name |

**Needs in-browser investigation (not yet triaged):** `/value`, `/get-started`,
`/contact`, `/free-marketing-analysis`, `/privacy-policy` *intermittently*
report no `<main>` + loose `region` findings (`.branding`, `.footer`), but their
**server-rendered HTML has a proper `<main>`** — pointing to a client-side error
boundary on staging, not a real structure violation. Tracked in **#1403**
(confirm in a headed browser before baselining; don't silence). #341 is closed
with its investigation unfinished, so it is not the owner.

Since #1403 these routes identify themselves. `src/app/error.tsx` renders a
`role="alert"` block carrying `data-app-error` and a one-line record —
`app-error · name=… · message=… · route=… · digest=… · sentry=… · at=…` — to the
DOM, the console and Sentry. So on the next occurrence:

- a **screenshot** of the failing route now names the error, not just proves one
- the same line is in the browser console, via `page.on('console')`
- the event is in Sentry tagged `boundary=app-error`, which is what exempts it
  from `beforeSendClient`'s drop list (`instrumentation-client.ts`) — that
  filter discards `ChunkLoadError`, and a cold deployment is exactly when a
  still-open document requests chunk hashes the new build no longer serves

The boundary deliberately renders **no `<main>`**, so the render guard in
[`lib/goto-rendered.ts`](lib/goto-rendered.ts) still tells an error page apart
from a real one. Asserted by `npm run test:app-error-record`.

## Healthcare clients

If brikdesigns ever hosts a healthcare client surface, the elevated rules
in `@brikdesigns/bds/content-system/compliance/healthcare-ada.md` apply on
top of the base WCAG 2.1 AA gate. Today, brikdesigns.com is general-business
marketing, so base AA is the standard.

---

## Baseline change log

Migrated verbatim from `baseline.json`'s `_comment` / `_commentDark` string
values on 2026-09-10 (#1361, AC 3) — 16,850 characters of narrative that were
doing the job of a git history because the file's identity keys were unstable.
Nothing below is edited; it is preserved because the burn-down reasoning
(which cluster is owner-accepted, which is upstream, what unblocks it) is not
recoverable from the diff alone.

**Entries after 2026-09-10 are fingerprint-keyed.** A RE-INDEX entry — a waiver
re-pointed because axe moved the selector — should no longer be possible; if
one appears, the fingerprint key has a gap worth a ticket rather than a note.

### Current entries and why they are accepted

| Route | Theme | Fingerprint | Owner / burn-down |
|---|---|---|---|
| `/`, `/about`, `/blog`, `/customers`, `/customers/dental`, `/free-marketing-analysis`, `/plans`, `/results` | light + dark | `#ffffff on #e35335` | Owner-accepted brand debt. White on vibrant Poppy measures 3.78:1; BDS gates brand-primary fills at AA-large (3:1), but 16px normal-weight body copy is AA-normal (4.5:1) per axe. Settled position, not undiscovered debt — Nick's call, 2026-07-27. Underlying fix: brikdesigns#1263 / brik-bds#479 (BDS-22). |
| `/how-we-work` | dark only | `#27ae60 on #bef4d4` | BDS defect, not brikdesigns CSS. `Badge appearance="subtle" tone="positive"` pairs `--surface-positive` (`#bef4d4`, identical in both themes) against `--text-positive`, which flips to mid-green in dark on the documented assumption of a black surface — 2.33:1 on the fixed-light fill. Filed brik-bds#2402. **Burn down when that ships and the bump lands.** |

Button labels rooting on `.bds-button__content` are **not** in the file at all —
`isAcceptedBrandCtaContrast` in `public-routes.spec.ts` accepts them by
predicate, site-wide, and covered 176 of the 211 nodes measured on 2026-09-10.

### Light-theme history (`_comment`, verbatim)

EXPANSION 2026-07-01 (BDS-22 — brik-bds#1053/#649, ADR-015): re-introduced the white-on-vibrant-Poppy button/surface cluster (65 light + 71 dark canonical selectors across 18 routes) that the 2026-05-18 #710 burn-down eliminated. brik-bds@0.114.0 reverted --surface/-background-brand-primary poppy-dark→poppy-light per OWNER DECISION to keep the white-on-red CTA look; BDS gates it AA-large (3:1) but 16px normal-weight labels are AA-normal (4.5) per axe, so white-on-#e35335 (3.78:1) fires. Deliberate owner-accepted debt, NOT a silent skip. NOTE: --text-brand-primary was pinned dark locally (#649) so poppy-TEXT-on-white is fixed, not baselined — only white(-ish)-on-fill entries below are the debt. Burn-down options: dark labels on the fill, bold+>=18.66px labels (AA-large), or an intermediate AA-passing Poppy step (brik-bds BDS-20 scale). Tracked: brik-bds#479.

--- PRIOR HISTORY: Pre-existing serious/critical findings allowed at baseline-install time. New violations of any rule on any selector still fail CI. Burn-down policy: see tests/a11y/README.md. Format: routes[<path>][<axe-rule-id>] = string[] of CSS selectors to allow. SELECTOR MATCHING: the spec strips :nth-child(N) and :nth-of-type(N) on both sides before comparing — write canonical (un-indexed) entries.

RESET 2026-05-07 against deploy-preview-43; selector normalization 2026-05-11 (#40) collapsed 354 → 237 entries by absorbing per-card index variants. brikdesigns#43 migrated BDS consumption from submodule to npm package; the bundled @brikdesigns/bds/styles.css now covers the full button system, surfacing brand-vs-AA contrast tensions (white-on-poppy 4.34:1, poppy-on-yellow 2.58:1, etc.) that previous architecture only partially exercised.

EXPANSION 2026-05-15 (#167 promote PR): +51 white-on-poppy primary-button selectors across 16 routes — services / plans rebuild surfaced new href patterns (e.g. [href$="brand"], [href$="marketing-support"]) that weren't in the 05-07 baseline. Underlying contrast issue is upstream BDS — burn-down still tracked in #40.

BURN-DOWN 2026-05-17 (#40 monthly): removed 30 entries (273→243). 22 footer above-top h3/p selectors cleared by fix(footer) commit 27a5fbb (use on-color-dark not text-inverse — dark mode flipped text-inverse to black on always-dark footer bg). 6 homepage subtexts (.audit-subtext, 2×.section-subtext, .story-description) + 2 about subtexts (.about-hero__intro, .about-hero__scroll>span) + 2 .page-hero__tagline (/services/brand + /industries/dental) all now pass following fix(a11y) commit b88855c (--text-secondary→#4f4f4f, --text-brand-primary→#b0351b). Remaining 243: ~120 white-on-poppy primary buttons (upstream BDS), ~7 BDS breadcrumb, ~25 other (outline-on-dark hero, BDS plans toggle, various).

EXPANSION 2026-05-17 (#215 promote blocker round 1): +2 upstream BDS white-on-poppy entries (3.78:1) surfaced by new /customers + BDS card refactor PRs. /: div > .bds-button--md.bds-button--primary.bds-button > .bds-button__content. /services/brand: .bds-button--sm. 243→245.

EXPANSION 2026-05-17 (#215 promote blocker round 2): +7 entries across /industries (4), /industries/dental (1), /customers (2) — new routes now resolving after netlify.toml redirect loop fix (#216); all upstream BDS white-on-poppy (3.78:1). 245→252.

BURN-DOWN 2026-05-18 (post brik-bds@0.72.0 publish — #710/#711): removed 214 entries (221→7). brik-bds#710 shipped --surface-brand-primary / --background-brand-primary poppy-light → poppy-dark + the previously-missing --surface-brand-primary-hover/-pressed + --background-brand-primary-hover/-pressed state-pair siblings; brikdesigns bumped to @brikdesigns/bds@^0.72.0 via #240/#241. The white-on-poppy primary-button + badge contrast clusters (the bulk of the prior baseline) no longer fire. Log count had drifted from file count (running log: 252; baseline.json at burn-down start: 221) — re-anchored on actual scan against local next dev at staging-equivalent state. Remaining 7: 5 .bds-breadcrumb__current / .bds-breadcrumb__link on /services/brand, /services/brand/logo-design, /customers/dental (upstream BDS breadcrumb contrast); 2 .bds-pricing-card__period + .bds-pricing-card__badge on /plans (BDS plans card subtext). Both clusters are `.bds-*` component internals — upstream fix tracked in brikdesigns/brik-bds#765 (filed 2026-05-23).

EXPANSION 2026-05-24 (#262 promote blocker): +1 .bds-pricing-card__period on /services/brand/logo-design — same upstream BDS period-text contrast bug now surfaced by service-line UI cleanup (PR #255) which added PricingCard to service detail pages. 7→8. Tracked in brik-bds#765.

BURN-DOWN 2026-05-24 (#40 monthly): removed 1 entry (8→7). .bds-pricing-card__badge>span on /plans cleared by fixing PlanCardGrid.tsx discount-label color from color.text.success (#27ae60, 2.87:1) to color.text.primary. Breadcrumb-link + text-muted entries blocked pending two upstream fixes: (A) dep bump to brik-bds>=0.73.0 (includes #719, fixes 2 .bds-breadcrumb__link entries) — blocked on Netlify PACKAGES_READ_TOKEN rotation (brikdesigns/brik-llm#570, #624; Netlify brikdesigns site env not updated after 2026-05-23 rotation); (B) brik-bds#765 (--text-muted→--text-secondary in Breadcrumb.css + PricingCard.css, fixes 5 entries). When both land, remaining 7 entries clear and #40 closes.

EXPANSION 2026-06-04 (#335 events landing): +3 service-line primary-button entries on /services (1) + /customer-stories (2). The product (#362d48 on #9e8bc2 = 4.26:1) and back-office (#4e1400 on #e76134 = 4.32:1) service-button palettes are marginally under AA — surfaced on the index pages after the service→back-office rename + palette additions. Distinct cluster from #765 (breadcrumb/pricing-card); upstream fix tracked in brik-bds#827. Discovered during brikdesigns#335; the events route itself is a11y-clean. 7→10.

BURN-DOWN 2026-06-04 (#346 / PR #347): removed the 3 service-line button entries (10→7). #347 fixed the root cause — ServiceLineCard now uses the accessible `--background-service-{x}-on-light` fill + `--text-service-{x}-on-dark` text pairing (8.3–12.5:1), so the product/back-office CTA contrast no longer fires on /services or /customer-stories. Verified 0 color-contrast on both routes against live staging. Baselining them (#349) was redundant with the fix and would have masked any future regression — removed.

RE-INDEX 2026-07-23 (#710 blog filter): /blog color-contrast selectors churned (no new debt) when the blog index gained a 'Load more' button + capped to 6 cards. The added lg outline 'Load more' made `.bds-button--lg` non-unique, so axe re-selected the pre-existing white-on-poppy 'Subscribe' CTA as `.bds-button--full-width`; and the capped grid reshuffled axe's class order on the 'Read Article' card buttons to `.bds-button--md.bds-button--primary.bds-button`. Updated both /blog entries (light + dark) to the current selectors. Same two underlying owner-accepted poppy buttons — the 'Load more' button itself is outline (#b0351b on transparent) and passes AA.

RE-INDEX 2026-07-24 (#708 AC3): removing the redundant lg 'View Services' hero CTA from the /services/[serviceLineSlug] template made '.bds-button--lg' unique on /services/brand, so axe re-selected the pre-existing white-on-poppy 'Subscribe' newsletter button from '.bds-button--full-width' back to '.bds-button--lg' (inverse of the #710 churn). Updated /services/brand (light + dark) full-width → lg. Same underlying owner-accepted button; the removed hero CTA was on the accessible service tint and never itself baselined.

RE-INDEX 2026-07-24 (#735 BACKLOG-932): wrapping the footer newsletter in the scroll-fade Reveal inserted a `.reveal` level between `.bds-footer__above-top` and the newsletter form, so axe re-rooted the footer 'Subscribe' button selector on /contact + /free-marketing-analysis (light + dark) from `.bds-footer__above-top > div > div > form > ...` to `.reveal > div > div > form > ...`. Same owner-accepted white-on-poppy CTA (brik-bds#479); routes that baseline it by the ancestor-free `.bds-button--full-width` selector were unaffected.

RE-INDEX 2026-08-16 (#938 services-taxonomy): /customer-stories 'Our Services' section swapped ServiceLineCards for HomePlanCards (subscription-plan cross-sell). The plan cards carry `.bds-card--outlined.bds-card--padding-md.bds-card--interactive`, which the pre-existing story-list 'Read Story' cards ALSO carry — so axe re-rooted the story-card CTA selector from `.bds-card--link.story-card.bds-card > ...` to `.bds-card--outlined.bds-card--padding-md.bds-card--interactive > ...` (nth-child disambiguation) on /customer-stories (light + dark). Same underlying owner-accepted white-on-#e35335 'Read Story' button (brik-bds#479); added the re-rooted selector alongside the churned one. The new HomePlanCard 'Learn More' CTAs are auto-accepted via isAcceptedBrandCtaContrast (their label roots on `.bds-button__content`), not baselined.

RE-INDEX 2026-08-16 (#937 SectionHeader onColor): the five filled brand-band CTA intros migrated from a raw `<h2>` + `<p>` pair to `<SectionHeader onColor>` (brik-bds#1859, published 0.162.0), so axe now roots the band's description on `.bds-content-block--on-color > .bds-content-block__description` instead of `.cta-card-brand > p`. Re-pointed all 6 entries (3 light + 3 dark: /customers, /customers/dental, /customer-stories). Same underlying owner-accepted white-on-#e35335 3.78:1 body copy — NOT new debt and NOT a widening of isAcceptedBrandCtaContrast, which stays scoped to `.bds-button__content`. The band description is 16px normal weight, so AA-normal 4.5:1 applies to it even though the 32px title clears AA-large; burn-down is still the brik-bds#479 / BDS-22 fill question. Migrating dropped the `opacity: 0.9` three of these descriptions carried, which slightly IMPROVES the measured ratio.

EXPANSION 2026-08-23 (#1023 blog bands): /blog gained the home page's `.cta-card` 'Get in Touch' band (raw `.cta-title`/`.cta-description`, mirrored from src/app/(marketing)/page.tsx per owner request). Its `.cta-description` is the SAME owner-accepted white-on-#e35335 3.78:1 body copy already baselined on `/` (line 45/169) and tracked in brik-bds#479 / BDS-22 — not new debt, the identical brand-CTA treatment on a new route. Added `.cta-description` to /blog (light + dark).

RE-INDEX 2026-09-05 (#1239 customer-stories→results): the /customer-stories baseline key was renamed to /results with the slug move. axe re-rooted the story-card 'Read Story' CTA selector from the class root (.bds-card--outlined.bds-card--padding-md.bds-card--interactive) to the card link's href (a[href$="vale-partners-website"], a[href$="tncld-website"]) — same owner-accepted white-on-#e35335 3.78:1 button (brik-bds#479 / BDS-22), not new debt. Kept the class-root entry as a fallback; added the two href-rooted selectors (light + dark).

RE-INDEX +

BURN-DOWN 2026-09-07 (#1260 card consolidation): /blog's brand CTA moved off its own `.section-cta` / `.cta-card` Webflow port onto the shared `.cta-section-brand` / `.cta-card-brand` + `<SectionHeader onColor>` pattern the other seven brand-CTA routes already use, so axe re-roots the band description from `.cta-description` to `.bds-content-block--on-color > .bds-content-block__description` — the SAME selector /results, /customers and /customers/dental already baseline since the #937 migration. Re-pointed /blog (light + dark). Same owner-accepted white-on-#e35335 3.78:1 16px body copy (brik-bds#479 / BDS-22), not new debt and not a new route. REMOVED the two `/` entries (light + dark): the homepage migrated off `.cta-description` in #937 and this PR deleted the class from homepage.css, so those entries could never match again — net baseline count is DOWN 2. Underlying AA fix for the shared on-color description is filed as brikdesigns#1263. EXPANSION +

BURN-DOWN 2026-09-08 (#1287 plans rebuild, PR #1288): /plans gained the shared `.cta-section-brand` / `.cta-card-brand` + `<SectionHeader onColor>` brand-CTA band it previously did not have (the old index page ended on a Product Support panel, now removed by operator decision). Its band description is the SAME owner-accepted white-on-#e35335 3.78:1 16px body copy already baselined on /results, /customers, /customers/dental and /blog since the #937 migration — identical shared treatment on a new route, NOT new debt and NOT a widening of isAcceptedBrandCtaContrast. Added `.bds-content-block--on-color > .bds-content-block__description` to /plans (light + dark). Underlying AA fix is brikdesigns#1263 / brik-bds#479 (BDS-22); Figma specs this description as body/lg 18px normal, which is still AA-normal 4.5:1, so the design as drawn cannot clear it without the fill decision. REMOVED the stale `.plans-card-wrapper > .bds-pricing-card > .bds-pricing-card__price-block > .bds-pricing-card__period` entry from /plans: the rebuild took PlanCardGrid off the index page, so `.plans-card-wrapper` no longer renders on /plans and that selector could never match again (the /plans/back-office-support entry still uses PlanCardGrid and is untouched). Net /plans light count unchanged at 3, dark 2→3.

### Dark-theme history (`_commentDark`, verbatim)

Dark-theme baseline (chromium-desktop-dark project, colorScheme:dark). Added 2026-06-06 (#359 follow-up) when the axe suite gained a dark-mode pass — the suite had only ever rendered light, so dark-only contrast debt was invisible (the #366 dark service-button failure shipped unseen). Captured against local `next dev` at staging-equivalent state. Same format/normalization as routes. Burn-down tracked alongside the light baseline (#40); the service-button entries here are the dark-theme face of brik-bds#827 (medium `-darker` service fills under white labels — marketing 2.87:1, brand 4.36:1).

BURN-DOWN 2026-06-06 (#369): removed the 3 /contact secondary-button entries (the mailto / tel / Calendly a[target=_blank] CTAs). globals.css client-overrides now re-fills the dark .bds-button--secondary (rest --color-grayscale-dark #5a5a5a 6.16:1, hover --color-grayscale-darker #333 11.29:1) against the near-white --text-primary label, matching the button's own dark :active fill. Verified 0 color-contrast on /contact dark against local next dev. First routesDark burn-down; remaining dark debt is the brik-bds#827 service-CTA cluster + breadcrumb/hero text.

BURN-DOWN 2026-06-06 (#375): cleared the ENTIRE remaining routesDark debt (the #827 dark face) — routesDark is now empty. Root cause was a single mechanism: BDS's dark root shifts three service token families one step lighter (`-darkest` → `-darker`) even though all three pair with the service SURFACE tints, which are fixed-light in both themes. globals.css client-overrides now re-points `--background-service-*-on-light`, `--surface-service-*-dark`, and `--text-service-*-on-light` back to their mode-invariant `-darkest` primitives in dark mode (fixes white-label primary buttons 2.86–4.35:1, accessible card CTAs 2.59–4.10:1, breadcrumb/ServiceTag/hero-lead 2.97:1); restores `--background-inverse` to the `-darker` step for the dark-label `.bds-button--inverse` hero price button per [data-audience]; and pins grayscale --text-primary/-secondary dark on a new `.service-surface` section marker (added to the fixed-light-tinted sections on services-line/-detail, /services callouts, /customers challenge cards, /customers/[slug] topic grids, /events) while restoring light text on the nested surfaced components (Card/PricingCard/hero-img-card/event form+speaker) that establish their own dark surface. Proper home is the BDS dark service ramp (brik-bds#827). Verified 0 dark color-contrast across all 16 routes (empty routesDark passes) against local next dev.

EXPANSION 2026-09-10 (#1360): one entry, /how-we-work `.bds-badge` — the route entered the axe set for the first time in #1360 and its dark pass surfaced a BDS defect, not brikdesigns CSS. `Badge appearance="subtle" tone="positive"` pairs `--surface-positive` (`#bef4d4`, identical in BOTH themes at dist/tokens.css:492 and :657) against `--text-positive`, which flips to mid-green `#27ae60` in dark on the documented assumption of a BLACK surface (dist/tokens.css:1746-1755: "On --surface-primary = black in dark mode ... clears AA at 7.31:1"). On the fixed-light fill that measures 2.33:1. No gate caught it because `--surface-positive` is not a background in brik-bds tokens/contrast-pairings.json at all — probed this session: `--text-positive` has exactly 2 rows (`--surface-primary`, `--page-primary`) and zero rows use `--surface-positive` as a bg. Filed as brik-bds#2402 (parented under brik-bds#526); the light pass needs no entry, and /plans never surfaced it because it renders the same tone at appearance="solid", a different rule. Baselined rather than fixed here on the operator's call, so #1360's route-coverage fix could land without waiting on a BDS release — BURN DOWN when brik-bds#2402 ships and the bump lands.

