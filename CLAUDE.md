# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What Nichesmith is

Nichesmith is a **digital product factory**. Given a niche/audience, it uses Google
Gemini to generate complete, ready-to-sell digital products — planners, AI prompt
packs, template packs, mini-guides, checklist systems, swipe files, and website
copy — along with the matching Etsy/Gumroad sales copy (titles, tags, pricing,
listing descriptions, growth roadmaps). Generated products can be exported (TXT,
HTML, PDF, CSV), saved to a local archive, and pushed to Notion and Shopify.

The project was scaffolded with **Google AI Studio** (see the AI Studio notes in
`vite.config.ts` and `.env.example`); several conventions exist to keep it working
in that hosted environment.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS v4 (via
  `@tailwindcss/vite`, configured in `src/index.css` with `@theme`, **not** a
  `tailwind.config.js`).
- **Backend:** Express 4 in a single `server.ts`, run with `tsx` in dev.
- **AI:** `@google/genai` (Gemini). Text generation tries `gemini-2.5-flash-lite`
  → `gemini-2.5-flash` → `gemini-2.0-flash` (a fallback/retry chain in
  `server.ts`'s `generateText`); cover images use `gemini-2.5-flash-image`.
- **Key libraries:** `motion` (animations), `jspdf` (PDF export), `jszip`
  (bundles the archive into a downloadable ZIP), `react-markdown`,
  `recharts` (trend sparklines), `qrcode.react`, `lucide-react` (icons),
  `@notionhq/client` (Notion push), `@vercel/analytics` (web analytics —
  `inject()` is called once in `src/main.tsx`).

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server: tsx server.ts (Express + Vite middleware) on :3000
npm run build      # vite build (frontend) + esbuild bundle server.ts -> dist/server.cjs
npm run start      # production: node dist/server.cjs (serves static dist/)
npm run preview    # vite preview
npm run lint       # tsc --noEmit (type-check only)
npm test           # tsx --test test/*.test.ts (unit tests for the billing core)
npm run clean      # rm -rf dist server.js
```

There is **no ESLint config**. Quality gates: `npm run lint` (TypeScript
type-checking) and `npm test` (fast unit tests of the pure billing logic —
`test/*.test.ts`, run via the built-in `node:test` runner through `tsx`, no extra
deps). Both run before the build in CI; run them before committing. Broader
behavior is covered by the smoke tests (`scripts/*smoke*`) — see the CI section.

## Architecture

### Single server, single page

- **`server.ts`** is the entire backend. In development it creates a Vite server in
  middleware mode and mounts it on the same Express app (port **3000**) — there is
  **no separate `vite dev` process**. In production (`NODE_ENV=production`) it
  serves the static `dist/` build and falls back to `dist/index.html` for SPA
  routing.
- **`src/App.tsx`** (~2375 lines) is the entire frontend — one large default-export
  `App()` component holding all state via `useState`. There are no sub-component
  files or a `components/` directory yet. `src/main.tsx` mounts it and calls
  `inject()` from `@vercel/analytics` to enable Vercel Web Analytics.

### Deployment

- **Standalone Node (default):** `npm run build` then `npm run start` runs
  `dist/server.cjs`, the bundled Express server, which serves the static `dist/`
  frontend and the `/api/*` routes from one process. This is the model the
  `dev`/`build`/`start` scripts target.
- **Vercel:** `server.ts` is pre-bundled to a self-contained `server.generated.cjs`
  (esbuild, via the `buildCommand`) and `api/index.ts` loads it and re-exports the
  Express `app` as a serverless function. `vercel.json` builds the frontend
  (`vite build` → `dist/`), routes `/api/*` to that function (an explicit
  `/api/(.*)` rewrite — nested paths like `/api/image/generate` must match), and
  rewrites everything else to `index.html` (SPA). `server.ts`
  detects Vercel via `process.env.VERCEL` and **skips** its own
  `app.listen()`/Vite bootstrap there. Vite is imported dynamically (dev only) so
  it never lands in the production bundle or the Vercel function trace.
  **Set `GEMINI_API_KEY` (and any Notion/Shopify vars) in the Vercel project's
  Environment Variables** — without them the API returns JSON errors.

### Backend API endpoints (all in `server.ts`)

- `GET /api/health` — unauthenticated readiness probe (billing/storage/model status,
  rate-limit backend, uptime, deployed commit). For uptime monitors / load balancers.
- `POST /api/manufacture` — main generator. Body: `{ productId, niche, angle, language }`.
  Uses `specMap`/`labelsMap` + a JSON `responseSchema` to return the product plus
  sales copy. Tries Gemini models in order via `getOrderedModels` (a per-process
  health tracker that temporarily demotes models that 503/429).
- `GET /api/trends` — returns 5 trending niche strings.
- `POST /api/image/generate` — generates a cover image (returns a base64 data URL).
- `POST /api/notion/push` — converts product text to Notion blocks and creates a page.
- `POST /api/shopify/push` — creates a product via the Shopify GraphQL Admin API.
- `GET /api/autonomous-status`, `POST /api/autonomous-trigger` — the autonomous
  generator (brainstorm niche → generate a batch). Plus a small task-queue
  (`queue_store.json`). **The hourly timer and the auto-`git push` to `main` are
  OFF by default** (they previously clobbered the repo); opt in with
  `ENABLE_AUTONOMOUS=true` / `ENABLE_AUTONOMOUS_GIT_PUSH=true` (never on Vercel).
- `GET /api/billing/config`, `POST /api/billing/signup`, `GET /api/billing/account`,
  `POST /api/billing/checkout`, `POST /api/billing/topup`, `POST /api/billing/portal`,
  `POST /api/billing/webhook` — the SaaS layer (see below). All **inert unless
  `BILLING_ENABLED=true`**; `/api/billing/config` is the only one always live (it
  reports `enabled:false`).
- `GET /api/v1`, `GET /api/v1/products`, `GET /api/v1/account`, `POST /api/v1/generate`
  — the **public, versioned REST API** for third-party integrators (`api-v1.ts`).
  `/api/v1/generate` reuses `manufactureProduct` behind the same `rateLimit` +
  `requireQuota` as the first-party routes, so external calls are metered/billed
  identically. Auth is the `x-api-key` header (when billing is on).

### SaaS billing & API-key metering (`billing.ts` + `billing-routes.ts`)

- **Off by default.** With `BILLING_ENABLED` unset the app is exactly the free
  self-hosted tool — no keys, no quota, no Pricing tab, no Stripe. This is a
  no-regression subsystem: turning it on is purely additive.
- **`billing.ts`** is the pure, React-free core (plans, `Account`, `newApiKey`,
  the pluggable `AccountStore`, and `meter()` — check-and-consume with a monthly
  rollover). **`billing-routes.ts`** is the Express glue (route handlers, Stripe,
  and the `requireQuota()` middleware applied to `/api/manufacture`,
  `/api/image/generate`, and `/api/v1/generate`).
- **Tiered plans** (free/starter/pro), each with **monthly + annual** Stripe prices.
  Checkout takes an `interval` (`month`/`year`); the Pricing UI shows a toggle.
  Stripe promotion codes are enabled on every Checkout session.
- **`meter()` consumption order:** included monthly quota → non-expiring **bonus
  credits** → **metered overage** → hard-cap (402).
- **Usage-based overage:** past quota + credits, paid plans with an active Stripe
  subscription keep generating — each extra unit is flagged by `meter()` and
  reported to a **Stripe Billing Meter** (`STRIPE_OVERAGE_METER_EVENT`, best-effort,
  fire-and-forget). The free tier hard-caps. `*_OVERAGE="false"` opts a plan out.
- **Pay-as-you-go credit packs** (`CREDIT_PACKS`): one-time Stripe payments
  (`mode: payment`) that add non-expiring `bonusCredits` via `POST /api/billing/topup`
  → the webhook credits the account. Spendable even on the free plan.
- **Referral program:** every account has a `referralCode`; a signup with `?ref=CODE`
  grants `REFERRAL_BONUS` credits to both referrer and referee (`SIGNUP_BONUS` credits
  every new account). Codes are indexed in the store (`getByReferral`).
- **Public API:** `api-v1.ts` exposes the metered generator as a stable `/api/v1/*`
  surface for third parties, sharing the generator/rate-limit/quota machinery.
- **Storage is pluggable.** In-memory for standalone dev; **Upstash Redis over its
  REST API** when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set — **required on Vercel**,
  where in-memory state doesn't survive between invocations.
- **Stripe** is optional and lazy-loaded (only when `STRIPE_SECRET_KEY` is set);
  signup + the free tier work without it. The **webhook needs the raw request
  body**, so `registerBillingWebhook(app)` mounts it **before** the global
  `express.json()` parser in `server.ts` — keep that ordering.
- The frontend calls `/api/billing/*` via `src/lib/billingClient.ts` (stores the
  key in `localStorage['dropkit_api_key']`, injects it as the `x-api-key` header on
  metered calls) and renders the Pricing/Account panel in `src/components/Billing.tsx`.
- Guarded by `scripts/billing-smoke.cjs` in CI (signup → free hard cap → credit-pack
  top-up + bonus-credit spend → two-sided referral → paid upgrade via a self-signed
  webhook → metered overage → annual checkout path) plus `test/billing.test.ts`
  unit tests. When changing plans/quotas/env, keep both green.
- **Public API reference:** `docs/API.md`.

### Operations / scaling

- **Rate limiting** (`RATE_LIMIT_PER_MIN`, default 20/min per IP) has two backends:
  an in-memory sliding window (per-instance) and a **shared Upstash fixed-window**
  counter for multi-instance/serverless (opt in with `RATE_LIMIT_REDIS=true` +
  Upstash creds). The Redis path **fails open** so a Redis blip can't take the site
  down.
- **Request logging:** set `LOG_REQUESTS=true` for one JSON line per request
  (method/path/status/ms) — off by default.
- **Concurrency note:** `meter()` is check-and-consume via read-modify-write on the
  account record. On a single standalone process this is effectively atomic; on
  multiple serverless instances hitting the same Upstash key, concurrent requests
  can slightly overshoot a quota. Acceptable for the current scale; the fix when it
  matters is atomic Upstash counters (INCR) or an EVAL compare-and-set.

### Product catalog

- Product types live as inline `specMap` (`id → full Gemini spec`) and `labelsMap`
  (`id → label`) in `server.ts`, mirrored by the `PRODUCTS` array in `src/App.tsx`
  (with a local `PRODUCT_ICONS` map for the lucide icons). Adding a product means
  updating both. Product ids: `planner`, `prompts`, `templates`, `guide`,
  `checklist`, `swipe`. (An earlier `src/products.ts` shared catalog was removed
  in a later merge.)

### Frontend data model

- `ManufactureResult` (in `src/App.tsx`) is the canonical shape returned by
  `/api/manufacture` and stored in the archive. If you change the response schema in
  `server.ts`, update this interface too.
- The **archive** persists to `localStorage` under the key **`dropkit_archive`**
  (the `ARCHIVE_KEY` constant in `src/constants.tsx` — the single source of truth;
  don't hardcode the literal). It also syncs with the server archive via `/api/archive`.
  Helpers handle save/remove/import/backup/version history — keep all reads/writes
  going through that single key. Saves **upsert by `productTitle`**.
- Client-side export helpers live in `src/lib/export.ts` (TXT/HTML/PDF/CSV) and
  `src/lib/salesKit.ts` (per-product Sales Kit ZIP — product file + listing copy +
  cover + launch checklist — and the whole-archive ZIP). All download paths are
  exercised by the Playwright UI smoke test (`scripts/ui-smoke.mjs`).
- Niche autocomplete blends live `/api/trends` results (fetched once, cached in
  state) with `PRESET_NICHES`; cover art from `/api/image/generate` is stored on
  the item as `coverImage` (a base64 data URL) and embedded in PDF exports.

## Conventions

- **TypeScript path alias:** `@/*` maps to the repo root (configured in both
  `tsconfig.json` and `vite.config.ts`).
- **Styling:** Tailwind utility classes + the custom theme tokens in
  `src/index.css` (`@theme`). It is a **dark** theme; tokens are named by role:
  `--color-base` (app background), `--color-surface` (panels/cards/inputs),
  `--color-elevated` (raised/hover), `--color-ink` (primary text), `--color-mut`
  (muted text), `--color-bord` (hairline borders). Use the named utilities
  (`bg-base`, `bg-surface`, `text-ink`, `border-bord`, `text-mut`, ...) rather
  than hardcoding hex values like `bg-[#0A0A0A]`. Document/export-only colors
  (PDF, HTML export, recharts) are plain strings in JS and are exempt.
- **Icons:** import from `lucide-react`.
- **Do not modify the HMR / file-watch settings** in `vite.config.ts`. They are
  intentionally gated on `DISABLE_HMR` to prevent flickering during AI Studio agent
  edits.
- When adding a new product type, add a matching entry to `specMap`/`labelsMap`
  in `server.ts` and to the `PRODUCTS` array + `PRODUCT_ICONS` map in
  `src/App.tsx` (same `id`).

## Environment variables

Copy `.env.example` to `.env.local`. AI Studio injects several of these at runtime.

- `GEMINI_API_KEY` — **required** for all Gemini calls.
- `APP_URL` — host URL (self-referential links / callbacks; also Stripe return URLs).
- `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` — required only for Notion push.
- `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN` — required only for Shopify push.
- **Billing (all optional, off by default):** `BILLING_ENABLED` gates the whole
  SaaS layer. `FREE_QUOTA`/`STARTER_QUOTA`/`PRO_QUOTA` set monthly limits.
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`,
  `STRIPE_PRICE_PRO` (+ optional `*_PRICE_LABEL`) enable monthly checkout;
  `STRIPE_PRICE_STARTER_ANNUAL`/`STRIPE_PRICE_PRO_ANNUAL` add annual plans.
  `STRIPE_OVERAGE_METER_EVENT` + `*_OVERAGE`/`*_OVERAGE_LABEL` control usage-based
  overage. `STRIPE_PRICE_CREDITS_*` + `CREDITS_*` configure pay-as-you-go credit
  packs; `REFERRAL_BONUS`/`SIGNUP_BONUS` the referral/signup credits.
  `UPSTASH_REDIS_REST_URL`/`_TOKEN` provide the persistent account store
  (**required on Vercel**). See `.env.example` and the SaaS section above.

All secrets are server-side only; the frontend talks to Gemini/Notion/Shopify/Stripe
exclusively through the Express API routes. **Never expose API keys to the client.**
`.env*` files are gitignored (except `.env.example`).

## Git workflow

- Develop on the designated feature branch; do not push to `main` without explicit
  permission.
- Run `npm run lint` before committing.
- Do not create pull requests unless explicitly asked.

## CI

- `.github/workflows/ci.yml` runs on every PR and push to `main`: `npm ci` →
  `npm run lint` (tsc) → `npm run build` → the Vercel esbuild bundle. It exists
  because past outages came from build-breaking merges (a dropped symbol, a
  package imported but missing from `package.json`, a broken serverless bundle).
  Keep it green; enable it as a required status check on `main`.
- Be careful merging long-lived divergent branches into `main` — a bad
  auto-resolution has silently deleted code and deploy config here before.
  Let CI verify the result before merging.
