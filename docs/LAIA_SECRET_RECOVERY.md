# Laia Secret Recovery

## Decision
Yes — I checked `pass`, and it is a good fit for Laia's recoverable secret layer.

Why I chose it:
- it stores each secret as a GPG-encrypted file
- it supports simple folder hierarchies
- it can be backed by git for recovery and migration
- it is transparent and infrastructure-independent
- it matches the repo-portability goal better than hiding everything in one machine-local keychain

The official `passwordstore.org` flow is basically:
- `pass init <gpg-key>`
- optional `pass git init`
- store/retrieve secrets as ordinary named entries

## Important current fact
On this machine right now:
- `gpg` is installed
- `pass` is installed and available in PATH
- a dedicated live Laia pass store is **not initialized yet**

So I did **not** pretend the real secret store is already populated.
Instead, I put the repo-side tooling in place and verified the workflow with a disposable test store.

## What I added
- `ops/hermes/pass-layout.json` — canonical pass entry layout for Laia
- `ops/hermes/bootstrap_laia.py` — can both capture the current local secret files into pass and materialize them back out later

## Recommended pass layout
- `laia/github/publish-pat`
  - writes to `~/.hermes/secrets/github...laia.txt`
- `laia/google/client-secret-json`
  - writes to `~/.hermes/google_client_secret.json`
- `laia/google/gmail-readonly-token-json`
  - writes to `~/.hermes/gmail_readonly_token.json`
- `laia/cloudflare/github-token`
  - used to set Worker secret `GITHUB_TOKEN`

## Recommended storage model
I recommend this setup:
1. create a dedicated private password-store repo
2. initialize `pass` with one or more GPG recipients you control
3. back the store with private git
4. use the repo bootstrap script to materialize the machine-local Hermes files from that store
5. keep the Laia application repo and the secret store repo separate

That gives you:
- repo-portable operational code
- separately recoverable secrets
- no dependence on one laptop or one Hermes profile

## Suggested macOS setup
```bash
brew install pass gnupg
gpg --full-generate-key
pass init "<gpg key id or email>"
pass git init
```
Then attach a private remote for the password store git repo.

## Capturing the current local secrets into pass
Once `pass` is configured:
```bash
cd laia-personal-assistant
python3 ops/hermes/bootstrap_laia.py --capture-secrets-to-pass
```

If `GITHUB_TOKEN` is not already set in your shell, the helper reuses `laia/github/publish-pat` for `laia/cloudflare/github-token` via the declared `copy_from_entry` fallback.

## Materializing local files from pass
Once `pass` is configured and populated:
```bash
cd laia-personal-assistant
python3 ops/hermes/bootstrap_laia.py --materialize-secrets-from-pass
```

## Recreating the local Laia runtime
```bash
cd laia-personal-assistant
python3 ops/hermes/bootstrap_laia.py --check
python3 ops/hermes/bootstrap_laia.py --install-scripts
python3 ops/hermes/bootstrap_laia.py --install-cron
```

## Cloudflare secret recovery
For the Worker secret:
```bash
pass show laia/cloudflare/github-token | wrangler secret put GITHUB_TOKEN
```

## Why not commit encrypted secrets into this repo?
Possible, but I do **not** recommend mixing them into the application repo.
Keeping:
- app/runtime repo
- secret-store repo

as separate systems is cleaner and safer.

## Practical next step
The remaining live step is to initialize the real private pass store with your chosen GPG recipient(s), then run the capture command once against the current machine state.
