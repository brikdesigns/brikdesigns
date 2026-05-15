# Data canonical-fields policy

`audit:cms-drift` compares Supabase rows against Webflow CSV exports. The comparison itself is neutral — this doc encodes the **policy** for which side is canonical for each kind of field, so future contributors don't reflexively "fix" a divergence in the wrong direction.

## The framing

The brikdesigns.com rebuild is a migration **away from Webflow** onto Next.js + Supabase + BDS. Webflow is not the source of truth for the rebuild — it's a legacy data export we're pulling content from. Concretely:

| Concern          | Canonical source                                                          |
|------------------|---------------------------------------------------------------------------|
| Design tokens    | **BDS** (`@brikdesigns/bds/dist/tokens.css`) — always                     |
| Content + copy   | Webflow CSV → Supabase migration; Supabase becomes canonical after import |
| Structural slugs | Decision per slug; Supabase becomes canonical after rebuild               |

The CSV is not a long-term peer of Supabase. Once the migration completes and Webflow is decommissioned, the CSV becomes a frozen historical artifact and the audit retires. Until then, the audit catches *content* drift (rows missing/orphaned, copy diverging) — but not *design* drift, because design has its own source (BDS) that neither side is allowed to override.

## Canonical sources by field

### BDS-canonical (audit does NOT compare)

These fields are populated in Supabase from BDS token strings. The CSV holds raw values left over from the original Webflow build. Comparing them is noise — they cannot agree by construction, and the CSV side will never be updated (Webflow is being decommissioned).

| Table           | Field(s)                                                    | Stored as                                        |
|-----------------|-------------------------------------------------------------|--------------------------------------------------|
| `service_lines` | `brand_color_light`, `brand_color_base`, `brand_color_dark` | BDS token strings (e.g., `--color-orange-light`) |

The audit script marks these with `canonicalSupabase: true` and skips field-level drift comparison for them.

### Supabase-canonical (CSV pulled in once, then Supabase wins)

Default for content fields that have already been imported. After the import, the editing surface is the admin UI (Supabase) — the CSV is frozen. Reconciliation pulls forward newer CSV values only during the active migration window.

### CSV-canonical (currently only the migration window)

During the active rebuild, missing-in-Supabase rows (CSV has it, Supabase doesn't) and field drift in matched pairs both indicate "the CSV has content we haven't imported yet." Action: import into Supabase via admin UI. Once `audit:cms-drift` reads 0/0/0 across the board, CSV-canonical effectively retires — Supabase becomes the sole source.

## Slug aliases (join-key reconciliation)

Distinct from the field-level `canonicalSupabase` flag above: when Supabase and the CSV hold the **same row** but under **different slugs** (Webflow long-form vs Brik-canonical short-form), the audit's slug-based join can't recognize them as a pair and reports them as orphan + missing simultaneously. The fix is a per-table CSV-slug → SB-slug alias map (`csvToSbAliasMap`).

Same framing applies: Supabase wins. The CSV is a legacy export.

| Table           | Map name               | Pairs                                                                                         |
|-----------------|------------------------|-----------------------------------------------------------------------------------------------|
| `service_lines` | `SERVICE_LINE_ALIASES` | 5 (all line slugs — Webflow long-form `brand-design`/etc → canonical short-form `brand`/etc)  |
| `services`      | `SERVICES_ALIASES`     | 7 (1 typo correction + 6 Webflow→Brik rename)                                                 |

The maps live in `scripts/audit-supabase-drift.ts` near the top of `main()`. Each entry should be **verified by name match** between the two sides before adding — if the names don't match exactly, you're probably looking at two genuinely different rows, not an alias.

## How to add a new BDS-canonical entry

1. Add a row to the table above (Table / Field(s) / Stored as).
2. In `scripts/audit-supabase-drift.ts`, mark the field with `canonicalSupabase: true` so the audit skips it.
3. Confirm the Supabase column already holds the canonical (token / BDS-derived) value. If not, populate it via the admin UI before flipping the flag — otherwise the audit silently passes over a real gap.

## How to add a new slug alias

1. Confirm CSV-slug and SB-slug refer to the same row by **exact name match** (and ideally one other corroborating field — description, image URL).
2. Add the entry to the relevant `*_ALIASES` map in `scripts/audit-supabase-drift.ts`.
3. Re-run `npm run audit:cms-drift`. The pair should drop from orphan+missing and reappear in the matched-rows section — possibly surfacing real field drift for the first time.
4. Do NOT add an alias to mask real drift (different rows that happen to look similar). The alias is for the rename / canonicalization case only.

## What this doc explicitly is NOT

- It is **not** a list of fields where Supabase happens to differ from CSV right now. That's noise, not policy.
- It is **not** a list of fields to back-port into Webflow. We are not back-porting *anywhere* into Webflow — Webflow is end-of-life for this surface.
- It is **not** a substitute for the audit. The audit still catches every divergence; this doc tells you which divergences are signal vs. which are by-design skips.

## Related

- [#149](https://github.com/brikdesigns/brikdesigns/issues/149) — CSV ↔ Supabase drift reconciliation umbrella
- PR #148 — `audit:cms-drift` infra repair (the tool itself)
- PR #153 — initial (now-superseded) framing of this doc
- `scripts/audit-supabase-drift.ts` — the audit + the `canonicalSupabase` flag
