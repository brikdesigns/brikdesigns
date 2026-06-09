# Landing-page Block Catalogue

**Status:** spine document for the [#420 landing-page CMS](https://github.com/brikdesigns/brikdesigns/issues/420) — this is [#421](https://github.com/brikdesigns/brikdesigns/issues/421).

This is the **agreed block `type` vocabulary** that the block-based landing-page model is
built on. It defines, for each block: its `type`, the structured props the portal
composer collects, and the BDS component(s) it renders with. It is the contract that:

- **portal cluster A** ([#420](https://github.com/brikdesigns/brikdesigns/issues/420) data model) stores as ordered `blocks`, and
- **the renderer** ([#423](https://github.com/brikdesigns/brikdesigns/issues/423)) maps to BDS components.

It is documentation only — no migration, no render code, no template recompose lives here.

**Rules this catalogue inherits from [`COMPONENT-MAP.md`](../COMPONENT-MAP.md):**
NEVER write custom CSS for something BDS already provides. Every "BDS mapping" cell below
points at a row in `COMPONENT-MAP.md`; gaps are flagged as BDS candidates, not patched
locally. Block / slot names follow [Build Standards › Naming Principles](https://design.brikdesigns.com/docs/build-standards/naming-principles).

---

## Inventory sources

The vocabulary is derived from every section of four real pages — the two live ISR
templates plus the two un-migrated marketing pages the model must absorb:

| Source | Where | Status |
|---|---|---|
| `event` template | `src/app/(marketing)/events/[slug]/page.tsx` | live (ISR, [#335](https://github.com/brikdesigns/brikdesigns/issues/335)) |
| `newsletter` template | `src/app/(marketing)/marketing/[slug]/page.tsx` | live (ISR, [#336](https://github.com/brikdesigns/brikdesigns/issues/336)) |
| `free-marketing-analysis` | `src/app/(marketing)/free-marketing-analysis/page.tsx` | hardcoded React route |
| `brikdown-analysis` / `/newsletter` | Webflow (`brikdesigns.webflow.io`) | not migrated |

Field surface for the live templates today: `EventRow` in `src/lib/events.ts`.

---

## Block vocabulary

| `type` | Purpose | Structured props | BDS mapping (`COMPONENT-MAP.md`) | Accent? |
|---|---|---|---|---|
| `hero` | Title + tagline + optional media/logo | `eyebrow?`, `title`, `subtitle?`, `media?{url,alt}`, `accent_token?` | `PageHeader` + `Frame` (media); split-layout backgrounds = section CSS (allowed — "What is NOT in BDS") | ✅ |
| `rich-content` | Prose body — paragraphs, bullet lists, "we'll review" checklist, benefit copy | `html` (sanitized) | prose via `@/lib/styles` (`heading` / `text` / `list`); sanitized with `src/lib/sanitize.ts` | – |
| `event-meta` | Date / time / fee row | `date?`, `time?`, `fee?` | `Stack direction="horizontal"` + `Icon` + `label` style | – |
| `speaker` | Speaker name + bio (+ avatar) | `name`, `bio?`, `avatar?{url,alt}` | `Card variant="outlined"` / `Stack` | – |
| `logo-strip` | Sponsor / partner logos | `logos[]{url, alt, href?}` | `Stack` + `Frame fit="contain"` | – |
| `stats` | Metric / proof row | `items[]{value, label}` | `Grid columns="auto-fit"` + `Card` | – |
| `form` | Registration / lead / newsletter capture | `variant`(`registration`\|`lead`\|`newsletter`), `fields` (see Form variants), `submit_label?`, `source` | BDS form container ([Storybook › Containers/Form](https://storybook.brikdesigns.com/?path=/docs/containers-form--overview)) + `TextInput` + `Button` | ✅ (CTA) |
| `alert-banner` | "Event ended" + arbitrary contextual banner | `variant`(`ended`\|`info`\|`custom`), `message`, `action?{label,href}` | `Banner` — generalizes the bespoke `EventEndedBanner` (`src/components/marketing/EventStatusBanner.tsx`) | – |
| `cta` | Heading + body + button(s) | `heading`, `body?`, `buttons[]{label, href, variant}` | `Button` / `LinkButton`; section background = section CSS | ✅ (CTA) |
| `cross-reference` | Related stories / services + "past newsletters" list | `source`(`customer_stories`\|`services`\|`newsletters`), `limit?`, `layout?` | `CardGrid` + `Grid` + `Card preset="display"` / `CardTestimonial` | – |

The BDS **form container** + `TextInput` are real BDS exports (`import { Button, TextInput } from '@brikdesigns/bds'`) but are **not yet rows in `COMPONENT-MAP.md`** — add them when #423 builds the `form` block, so the map stays the single source of truth.

**Composition fields** (stored by portal cluster A, rendered by #423):
ordered `blocks[]` + a retained **`layout`** field — the schema seam for the future
layout switcher ([#424](https://github.com/brikdesigns/brikdesigns/issues/424)), kept now so the switcher is a UI addition, not a migration.

### Form variants — field shapes

Sourced from the existing form components (to be unified onto the BDS form container):

| `variant` | Fields (`name`) | Source component | `source` value |
|---|---|---|---|
| `registration` | `first_name`, `last_name`, `email`, `phone?`, `company_name?` (+ `website_url` honeypot) | `EventRegistrationForm` (`variant="event"`) | `event_signup` |
| `newsletter` | `first_name?`, `last_name?`, `email` (+ honeypot) | `EventRegistrationForm` (`variant="newsletter"`) | `newsletter_signup` |
| `lead` | `name`, `email`, `company_name`, `phone?`, `message?` (+ honeypot) | `LeadCaptureForm` | `marketing_analysis` |

Per-field label overrides come from the existing `form_config` pattern (`fieldLabel()` in
`src/lib/events.ts`) — e.g. the configurable `company_name` label.

### `cross-reference` shares the CMS picker

The `cross-reference` block's data picker is the **same** picker needed by
[#422](https://github.com/brikdesigns/brikdesigns/issues/422) (related story / service blocks) and
[#405](https://github.com/brikdesigns/brikdesigns/issues/405) (related services on blog). **Build once** — do not duplicate.
The "Past Newsletters" list on the Webflow `/newsletter` page is the `source="newsletters"` case.

---

## Traceability — every inventoried section maps to a block

Zero gaps: each section of all four sources resolves to a `type` above.

| Page | Section (top → bottom) | Block `type` |
|---|---|---|
| `event` | hero image → title → date/time/fee → description → speaker → sponsors → register form / ended banner | `hero` → `event-meta` → `rich-content` → `speaker` → `logo-strip` → `form`(`registration`) / `alert-banner`(`ended`) |
| `newsletter` | hero → title → description → sign-up form / ended banner | `hero` → `rich-content` → `form`(`newsletter`) / `alert-banner`(`ended`) |
| `free-marketing-analysis` | headline + lead → body → "we'll review" checklist → benefit line → lead form | `hero` → `rich-content` (checklist + benefit are prose) → `form`(`lead`) |
| `brikdown-analysis` (Webflow) | logo hero → value-prop headline+body → review checklist → benefit statement → contact form | `hero` → `rich-content` → `form`(`lead`) |
| `/newsletter` (Webflow) | logo hero → description → **past-newsletters list** | `hero` → `rich-content` → `cross-reference`(`newsletters`) |

`stats` and the contextual (`info`/`custom`) `alert-banner` aren't present in the four
pages but are named in the Notion content-structure / open-questions list — included so
the vocabulary is forward-covering without a later migration.

---

## Foundation gate — color is owned by BDS, not by blocks

> **Decision (2026-06-09): gate accent-bearing blocks on the BDS token-pairing
> foundation. No per-block color overrides.**

Accent-bearing blocks (`hero` tint, `form` card accent border, `cta` / button on accent,
any `.service-surface` section tint) consume **service-accent + `theme-brand-brik`**
light/dark tokens. The token families exist and are validated against the canonical
registry (`brik-bds/dist/tokens.css`):

- `--surface-service-{slug}-{light|dark}`
- `--background-service-{slug}-on-light`
- `--text-service-{slug}-on-dark`
- `.theme-brand-brik` (theme class)

…where `{slug}` ∈ `brand | marketing | product | back-office | information`.

**These blocks are BLOCKED for build** until a BDS foundation decision confirms the
`theme-brand-brik` + service-accent **light/dark pairings pass WCAG AA** for the
`(surface, text, button-variant)` combinations the blocks need:

- The known failures are the **service-line ramps** — [brik-bds#827](https://github.com/brikdesigns/brik-bds/issues/827)
  (product 4.26:1, back-office 4.32:1 light; dark `-darkest`→`-darker` shift) and its
  consumer cleanup [brikdesigns#429](https://github.com/brikdesigns/brikdesigns/issues/429).
- If cataloguing/build surfaces a **brand-theme base pairing** that also fails AA, that
  is a **new BDS foundation issue** — never patched in a block.

**Hard rule — no per-block color overrides.** The current event-template workaround
(`serviceColor().ctaBg` / `ctaText` in `src/lib/tokens.ts` + the `.service-surface`
re-pin in `src/app/globals.css`) is exactly the per-page color-fixing pattern we are
retiring (#429). Blocks consume **native BDS tokens only** and pick the **correct button
variant** (`primary` brand-fill / `on-color` on brand backgrounds / `inverse` on dark)
per `COMPONENT-MAP.md`; they never re-point a token to dodge a contrast failure. A
failing pairing is fixed at the foundation, once, for every consumer.

Net: the **structure** of every block (vocabulary, props, BDS mapping) is settled by this
catalogue now. The **accent values** are pinned to the tokens above but are **not blessed
for build** until the foundation decision lands.

---

## Out of scope (tracked elsewhere)

- Portal cluster A data model — blocks `jsonb` + `layout` + first-class `alert_banner` field ([#420](https://github.com/brikdesigns/brikdesigns/issues/420) A).
- Render + migrate `free-marketing-analysis` / `brikdown-analysis` off hardcoded routes ([#423](https://github.com/brikdesigns/brikdesigns/issues/423)).
- Recomposing the bespoke template CSS (`event-page__*`, `marketing-page__*`, `fma-*`) onto BDS components — #423.
- Layout switcher ([#424](https://github.com/brikdesigns/brikdesigns/issues/424)); LLM-authored content (#420 G).
