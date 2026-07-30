<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single product: the **brikdesigns.com** marketing site (Next.js 16 / React 19 / TS, npm). Standard commands live in `package.json` (`dev`, `build`, `lint`, `typecheck`, `test:a11y`) and `README.md`.

### Required secrets (provided as env vars in Cloud; no `.env.local` needed)

- `PACKAGES_READ_TOKEN` — GitHub PAT with `read:packages` for the `brikdesigns` org. **Required for `npm install`**: `@brikdesigns/bds` (design system, imported everywhere) and `@brikdesigns/feedback-contract` come from GitHub Packages, and `.npmrc` substitutes this token into the auth header. Without it install fails with 401/403 and nothing compiles. The `README`'s `op run --env-file=.env.op ...` (1Password) is a dev-machine concern only — in Cloud the token is injected as an env var, so plain `npm install` works. The Cursor `gh` token does NOT have access to the org's packages.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — remote shared **staging** Supabase (project `lmhzpzobdkstzpvsqest`, shared with `brik-client-portal`). Required for CMS-driven pages (services, plans, blog, stories, events, industries) to render.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side inserts for `POST /api/leads` (Get Started / contact / event signup forms). Only needed to exercise lead-capture end to end.

Optional/graceful-degrade: `RESEND_API_KEY`, `SLACK_*_WEBHOOK_URL`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY`, `NOTION_TOKEN`, `REVALIDATION_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`. There is no local DB/Docker — Supabase is always remote.

### Running / testing gotchas

- Dev server: `npm run dev` → http://localhost:3000. `next dev` reads `NEXT_PUBLIC_*` from the process env, so injected secrets are picked up without a `.env.local`.
- a11y tests (`npm run test:a11y`, Playwright + axe) boot their own `next dev` when `PLAYWRIGHT_BASE_URL` is unset, so they also need the Supabase env vars; run `npx playwright install chromium` once first (browsers are not part of `npm install`).
- The pre-commit hook (`.husky/pre-commit`) runs token/heading-case/image/icon-drift lints plus a `gitleaks` scan; all steps skip gracefully if `node`/`gitleaks` are missing. `gitleaks` is not installed by the update script.
