# Service-token decision tree

Read this **before** writing any CSS that tints a section, card, badge, tag, button, border, or text by service-line audience. The canonical names live in `node_modules/@brikdesigns/bds/dist/tokens.css` (search for "Service-line tokens"); this file is the agent-facing decision rule that maps those names to use.

> The recurring confusion isn't "what tokens exist" — it's "the same color ramp maps to two families with different intents." Either compiles. The wrong family is silently wrong until canon shifts.

---

## The five service lines

| Audience slug   | Palette primitive | Use in component |
|-----------------|-------------------|------------------|
| `marketing`     | `--color-green-*`   | green-tinted UI |
| `brand`         | `--color-yellow-*`  | yellow-tinted UI |
| `information`   | `--color-blue-*`    | blue-tinted UI |
| `product`       | `--color-purple-*`  | purple-tinted UI |
| `back-office`   | `--color-orange-*`  | orange-tinted UI |

These five slugs (and only these) are valid in any `--*-service-{slug}` token name.

---

## The four token families (layer canon)

| Family                          | Intent                                                | Examples of what consumes it |
|---------------------------------|-------------------------------------------------------|------------------------------|
| `--surface-service-{slug}`      | Container surface — sections, cards, hero bands       | `<section>`, page hero, `Card` outer fill |
| `--background-service-{slug}`   | Component background — small tinted fills             | `Badge`, `ServiceTag`, `Pill`, `Button` bg |
| `--border-service-{slug}`       | Component border                                      | `Card` border, divider line, focused outline |
| `--text-service-{slug}`         | Text on any of the above                              | Heading on tinted hero, label inside a tag |

**The rule:** if it's a *broad area you're tinting*, use `surface`. If it's a *small component with its own bounded shape*, use `background`. Same color ramp under the hood — different semantic intent, different downstream behavior when canon evolves.

---

## The two modifier axes

The canon has two orthogonal modifier axes, applied to **different** families:

### TONE (`-light`, `-dark`) — only on `surface`

- `--surface-service-{slug}-light` → pastel version of the surface (mode-invariant)
- `--surface-service-{slug}-dark`  → deep version of the surface (mode-invariant)

Tone is mode-invariant: `-light` stays light in both light and dark mode; `-dark` stays dark in both. Use tone when you want to *pin* a specific shade regardless of theme.

There is **no** `--background-service-{slug}-light` / `--border-service-{slug}-dark` / `--text-service-{slug}-light`. Tone is surface-only.

### CONTEXT (`-on-light`, `-on-dark`) — only on `background`, `border`, `text`

- `--background-service-{slug}-on-light` → the component fill to use *when sitting on a light surface*
- `--background-service-{slug}-on-dark`  → the component fill to use *when sitting on a dark surface*
- Same for `--border-*` and `--text-*`

Context is mode-invariant: `-on-light` pins the value for a light backdrop regardless of theme. Use context when the surface beneath the component is **known and fixed**.

There is **no** `--surface-service-{slug}-on-light`. Context is for the things that sit *on* surfaces, not for surfaces themselves.

### There is no per-line `-inverse`

⚠️ **Anti-pattern:** there is **no** `--{family}-service-{slug}-inverse` token in any family — not `--background-service-{slug}-inverse`, not on `surface`/`text`/`border`. (Grep `dist/tokens.css`: zero matches on 0.97.4.) A service line does **not** carry a per-line inverse companion. It adapts via the `-on-light` / `-on-dark` **context** axis above.

When a component needs a fill that reads against a *known* backdrop — e.g. a CTA button on a `surfaceLight` service band — use the `background` context token for that backdrop: `--background-service-{slug}-on-light` (on a known-light surface) or `--background-service-{slug}-on-dark` (on a known-dark one). That is the canonical replacement for the "inverse CTA fill" idea.

### Mode-awareness summary

| Token shape                                   | Mode-aware? |
|-----------------------------------------------|-------------|
| `--{family}-service-{slug}` (no suffix)       | **Yes** — flips in dark mode |
| `--surface-service-{slug}-{light\|dark}`      | No — pinned tone |
| `--{family}-service-{slug}-on-{light\|dark}`  | No — pinned context |

