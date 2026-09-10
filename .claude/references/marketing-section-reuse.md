# Marketing-section reuse — which class to use for each Figma frame

**last-verified:** 2026-09-10

Figma names the marketing sections `section-hero`, `section-pricing`, `section-type`,
`section-contact`. This file answers, for each frame, **which class to write and which
stylesheet to import** — so scoping a new marketing page costs one read instead of eight.

Interim measure. The end state (promoting the vocabulary into `shared-sections.css` under
the Figma names) is #1289 slice 2 and is **not ratified** — do not pre-empt it by inventing
a new shared class. Use the table.

## The table

| Figma frame | Class to write | Lives in | Import in `page.tsx` |
|---|---|---|---|
| `section-hero` | `.section-hero` | [homepage.css:11](../../src/app/(marketing)/homepage.css#L11) | `import '../homepage.css'` |
| `section-pricing` | `.section-pricing` + `.pricing-header` | layout [homepage.css:691](../../src/app/(marketing)/homepage.css#L691), [:703](../../src/app/(marketing)/homepage.css#L703) | `import '../homepage.css'` |
| `section-type` | `.hiw-practice` | [how-we-work.css:436](../../src/app/(marketing)/how-we-work/how-we-work.css#L436) | `import '../how-we-work/how-we-work.css'` — no precedent yet, see below |
| `section-contact` | `.cta-section-brand` + `.cta-card-brand` | [shared-sections.css:116](../../src/app/(marketing)/shared-sections.css#L116), [:122](../../src/app/(marketing)/shared-sections.css#L122) | already shared — `import '../shared-sections.css'` |

## Two layers, not one — `section-pricing` and `section-type` are split

`.section-pricing` and `.hiw-practice` are **partly** shared already. Their *layout* is
page-local; their *card-chrome band rules* are in `shared-sections.css`:

| Class | Shared half (already in `shared-sections.css`) |
|---|---|
| `.section-pricing` | [:845](../../src/app/(marketing)/shared-sections.css#L845) non-highlighted pricing card, [:876](../../src/app/(marketing)/shared-sections.css#L876) header, [:901](../../src/app/(marketing)/shared-sections.css#L901) description |
| `.hiw-practice` | [:823](../../src/app/(marketing)/shared-sections.css#L823) `.bds-card` chrome |

So you get the chrome for free from `shared-sections.css` and must import the page-local
stylesheet for the layout. Importing only one of the two renders a correctly-chromed section
with no layout, or a laid-out section with the wrong card chrome — and neither failure names
its own cause.

Card chrome specifically is derived from the band's measured luminance, never a `variant`
prop — see [card-treatment.md](card-treatment.md). The rules above are that mechanism; do
not restate them per page.

## The sanctioned import path

There are two distinct moves, and only one of them is unremarkable.

**1. Importing `shared-sections.css` — always correct, 13 existing consumers.**

```tsx
import '../shared-sections.css';
```

It is the shared layer. Every marketing page imports it
([`services/page.tsx:7`](../../src/app/(marketing)/services/page.tsx#L7),
[`about/page.tsx:9`](../../src/app/(marketing)/about/page.tsx#L9),
[`plans/page.tsx:17`](../../src/app/(marketing)/plans/page.tsx#L17), …).

**2. Importing another page's stylesheet — sanctioned, but only 3 precedents.**

```tsx
import '../homepage.css';
```

This is the move that reads as a mistake and is not. Every precedent:

| Consumer | Imports | Why |
|---|---|---|
| [`blog/page.tsx:9`](../../src/app/(marketing)/blog/page.tsx#L9) | `../homepage.css` | reuses `.section-hero` |
| [`plans/page.tsx:21`](../../src/app/(marketing)/plans/page.tsx#L21) | `../homepage.css` | reuses `.section-hero` + `.section-pricing` (#1287) |
| [`customers/[slug]/page.tsx:20`](../../src/app/(marketing)/customers/[slug]/page.tsx#L20) | `../../results/results.css` | reuses the results-card layout |

Prefer it over hand-porting ~100 lines into a new page's stylesheet. A port forks the
section: the two copies then drift, which is how 8 hero implementations accumulated for one
Figma frame (see below).

## The caveat that bites: CSS is bundled per route

A class is available on a route **only if that route's `page.tsx` imports the stylesheet
that defines it.** The file tree tells you nothing.

`.section-hero` is defined once in `homepage.css`, and resolves on `/`, `/blog`, and
`/plans` — the three routes that import it — and on no other route. Adding the class to a
page's markup without adding the import renders an unstyled section, with no error at build
time and no error in the console.

Verified against the build output, 2026-09-10 — for each prerendered route, whether any CSS
chunk it links defines the class:

```bash
for r in index plans about value how-we-work; do
  f=.next/server/app/$r.html; hit=no
  for c in $(grep -o '/_next/static/chunks/[^"]*\.css' "$f" | sort -u); do
    grep -q '\.section-hero' ".next/static/${c#/_next/static/}" && hit=yes
  done
  printf '%-12s section-hero=%s\n' "$r" "$hit"
done
```

```text
index        section-hero=yes    ← imports ../homepage.css
plans        section-hero=yes    ← imports ../homepage.css
about        section-hero=no
value        section-hero=no
how-we-work  section-hero=no
```

So: **when you write a class from the table above, add its import in the same change.**

## Why the vocabulary drifted — 8 heroes for one frame

```bash
rg -n '^\.[a-z-]*hero[a-z_-]* \{' src/app --glob '*.css' | grep -v '__'
```

Section-level hero classes, verified 2026-09-10:

| Class | File |
|---|---|
| `.page-hero` | [shared-sections.css:15](../../src/app/(marketing)/shared-sections.css#L15) |
| `.page-hero-blueprint` | [shared-sections.css:307](../../src/app/(marketing)/shared-sections.css#L307) **and** [services.css:66](../../src/app/(marketing)/services/services.css#L66) — duplicated |
| `.section-hero` | [homepage.css:11](../../src/app/(marketing)/homepage.css#L11) |
| `.about-hero` | [about.css:9](../../src/app/(marketing)/about/about.css#L9) |
| `.value-hero` | [value.css:105](../../src/app/(marketing)/value/value.css#L105) |
| `.hiw-hero` | [how-we-work.css:51](../../src/app/(marketing)/how-we-work/how-we-work.css#L51) |
| `.service-detail-hero` | [services.css:79](../../src/app/(marketing)/services/services.css#L79) |
| `.customer-detail-hero` | [customers.css:125](../../src/app/(marketing)/customers/customers.css#L125) |

Do not add a ninth. For a new marketing page's hero, use `.section-hero` per the table.
`.page-hero` and `.page-hero-blueprint` are the pre-existing shared pair and stay where
they are until slice 2 reconciles them.

## References

- Umbrella: #1289 (this file is slice 1; slice 2 = promote into `shared-sections.css`,
  slice 3 = re-triage brik-bds#477 Workstream A — **neither is ratified**)
- Upstream: brik-bds#477 — merged 2026-05-09, **specs only**; the React section renderers
  it named as Workstream A never shipped, so BDS is not currently a destination for this
  layer
- Layer vocabulary (Section → Layout → Container → Block → Component):
  [page-anatomy.md](page-anatomy.md)
- Class naming (`__title` / `__description` canonical):
  [naming-conventions.md](naming-conventions.md)
- Every top-level `<section>` carries a stable id: [section-identification.md](section-identification.md)
