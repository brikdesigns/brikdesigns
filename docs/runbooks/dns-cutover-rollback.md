# DNS cutover — rollback runbook (#371)

Revert `brikdesigns.com` from the Netlify site back to the legacy Webflow site.
Use if the post-cutover smoke fails (www not 200 / `server: Netlify`, `/contact`
lead not firing, SSL not provisioning, or broad route breakage).

All `brikdesigns.com` DNS is on **Cloudflare** (authoritative since #2517,
2026-07-30) and must stay **DNS-only / grey cloud** — Webflow and Netlify each
terminate their own TLS, so proxying a record breaks it. Never edit the retained
SiteGround zone; it answers nothing.

## Rollback target — pre-cutover records (Webflow)

Captured live 2026-08-28 (`dig @celeste.ns.cloudflare.com`), all DNS-only:

| Name | Type | Content | Proxy |
|---|---|---|---|
| `www.brikdesigns.com` | CNAME | `cdn.webflow.com` | grey (DNS-only) |
| `brikdesigns.com` (apex) | A | `198.202.211.1` | grey (DNS-only) |

These are the exact values to restore. Restoring them points the public back at
Webflow; Webflow's own cert covers the domain immediately.

## Cutover records (what the flip sets — step 4)

Capture the exact Netlify-instructed records at flip-time from the Netlify site's
domain panel (site `7664720a-83a6-45e8-b348-b49d07de8ef7`) and record them here
before flipping, so this table is precise rather than assumed:

| Name | Type | Content (confirm in Netlify panel) | Proxy |
|---|---|---|---|
| `www.brikdesigns.com` | CNAME | `brikdesigns.netlify.app` | grey |
| `brikdesigns.com` (apex) | A / flattened-CNAME | Netlify load-balancer target per panel | grey |

Netlify custom domain is already staged (2026-08-28): `custom_domain` =
`www.brikdesigns.com`, alias `brikdesigns.com`. SSL provisions only after DNS
resolves to Netlify.

## Rollback procedure

1. Restore the two records above via the Cloudflare API (per the
   `brikdesigns.com` DNS invariant — `brik-client-portal/scripts/dns-cloudflare.sh`
   or a direct zone API `PATCH`). Keep both **DNS-only (grey)**.
2. Verify propagation (TTL is low; expect minutes):
   ```
   dig +short www.brikdesigns.com CNAME @celeste.ns.cloudflare.com   # → cdn.webflow.com
   dig +short brikdesigns.com A     @celeste.ns.cloudflare.com        # → 198.202.211.1
   ```
3. Smoke the restored site:
   ```
   curl -sSI https://www.brikdesigns.com/ | grep -i '^server'          # → Webflow's server, HTTP 200
   ```
4. (Optional) Un-stage the Netlify custom domain to avoid a dangling claim:
   `PATCH /api/v1/sites/<id>` with `custom_domain: null`, `domain_aliases: []`.
   Not required for rollback correctness — no traffic reaches Netlify once DNS
   points at Webflow.

## Notes

- The new site stays fully reachable on `brikdesigns.netlify.app` throughout — a
  rollback only changes which origin the public domain resolves to.
- Indexing stays disabled until `NEXT_PUBLIC_ALLOW_INDEXING=true` (`src/app/robots.ts`),
  so a rollback has no SEO fallout while the flag is off.