---

## Decision tree

**Q1: What am I tinting?**

1. **A section / hero / page band / card outer fill** → `--surface-service-{slug}` family
2. **A small component (badge, tag, pill, button bg)** → `--background-service-{slug}` family
3. **A border on a component** → `--border-service-{slug}` family
4. **Text** → `--text-service-{slug}` family

**Q2: Do I need to pin the shade?**

- **No, follow the theme** → default token, no suffix (e.g. `--surface-service-marketing`)
- **Yes, always pastel** → `-light` suffix (surface only)
- **Yes, always deep** → `-dark` suffix (surface only)

**Q3: Is the component sitting on a known-light or known-dark surface?**

(Applies only to `background` / `border` / `text` families.)

- **On a known light surface** → `-on-light` suffix
- **On a known dark surface** → `-on-dark` suffix
- **Surface is theme-following** → default token, no suffix (the canon flips it in dark mode)

**Q4: Do I need a fill that reads against a known backdrop (e.g. a CTA on a service band)?**

- There is **no** per-line `-inverse` token — see the anti-pattern above. Route to the `background` **context** token for the backdrop the component sits on: `--background-service-{slug}-on-light` on a known-light surface, `--background-service-{slug}-on-dark` on a known-dark one (Q3 axis). In TSX this is the wrapper's `onLight` key.

---

## Concrete examples from this repo

### Section-level service tint (hero, callout) — use `surface`, pale `-light` tone

The service detail page at [`src/app/(marketing)/services/[serviceLineSlug]/[serviceSlug]/page.tsx`](../../src/app/(marketing)/services/[serviceLineSlug]/[serviceSlug]/page.tsx) tints its hero with `serviceTokens.surfaceLight` (= `--surface-service-{audience}-light`). This is correct on two axes: the hero is a broad page-level **surface** (family), and a text-bearing hero/band uses the pale **`-light` tone**. #389 moved the services pages to `surfaceLight`; #408 extended pale heroes/bands site-wide (plans, customers, customer-stories, services callouts). Pale surface + dark on-tint copy is the AAA-validated pairing retargeted in brik-bds#838 — prefer `-light` over the mid-tone no-suffix token for any hero/band that carries heading or body text.

```css
/* Right — text-bearing hero band: pale -light surface */
.hero {
  background: var(--surface-service-marketing-light);
}
```

```tsx
/* Right — typed wrapper (preferred in TSX) */
const t = serviceColor('marketing');
<section className="service-surface" style={{ backgroundColor: t.surfaceLight }}>
```

Add `className="service-surface"` to the section. The `-light` tone is mode-invariant (the tint never flips), but theme-responsive copy does: in dark mode the `:root[data-theme="dark"] .service-surface` pin in [`src/app/globals.css`](../../src/app/globals.css) re-points inherited `--text-primary` / `--text-secondary` to the mode-invariant `--color-grayscale-darkest` so heading/body stays dark on the still-light tint. Nested components that establish their own dark surface — `Card`, `PricingCard`, the hero image-card price block — are carved out of the pin and keep their light text.

