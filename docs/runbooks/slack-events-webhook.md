# Runbook: Slack incoming webhook → Netlify env

How to wire (or rotate) a Slack `#channel` notification webhook used by the
brikdesigns app — e.g. `SLACK_EVENTS_WEBHOOK_URL` (event registrations,
brikdesigns#334) or `SLACK_LEADS_WEBHOOK_URL`.

Two steps: **mint** (manual, Slack-side) and **wire** (one command).

## 1. Mint the incoming webhook (manual — Slack constraint)

Slack incoming webhooks can only be created through the app UI; there is no API
to mint one with a token, so this step can't be automated headlessly.

1. <https://api.slack.com/apps> → the Brik notifications app (or **Create New
   App** → *From scratch*, in the **brik designs** workspace).
2. **Features → Incoming Webhooks** → toggle **On**.
3. **Add New Webhook to Workspace** → pick the target channel (e.g. `#events`)
   → **Allow**.
4. Copy the URL — it looks like
   `https://hooks.slack.com/services/T…/B…/…`. **It is a secret** (anyone with
   it can post to that channel). Don't commit it or paste it into a PR.

## 2. Wire it into Netlify (all 3 contexts, one command)

The value must exist in **production + deploy-preview + branch-deploy** —
missing `deploy-preview` silently breaks PR previews for every author. Use the
helper, which sets all three and reads the value from stdin (never argv):

```sh
source ~/.secrets/netlify.env          # NETLIFY_AUTH_TOKEN
./scripts/set-netlify-env.sh SLACK_EVENTS_WEBHOOK_URL
# paste the hooks.slack.com URL, then Ctrl-D
# → ✓ set SLACK_EVENTS_WEBHOOK_URL → ['branch-deploy', 'deploy-preview', 'production']
```

Redeploy (or wait for the next deploy) for functions to pick up the new value.

## 3. Record for rotation

Store the URL in 1Password (Development vault) so the next rotation knows where
it lives — e.g. item **"Brik Slack #events Incoming Webhook"**. To rotate:
re-mint (step 1), re-run the helper (step 2), update the 1Password item.

## Notes

- The notification code (`src/lib/notifications.ts`) falls back to
  `SLACK_LEADS_WEBHOOK_URL` when `SLACK_EVENTS_WEBHOOK_URL` is unset, so the app
  is safe before this is wired — event notifications just land in the leads
  channel until then.
- The helper targets the brikdesigns site. For other Brik sites, change
  `SITE_ID` / `ACCOUNT` at the top of `scripts/set-netlify-env.sh`.
