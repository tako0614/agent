# Workers + Hono + Vite + Solid

This template wires a Solid + Vite frontend with a Cloudflare Workers backend using Hono for routing.

What is included

- `client/` — Vite + Solid app
- `worker/` — Hono handler for Cloudflare Workers (TypeScript)
- `package.json` — scripts to run dev/build

Quick start (PowerShell)

```powershell
# 1) Install deps
npm install

# 2) Start dev servers (Vite + Miniflare Worker)
npm run dev

# 3) Build for production
npm run build

# 4) Run built worker locally (Miniflare)
npm run start
```

Notes

- `dev` runs Vite on port 5173 and Miniflare for the worker. The frontend calls `/api/hello` which will hit the worker's endpoint if you configure a reverse proxy or run the worker on a port that your browser can access. For local development the frontend will call the worker when both are reachable (configure CORS or proxy as needed).
- To publish the worker to Cloudflare, add a `wrangler.toml` and follow Cloudflare Wrangler docs.