**Exception — card-image backdrops stay mid-tone `surface`.** `PlanCardGrid`'s card-image backdrop deliberately uses the no-suffix mid-tone `--surface-service-{slug}` — that's card chrome, not a text-bearing band (#482 / #454). And the service-tinted CTA button pairing (brik poppy at 6.23:1, AA) is owned by #437 / brik-bds#868, not this rule.

### Service tag / badge — use `background`

`ServiceTag` consumes `--background-service-{slug}` for its fill. This is correct: a tag is a small bounded component, not a section.

```css
/* Right — tag is a component */
.service-tag--marketing {
  background: var(--background-service-marketing);
  color: var(--text-service-marketing-on-light); /* tag sits on light card surface */
}
```

### Card border accent — use `border`

```css
/* Right — border on a card */
.card--marketing {
  border-color: var(--border-service-marketing);
}
```

### Typed wrapper (preferred in TS/TSX)

For React components, **never** write raw `var(--...)` strings. Import the typed wrapper from [`src/lib/tokens.ts`](../../src/lib/tokens.ts):

```ts
import { color, serviceColor } from '@/lib/tokens';

const tokens = serviceColor('marketing');
// tokens.surface  = 'var(--surface-service-marketing)'
// tokens.bg       = 'var(--background-service-marketing)'
// tokens.text     = 'var(--text-service-marketing-on-light)'
// tokens.onLight  = 'var(--background-service-marketing-on-light)'  // fill on a known-light backdrop
```

The wrapper hides the family selection — `bg` is for components, `surface` is for containers. Picking the right key in the wrapper is the same decision as picking the right family in raw CSS.

---

## Anti-patterns

### Wrong family on a section

```css
/* WRONG — background-service-* is for components, not sections */
.hero {
  background: var(--background-service-marketing);
}
```

The color *looks* right (it's the same green ramp) but the canonical intent is wrong. When BDS evolves the `background-*` family (e.g. tightens it to a smaller tinted bbox), the hero will silently break.

### Wrong family on a tag

```css
/* WRONG — surface-service-* is for containers */
.service-tag {
  background: var(--surface-service-marketing);
}
```

Same problem in reverse. A tag is a component; using `surface` couples it to section-level evolution.

### Inventing a name

```css
/* WRONG — invented modifier, fails token-lint */
background: var(--surface-service-marketing-inverse);  /* no -inverse on surface */
background: var(--background-service-marketing-light); /* no -light on background */
color: var(--text-service-marketing-inverse);          /* no -inverse on text */
```

The modifier matrix is asymmetric. If a name isn't in `dist/tokens.css`, it doesn't exist. **Never invent — surface the gap to the user instead** (cross-repo: file in `brik-bds`).

### Wrong modifier for dark mode

```css
/* WRONG — pinning context when the surface is theme-following */
.section .badge {
  background: var(--background-service-marketing-on-light);
}
/* If the section is `--surface-service-marketing` (theme-following), this
   pins the badge for light mode and breaks contrast in dark mode. Use the
   default `--background-service-marketing` instead — it flips. */
```

Context modifiers (`-on-light`, `-on-dark`) are correct when the surface beneath is **pinned** (`-light` or `-dark` tone, or a non-service surface). When the surface flips with theme, the component fill should flip too — use the default token.

### Hand-rolling a service-color object

```ts
/* WRONG — duplicates src/lib/tokens.ts */
const services = {
  marketing: { bg: '#bcff8c', text: '#0a2a07' },
  // ...
};
```

Always import from `@/lib/tokens`. Hand-rolled hex hardcodes a single mode, can drift from canon, and bypasses the wrapper's selection guidance.

---

## Source of truth

- **Canon definition** — `node_modules/@brikdesigns/bds/dist/tokens.css` lines 980–1130 (light mode) and 1132+ (dark-mode overrides). Read the comment block at line 980 for the authoritative description.
- **Typed wrappers** — [`src/lib/tokens.ts`](../../src/lib/tokens.ts) `color.service.*`
- **Component map** — [`COMPONENT-MAP.md`](../../COMPONENT-MAP.md)
- **CSS layer order** — [`src/app/globals.css`](../../src/app/globals.css)
- **Upstream canon docs** — `brik-bds#564` (5-layer composition model), `brik-bds#576` (`-inverse` modifier semantics), `brik-bds#563` (Figma ↔ canonical reconciliation)
- **Enforcement** — `npm run lint:tokens` enforces both invented-token and family-mismatch checks. Both gates are live as of brikdesigns#110.

---

## If this doc is wrong

If you find a service-token usage in this repo that contradicts the rule above, **don't silently fix it** — comment on `brikdesigns#117` (service detail page family audit) with the file:line and what you'd change. That issue exists to convert real-world miss-uses into lint fixtures.

If canon itself changes (new modifier, new family, dropped name), update this doc **first**, then update consumers. The doc lags reality is how confusion gets re-introduced.
