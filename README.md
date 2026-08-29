# Dropfable (DropKit)

Digital product factory for Etsy and Gumroad sellers. Enter a niche, get a complete planner, guide, checklist, template pack, or swipe file plus listing copy. Live frontend: [dropfable.com](https://dropfable.com).

Prompt packs are **Gumroad-only**. Etsy prohibits selling AI prompt bundles.

## Architecture

- **Frontend:** Vite + React, deployed to GitHub Pages (`npx vite build`). It includes an in-browser factory so the core product remains usable when no API origin is configured.
- **Backend:** Express in `server.ts` (Gemini generation, queue, billing). Host this separately. Do not put `GEMINI_API_KEY` in the client.
- **Auth / archive:** Firebase Auth + Firestore for signed-in users; `localStorage` key `dropkit_archive` when signed out.

```
GitHub Pages SPA  --VITE_API_BASE_URL-->  Express API  -->  Gemini (optional OpenAI fallback)
        |
        +-- no API origin --> deterministic in-browser factory
```

## Local development

Prerequisites: Node.js 20+.

```bash
npm install
cp .env.example .env.local
# set GEMINI_API_KEY
npm run dev
```

The app listens on http://localhost:3000. Vite middleware serves the SPA; `/api/*` is handled by Express.

## Production (Pages + hosted API)

1. Host `server.ts` (Cloud Run, Fly, or similar) with `GEMINI_API_KEY`. Optional: `OPENAI_API_KEY`, `BILLING_ENABLED`, Stripe, Upstash.
2. Set CORS via `CORS_ORIGINS` (defaults include `https://dropfable.com` and localhost).
3. Optionally set the GitHub Actions repository variable `VITE_API_BASE_URL` to that origin (no trailing slash). Without it, Pages deploys the in-browser factory and clearly labels radar results as research starters rather than live trends.
4. Autonomous hourly generation is **off**. Set `AUTONOMOUS_ENABLED=true` only if you intend to run it. Git push of generated products requires `AUTONOMOUS_GIT_PUSH=true` as well.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Express + Vite |
| `npm run lint` | `tsc --noEmit` |
| `npm run build` | Vite frontend + bundled `dist/server.cjs` |
| `npm test` | Local factory + API + billing smoke tests |
| `npm run test:ui` | Playwright export smoke (needs `dist/` from `vite build`) |

## Billing (optional)

Off by default. `BILLING_ENABLED=true` enables API-key metering, `/api/billing/*`, and the Pricing tab. Stripe Checkout needs `STRIPE_SECRET_KEY` and price IDs. Persist accounts with Upstash Redis on serverless.

## Legal

- [Terms](https://dropfable.com/terms.html)
- [Privacy](https://dropfable.com/privacy.html)
