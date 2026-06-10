# Laia Runtime Index

This repository now carries the core durable artifacts that define the current Laia system, so it can be reconstructed on new infrastructure without depending on a single live Hermes install.

## What lives here

### Website/runtime
- `index.html` — dashboard frontend
- `_worker.js` — Cloudflare Worker backend for live shared dashboard reads/writes
- `wrangler.jsonc` — Worker + static-assets deployment config
- `.assetsignore` — prevents Worker files from being uploaded as public assets
- `dashboard.json` — canonical dashboard data snapshot in git

### Hermes operational code
- `ops/hermes/scripts/update_laia_dashboard.py` — canonical dashboard publisher/updater
- `ops/hermes/scripts/gmail_readonly_watch.py` — Gmail read-only watcher that feeds dashboard email state
- `ops/hermes/cron-jobs.yaml` — human-maintained manifest of the scheduled jobs that currently define Laia's automation

### Manuals
- `docs/LAIA_RUNTIME_INDEX.md` — this file
- `docs/LAIA_OPERATING_MANUAL.md` — migration/recovery guide and required secrets/services

## What is intentionally not committed
These are required to run Laia, but their secret values should stay outside git:
- Gmail readonly OAuth token
- Google OAuth client secret
- GitHub PAT used for dashboard publishing
- Cloudflare Worker secret `GITHUB_TOKEN`
- Hermes config, memory, and other personal state not meant for source control

## Source-of-truth model
For dashboard behavior and content sync:
- remote GitHub repo state is authoritative
- local working copies are disposable
- the website reads shared state through the Worker
- automation publishes through `update_laia_dashboard.py`

## If migrating Laia elsewhere
Start with:
1. `docs/LAIA_OPERATING_MANUAL.md`
2. `ops/hermes/cron-jobs.yaml`
3. `ops/hermes/scripts/`
4. Cloudflare + GitHub secret setup

## Recommended next hardening step
If you want full disaster recovery beyond source code/docs, the next thing to add would be a scripted export/import path for:
- Hermes cron creation
- Gmail OAuth bootstrap instructions
- Cloudflare secret/bootstrap checklist
- optional backup of selected Hermes profile config (without secrets)
