# hexoboards

Cloudflare Workers/Wrangler app for **hexoboards.com** with a Vercel proxy layer in front of Cloudflare because DNS remains on Vercel.

## What is in this repo

- Static site content in `public/`
- Imported `public/strategies/` app from `hex-tic-tac-toe/hex-tic-tac-toe.github.io`
- Worker entrypoint in `src/index.js`
- Wrangler config in `wrangler.jsonc`
- GitHub Actions deploy workflow in `.github/workflows/deploy.yml`
- Vercel reverse-proxy config in `vercel.json`

## Runtime layout

- Cloudflare production worker: `https://hexoboards.mteam88.workers.dev`
- Cloudflare staging worker: `https://hexoboards-staging.mteam88.workers.dev`
- Intended public production URL: `https://hexoboards.com`
- Intended public staging URL: `https://staging.hexoboards.com`

The worker rewrites canonical and `og:url` metadata using forwarded host/proto headers so it can sit cleanly behind a Vercel proxy.

## Branch deploys

- `main` deploys the production Worker
- `staging` deploys the staging Worker

## Local development

```bash
npm install
npm run dev
```

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
- `not_found_handling: "404-page"`
- `observability.enabled: true`
- Vercel host-based reverse proxy config for `hexoboards.com` and `staging.hexoboards.com`

## Remaining platform step

Because the domain is still managed on Vercel, `vercel.json` must be deployed in a Vercel project that owns:

- `hexoboards.com`
- `staging.hexoboards.com`

That proxy should forward those hosts to the two Cloudflare `workers.dev` origins above.
