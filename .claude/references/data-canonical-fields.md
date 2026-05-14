# Data canonical-fields policy

When `audit:cms-drift` surfaces a divergence between Supabase and the Webflow CSV export, the default reconciliation policy is **CSV wins** (Webflow is the rebuild source of truth). This doc records the exceptions: fields where Supabase is canonical because the Supabase value has been deliberately migrated past the Webflow representation.

## Why this file exists

The audit script (`scripts/audit-supabase-drift.ts`) is field-agnostic — it has no opinion about which side should win when a field diverges. Without a written policy, every drift surfaced by the audit looks the same. This doc is the policy layer that tells future sessions (human or agent) which divergences to ignore vs. which to fix.

## Canonical-Supabase fields

| Table         | Field(s)                                              | Canonical side | Reason |
|---------------|-------------------------------------------------------|----------------|--------|
| `service_lines` | `brand_color_light`, `brand_color_base`, `brand_color_dark` | **Supabase**   | Supabase holds BDS token strings (`--color-orange-light`, etc.). Webflow CMS still holds raw hex (`#ffe8dc`, etc.) — a legacy artifact of the original build. Tokenization is the destination state; Webflow back-port tracked in [#152](https://github.com/brikdesigns/brikdesigns/issues/152). |

## Stopgap status

When Supabase is canonical but the audit still flags drift (because Webflow hasn't been back-ported yet), the local CSV under `content/csv/` may be hand-patched to suppress the false drift. CSV files are gitignored (`/content/csv/` in `.gitignore`), so this patch lives only on the local filesystem and will regress on the next Webflow re-export. The durable fix is always the corresponding back-port issue.

## How to add a new entry

1. Confirm the policy: is this divergence a Supabase-canonical case, or should the CSV/Webflow win?
2. If Supabase-canonical, add a row to the table above with the table, field(s), and a one-line reason linking the back-port issue.
3. Open the Webflow back-port issue (template: see [#152](https://github.com/brikdesigns/brikdesigns/issues/152)).
4. Optionally patch the local CSV as a stopgap so the audit reads clean during the in-between period.

## Related

- [#149](https://github.com/brikdesigns/brikdesigns/issues/149) — CSV ↔ Supabase drift reconciliation umbrella
- [#152](https://github.com/brikdesigns/brikdesigns/issues/152) — Webflow back-port for `service_lines.brand_color_*`
- PR #148 — `audit:cms-drift` infra repair
- `scripts/audit-supabase-drift.ts` — the audit itself
