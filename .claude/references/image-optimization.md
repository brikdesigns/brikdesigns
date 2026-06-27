---
last-verified: 2026-06-27
---

# Image optimization standard

How raster assets enter `public/` on brikdesigns.com. Enforced by
`scripts/lint-images.mjs` (husky pre-commit + the `verify` CI job) — the budget
below is CI-asserted, not advisory.

## Rules

1. **Format.** Photographs and illustrations ship as **WebP** (AVIF optional).
   Use PNG only for assets that need lossless transparency (logos, simple
   marks); SVG for vector. No new multi-MB PNG/JPEG sources.
2. **Dimensions.** Size the source to **~2× the largest render slot**, not the
   original export. A 180px avatar needs a ~600px source (covers 3× retina), not
   2400px. `next/image` downscales from there per device.
3. **Budget.** Every raster file under `public/` stays **under 300 KB**
   (`MAX_KB` in `scripts/lint-images.mjs`). This is a deliberate, reviewed
   ceiling — if an asset genuinely needs more, bump `MAX_KB` in the same PR with
   a one-line justification.

## Converting an image

`sharp` is already installed (it backs `next/image`). One-off:

```bash
node -e 'require("sharp")("in.png").resize(600,600,{fit:"cover"}).webp({quality:80}).toFile("out.webp")'
```

Quality 80 is the default for photos; raise to 85–90 only if banding shows.

## Why this exists

brikdesigns#625: the repo had shipped **8.3 MB** of raster images, including
three orphaned Webflow-port leftovers (`img-3.png` 3.4 MB, `dock-ladder.png`,
`rebrand-cs-block-img.png`) and two 2400×2400 headshots rendered at 180px.
`next/image` optimizes *delivery*, but oversized sources still cost optimization
CPU on first request and bloat the repo + Netlify deploy. The gate keeps it
honest. Post-cleanup `public/` raster weight: ~100 KB.

## CMS / Supabase images

Images uploaded through the portal CMS (`*.supabase.co`) are out of scope for
this gate — they're served through `next/image` too, but the source pipeline
lives in `brik-client-portal`. Assess Supabase image transforms there if CMS
asset weight becomes a problem.