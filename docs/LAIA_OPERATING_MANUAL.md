# Laia Operating Manual

This document is the repo-side recovery and migration guide for the current Laia system.

## 1. System overview
Laia currently consists of four cooperating parts:

1. **Static/dashboard repo**
   - repository: `brianh20/laia-personal-assistant`
   - local path in current infra: `/Users/computer/laia-landing-page`
   - contains website UI, Worker backend, and committed dashboard state

2. **Cloudflare Worker deployment**
   - serves the site assets
   - exposes live dashboard APIs
   - uses a runtime secret `GITHUB_TOKEN` to commit shared dashboard edits back to GitHub

3. **Hermes runtime + cron automation**
   - runs the Gmail watcher
   - runs the midnight daily-log summarizer
   - republishes dashboard changes through the updater script

4. **External accounts/services**
   - GitHub repo access
   - Cloudflare deployment/project
   - Gmail readonly OAuth app + token
   - Yahoo Finance public endpoint for market data

## 2. Critical repo files
### Frontend/backend
- `index.html`
- `_worker.js`
- `wrangler.jsonc`
- `.assetsignore`
- `dashboard.json`

### Vendored Hermes operational files
- `ops/hermes/scripts/update_laia_dashboard.py`
- `ops/hermes/scripts/gmail_readonly_watch.py`
- `ops/hermes/cron-jobs.yaml`
- `ops/hermes/bootstrap_laia.py`
- `ops/hermes/pass-layout.json`
- `ops/hermes/identity/MEMORY.md`
- `ops/hermes/identity/USER.md`
- `ops/hermes/export_hermes_identity.py`
- `docs/HERMES_IDENTITY.md`

## 3. Current behavior
### Shared editing
- The Worker handles `/api/dashboard-state` and `/api/dashboard-update`.
- Shared editable modules are currently:
  - `internal_projects`
- The browser reads live state from the Worker, not just from the static file.

### Dashboard publishing
`update_laia_dashboard.py` is the canonical publisher.
It:
- loads the latest remote `dashboard.json` from GitHub
- preserves shared modules from remote state
- refreshes market data
- updates email module state when requested
- appends/replaces a daily log entry when requested
- publishes by cloning a fresh temporary copy of the repo and pushing only the dashboard update

### Email watcher
`gmail_readonly_watch.py`:
- uses Gmail readonly OAuth only
- suppresses spam/noise
- distinguishes likely actionable email from FYI mail
- produces suggested replies for messages that likely need a response
- updates dashboard email state through `update_laia_dashboard.py`
- stays silent when there is nothing meaningful to report

### Nightly history
A midnight cron job summarizes the day that just ended and writes one entry into the dashboard's `daily_log` history module.

## 4. Required secrets and state
These are required but should not be committed.

### Hermes-side local files
Expected by the current scripts:
- `~/.hermes/gmail_readonly_token.json`
- `~/.hermes/google_client_secret.json`
- `~/.hermes/secrets/github_pat_codedelilaia.txt`

### Cloudflare secrets / variables
Set in the Worker environment:
- `GITHUB_TOKEN` — commits shared dashboard edits back to GitHub
- `HERMES_API_BASE` — public/reachable base URL for the Hermes API server, for example `https://hermes-api.example.com`
- `HERMES_API_KEY` — bearer token matching Hermes `API_SERVER_KEY`

The dashboard chat UI calls the Worker, and the Worker proxies to Hermes so the browser never receives `HERMES_API_KEY`.

### Notes
- The GitHub PAT used by Hermes and the Cloudflare `GITHUB_TOKEN` can be the same credential in practice, but they are injected through different mechanisms.
- Secret values are intentionally absent from this repository.

## 5. Rebuild / migrate procedure
### A. Clone repo
```bash
git clone https://github.com/brianh20/laia-personal-assistant.git
cd laia-personal-assistant
```

### B. Restore Hermes scripts
The repo now contains the operational copies under:
- `ops/hermes/scripts/update_laia_dashboard.py`
- `ops/hermes/scripts/gmail_readonly_watch.py`

On a new machine, place or symlink them into the Hermes scripts directory if you want to keep using the same cron layout.

Example:
```bash
mkdir -p ~/.hermes/scripts
cp ops/hermes/scripts/update_laia_dashboard.py ~/.hermes/scripts/
cp ops/hermes/scripts/gmail_readonly_watch.py ~/.hermes/scripts/
chmod +x ~/.hermes/scripts/update_laia_dashboard.py ~/.hermes/scripts/gmail_readonly_watch.py
```

### C. Restore non-git secrets
Provide:
- Gmail readonly token
- Google OAuth client secret
- GitHub PAT for dashboard publishing

### D. Restore Cloudflare deployment
- connect repo to Cloudflare Workers/Pages deployment
- use `wrangler.jsonc`
- add Worker secret `GITHUB_TOKEN`
- add Hermes chat Worker settings:
  - `HERMES_API_BASE` — reachable Hermes API server URL
  - `HERMES_API_KEY` — same value as local Hermes `API_SERVER_KEY`
- deploy latest main

### E. Restore cron jobs
Recreate jobs from `ops/hermes/cron-jobs.yaml`.
Current schedules:
- workday Gmail watcher: `0,30 9-17 * * *`
- end-of-day Gmail watcher: `0 18 * * *`
- daily work log: `0 0 * * *`

## 6. Operational invariants
These are design choices worth preserving during any migration:
- remote git state is authoritative
- local dashboard copies are disposable
- dashboard mutations should go through canonical publishing logic, not ad hoc edits
- the email watcher is read-only and should never mutate mailbox state
- nightly reporting should write to the website history, not spam chat
- user-facing updates should stay human-readable, not raw JSON/tool blobs

## 7. Known limitations / what still lives outside the repo
Even after this change, not literally everything about Laia is in git yet.
The remaining off-repo elements are:
- Hermes runtime auth/config state beyond the exported repo snapshots
- live cron scheduler database/job ids
- provider auth state/tokens
- gateway/platform wiring
- any future one-off local scripts not copied back into `ops/hermes/scripts/`

## 8. Recommended future improvement
If you want this to become close to fully portable, the next upgrade should be a bootstrap script that can:
- install/copy repo-side Hermes scripts into `~/.hermes/scripts/`
- recreate cron jobs from `ops/hermes/cron-jobs.yaml`
- validate required secret files/env vars
- print the remaining manual steps for Cloudflare and Gmail OAuth
