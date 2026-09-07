# Card treatment standard

**last-verified:** 2026-08-25

The border/shadow chrome of a `<Card>` is decided by the **band it sits on**, not
by a `variant` prop. This is the single source of truth; it is enforced by
`tests/a11y/card-treatment.spec.ts`.

| Band | Background | Card chrome |
|---|---|---|
| **Default (white)** | `--surface-primary` | **border, no shadow** |
| **Light tint** | `--surface-secondary` / `--surface-accent` / service tint | **shadow, no border** |
| **Dark** | any band whose relative luminance < 0.18 | **border, no shadow** |

Both themes are gated (#980). The discriminator is the band's measured
**luminance**, not `data-theme`, because a shadow only defines a card when the
surface underneath is light enough for a dark shadow to read against:

```css
--box-shadow-md:    rgba(0, 0, 0, 0.08);  /* 8% black, both themes */
--surface-primary:  rgb(0, 0, 0);         /* dark root */
--border-secondary: rgb(176, 176, 176);   /* dark root */
```

An 8%-black shadow over black is **invisible**. Roughly 50 cards across the
audited routes rendered no-border/shadow in dark mode before #980; the ones on a
band that goes dark had no visible boundary at all.

The theme is the wrong question because some bands stay **pale in dark mode**:
the service tints are fixed-light in both themes (`.service-surface` measures
rgb(178,227,245) … rgb(255,236,172) in the dark root), and a dark shadow reads
fine on those. A rule written as "border everywhere in dark" borders those
pale-band cards and fails the dark project on five routes — `/services`,
`/services/brand`, `/services/brand/logo-design`,
`/services/back-office/crm-setup-and-data-cleanup`, `/customers/dental` — over
five distinct pale band values. The gate catches it.

## How it's implemented

- **White band** = the BDS `<Card>` default (bordered, flat). A card on a white
  band should carry **no `variant`** — the default is already correct.
- **Tinted band** = one CSS rule in `src/app/(marketing)/shared-sections.css`
  (search "Card chrome by band") strips the border and adds `--box-shadow-md`
  for every `.bds-card` on a tinted section.
- **Dark band** = a `:root[data-theme="dark"]` rule directly below it restores
  the BDS `--outlined` values (border, no shadow) for the tinted sections whose
  neutral surface goes dark. It deliberately omits `.service-surface` and
  `.plan-cta-panel`, which stay pale in dark mode and keep their elevation.

Do **not** set `variant="raised"` or `variant="elevated"` to elevate a card, and
do **not** add a per-page CSS override to fix one section's chrome. Both are how
this drifted for a year (#360 → #558 → #799 → #970): the variant forced
elevation regardless of band, so cards shipped elevated on white and each fix
patched one page while others stayed wrong.

## Exceptions (allowlisted in the gate)

- `.bds-card--borderless` — transparent by design (quote / challenge cards). The
  standard is for opaque cards only.
- `.bds-pricing-card--highlighted` — the featured pricing tier keeps its
  brand-colored ring on a tint as intentional emphasis.

## Adding a new tinted section

If you paint a section with `--surface-secondary`/`--accent`/a service tint under
a **bespoke class** (not `.page-section--secondary/--accent`), add that class to
the "Card chrome by band" selector list in `shared-sections.css`. If you forget,
the gate fails by name on CI rather than shipping a white-treatment card on a
tint — that failure is the safety net, not an afterthought.

## Why the gate is a measured Playwright sweep

The chrome that renders is the product of the BDS variant **and** every CSS
override that fights it, so a static `variant=` grep misses cases (#970 proved a
card can carry `variant="raised"` yet render bordered via a CSS override). The
gate reads the **computed** border/shadow of every card on every route, so it
can't be fooled by that, and it can't miss a page — which is how the manual
one-route-at-a-time audits kept producing false "all clear" results.

## Prerequisite: a card must BE a `<Card>` (#1260)

Everything above only reaches an element that actually rendered as `.bds-card`.
A hand-rolled `<div className="x-card">` renders fine, is never touched by the
"Card chrome by band" rule, and is invisible to `card-treatment.spec.ts` — which
can only measure cards that exist. A 2026-09 audit found ~36 site-local `*-card`
classes against ~37 BDS `<Card>` instances, 19 of them hand-rolled, with chrome
drifting per page and the suffix `-card` doing three unrelated jobs (a Container,
a media slot, and a whole Section shell).

So: **if a class calls itself a card, render it on `<Card>`.** Gated by
`scripts/lint-card-class.mjs` (`npm run lint:card-class`, pre-commit + CI) — a
static gate, because the failure is a `<div>` in the JSX, not a computed style.

What it judges: a class name that is (a) defined in a stylesheet under `src/`,
(b) reads as a card (`card` as a `-`/`_`-delimited word), (c) is a BEM **block**
— not an `__element` or `--modifier`, which are judged through their block — and
(d) is actually applied in a `className`. `bds-*` is excluded as BDS-owned.

### The deliberate non-Cards

Grandfathered in `scripts/card-class-baseline.json` as a name → reason map, so a
keep carries its justification where the next reader will look. Two shapes
recur, and both are legitimate:

- **A semantic element the Card can't be.** `about-team-card`, `hiw-card` are
  `<article>`s; BDS `Card` renders a `<div>`/`<a>` and exposes no `as` prop, so
  converting would trade correct document semantics for shared chrome.
- **A misnamed layer.** `contact-card` is a 1100px page panel on a full-viewport
  brand band; `cta-card-brand` is a Section-level CTA panel; `plans-card-wrapper`
  is a grid cell around a `PricingCard`. Per
  [`page-anatomy.md`](page-anatomy.md) these are Containers, not Components —
  they carry `-card` in the name only by history.

The ratchet runs both ways: a new unbacked card fails, and a baselined name that
has since been converted or deleted **also** fails, so the list can never
overstate the remaining debt. Only ever remove entries.
