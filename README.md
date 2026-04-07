# hexoboards

Cloudflare Workers/Wrangler app for **hexoboards.com** with a Vercel proxy layer in front of Cloudflare because DNS remains on Vercel.

## What is in this repo

- Static site content in `public/`
- Imported strategy app from `hex-tic-tac-toe/hex-tic-tac-toe.github.io`
- Worker entrypoint in `src/index.js`
- Wrangler config in `wrangler.jsonc`
- GitHub Actions deploy workflow in `.github/workflows/deploy.yml`
- Vercel proxy project in `vercel-proxy/`

## Runtime layout

- Cloudflare production worker: `https://hexoboards.mteam88.workers.dev`
- Cloudflare staging worker: `https://hexoboards-staging.mteam88.workers.dev`
- Public production URL: `https://hexoboards.com`
- Public staging URL: `https://staging.hexoboards.com`

The root path `/` now serves the strategy app directly. `/strategies/` redirects back to `/`.

The Cloudflare worker rewrites canonical and `og:url` metadata using forwarded host/proto headers. The Vercel proxy forwards requests to the correct Cloudflare worker based on the incoming hostname.

## Branch deploys

- `main` deploys the production Cloudflare Worker
- `staging` deploys the staging Cloudflare Worker

## Local development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

This runs a local Wrangler smoke test for the Durable Object share flow.

## Manual deploys

```bash
npm run deploy
npm run deploy:staging
```

## CI secrets

GitHub Actions expects these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Best-practice choices in this repo

- local Wrangler via `npm`
- `cloudflare/wrangler-action@v3` in CI
- separate Wrangler `staging` environment
- Workers static assets via `assets.directory`
- Durable Objects for first-party hosted game snapshots
- `not_found_handling: "404-page"`
- `observability.enabled: true`
- Vercel proxy project in front of Cloudflare while DNS remains on Vercel

## Remaining repo step

The Cloudflare deploy pipeline is wired up. The open PR from `staging` to `main` still needs review/merge because `main` is protected.
