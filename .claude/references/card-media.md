# Card media standard

Every image nested inside a card renders at **`--border-radius-md`** on a **`--surface-secondary`** well.

Canonical rule: the "Card media standard" block in [`src/app/(marketing)/shared-sections.css`](../../src/app/(marketing)/shared-sections.css).
Gate: [`tests/a11y/card-media.spec.ts`](../../tests/a11y/card-media.spec.ts) — measured, light + dark.
Origin: #1169, under round umbrella #1168.

## The rule

```css
.bds-card .bds-frame,
.bds-pricing-card .bds-frame {
  border-radius: var(--border-radius-md);
  background-color: var(--surface-secondary);
}
```

…plus the same radius on the frame's `> img / > video / > svg` child.

**Two values, two reasons:**

| Value | Why |
| --- | --- |
| `--border-radius-md` (12px) | Matches the card's own corner (`.bds-card`). BDS ships card media one step lower at `--border-radius-sm` (8px); site CSS is unlayered and BDS lives in `@layer bds-components`, so the site rule wins on layer order with no `!important`. Aligning the BDS default is [brik-bds#2257](https://github.com/brikdesigns/brik-bds/issues/2257). |
| `--surface-secondary` | Card art is routinely transparent PNG or letterboxed. The fill sits on the **Frame**, not the image, so the well is present whether or not an image loaded. |

**Why the image takes the radius too:** the Frame clips (`overflow: hidden`), so an image rounding tighter than its frame shows four slivers of the well through its corners.

## Derived, not enumerated

The selector keys on the **card structure** — any `Frame` inside any `Card` / `PricingCard` — so a new card grid inherits the standard with no edit to the rule.

This is deliberate and it is the whole design. The sibling "tinted bands shouldn't animate" rule shipped as a four-class allowlist in `ScrollReveal.tsx` and silently regressed every time a band was added; #1170 exists to undo that. Do not turn this block into a list of page classes.

**Corollary:** if a new card's media isn't picking up the standard, the fix is to build it from BDS `<Card>` + `<Frame>`, not to add its class name here.

## What is NOT card media

Heroes, media bands, the tooling ticker, testimonial rows, ambient fields. The standard is about media that sits inside a card's corner. These keep their own treatment and the gate does not sweep them.

## Hand-built card blocks — the migration and its exceptions

The derived selector reaches BDS cards only. Hand-built card blocks are plain `<div>`s with their own `__media` container, so they either repeat the two declarations by name or miss the standard entirely.

#1175 classified the ~12 such blocks and found they are three different jobs, not one:

1. **Mechanical** — already a BDS `<Card>`, media is a plain `<div>`. Swap the `<div>` for a `<Frame>` and it inherits the standard; delete the by-name CSS. `blog-card` migrated this way in #1175 (it was missing the radius entirely — the `<div>` had the well but no rounded corners).
2. **Conversion** — a hand-built `<div>` card. Becoming a BDS `<Card>` also picks up `card-treatment.md` chrome and BDS padding, so each needs per-route visual regression. Tracked in **#1191** (Tier 2 of #1175).
3. **Exception** — cannot cleanly become `.bds-card .bds-frame`, listed below. These stay hand-built by design.

### Documented exceptions (stay hand-built)

| Class | Route | Why it stays |
| --- | --- | --- |
| `plans-card-wrapper__media` | `/plans` | Media is a sibling **above** the `<PricingCard>`, not a `<Frame>` inside a `<Card>` — the derived selector can't reach it. On the standard by name in `plans.css`. |
| `story-card__media` | `/customers/[slug]`, `/customer-stories` | Nested `__media-wrap` > `__media` structure with its own aspect handling. |
| `services-callout-card__media`, `service-sibling-card__media` | `/services*` | The services section deliberately uses a **service-themed `--surface-accent` well**, not the neutral `--surface-secondary` standard. Migrating would erase the theming. Whether these should normalize is an open design decision on #1191. |

The gate's hand-built opt-in list (`card-media.spec.ts`) names only `plans-card-wrapper__media` — the one exception that carries the standard's exact radius/well by name. The service-themed wells are a deliberate different treatment, so the gate does not hold them to the neutral standard.

## Naming

Media containers are named `[block]__media` (#197). The convention is already near-universal — 29 site classes and 18 in BDS. BDS `<Image>` emits `bds-image__media` on its inner Frame for free.

**Note:** BDS `<Image>` renders a plain `<img>`, not `next/image`. Marketing card media uses `next/image` inside a `<Frame className="[block]__media">` instead, so the site keeps AVIF/WebP negotiation and responsive `srcset` (operator decision 2026-08-31, recorded on #1169). The home Monthly Subscription band is the one exception — it already used BDS `<Image>` before the standard landed.

## Related

- Card border/shadow: [`card-treatment.md`](card-treatment.md) — chrome is band-derived, this is media-derived; they don't interact.
- Page-layer vocabulary: [`page-anatomy.md`](page-anatomy.md)
- Image weight/format budget: [`image-optimization.md`](image-optimization.md)
