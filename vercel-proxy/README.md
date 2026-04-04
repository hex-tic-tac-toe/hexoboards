# Vercel proxy

This directory contains the Vercel-side proxy that fronts the Cloudflare Workers deployment while `hexoboards.com` DNS remains on Vercel.

- `hexoboards.com` -> `https://hexoboards.mteam88.workers.dev`
- `staging.hexoboards.com` -> `https://hexoboards-staging.mteam88.workers.dev`
