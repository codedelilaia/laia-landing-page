# Deploying Laia

## Build

- `npm install`
- `npm run build`

## Local D1 + Worker smoke test

1. `npx wrangler d1 execute laia_dashboard --local --file worker/db/schema.sql`
2. `npm run build`
3. `npx wrangler dev --local --port 8788`
4. Open `http://127.0.0.1:8788`

For a local async demo without Hermes, set `MOCK_HERMES_DELAY_MS` and `MOCK_HERMES_RESPONSE` in `wrangler.jsonc` vars or your local environment.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Worker entry: `worker/index.ts`
- API routes: `/api/*`
- Keep Cloudflare Access enabled on the site.
- Keep `HERMES_API_KEY` and `HERMES_API_BASE` configured only as Worker secrets/server-side variables.

## Rollback

- The pre-React static dashboard is preserved at `legacy/index.static.html`.
- To roll back, restore that file as `index.html`, rebuild, and redeploy.
