# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What DropKit is

DropKit is a **digital product factory**. Given a niche/audience, it uses Google
Gemini to generate complete, ready-to-sell digital products — planners, AI prompt
packs, template packs, mini-guides, checklist systems, and swipe files — along with
the matching Etsy/Gumroad sales copy (titles, tags, price recommendation, listing
description, Gumroad blurb). Generated products can be exported (TXT, HTML, PDF,
CSV), saved to a local archive (with server-side backup), and pushed to Notion and
Shopify.

> **A note on naming.** The product is **DropKit** (see `metadata.json`, the
> server console banner, and the export footers). You will also see **Nichesmith**
> in a few places — most importantly the `localStorage` archive key
> (`nichesmith_archive`, migrated from the legacy `dropkit_archive`). Treat
> "DropKit" as the current name; don't rename the archive key when you see
> "Nichesmith" — it's load-bearing for existing users' saved data.

The project was scaffolded with **Google AI Studio** (see the AI Studio notes in
`vite.config.ts`, `.env.example`, and `README.md`); several conventions exist to
keep it working in that hosted environment.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS v4 (via
  `@tailwindcss/vite`, configured in `src/index.css` with `@theme`, **not** a
  `tailwind.config.js`).
- **Backend:** Express 4 in a single `server.ts`, run with `tsx` in dev.
- **AI:** `@google/genai` (Gemini). Text generation tries `gemini-2.5-flash-lite`
  → `gemini-2.5-flash` → `gemini-2.0-flash` (a fallback/retry chain, ordered per
  request by `getOrderedModels` in `server.ts`); cover images use
  `gemini-2.5-flash-image`.
- **Key libraries:** `motion` (animations), `jspdf` (PDF export), `jszip`
  (bundles the archive into a downloadable ZIP), `react-markdown`,
  `recharts` (trend sparklines), `lucide-react` (icons),
  `@notionhq/client` (Notion push), `dotenv` (loads `.env.local` in dev).

> **Removed dependencies** — if you see references in old notes/PRs: `@vercel/analytics`
> (the `inject()` call in `src/main.tsx`) and `qrcode.react` have been removed and
> are no longer in `package.json`. Don't reintroduce them without a reason.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server: tsx server.ts (Express + Vite middleware) on :3000
npm run build      # vite build (frontend) + esbuild bundle server.ts -> dist/server.cjs
npm run start      # production: node dist/server.cjs (serves static dist/)
npm run preview    # vite preview
npm run lint       # tsc --noEmit (type-check only)
npm run clean      # rm -rf dist server.js
```

There is **no ESLint config**. Quality gates are `npm run lint` (TypeScript
type-checking) and the two smoke tests run in CI (see **Testing / CI** below).
Run `npm run lint` before committing changes. Node **>= 20** is required
(`package.json` `engines`); `.nvmrc` and CI pin Node **22**.

## Architecture

### Single server, single page

- **`server.ts`** (~1000 lines) is the entire backend. In development it creates a
  Vite server in middleware mode and mounts it on the same Express app (port
  **3000**) — there is **no separate `vite dev` process**. In production
  (not Vercel) it serves the static `dist/` build and falls back to
  `dist/index.html` for SPA routing.
- **`src/App.tsx`** (~1850 lines) is the main frontend — one large default-export
  `App()` component holding all state via `useState`. It has been partially
  decomposed: shared types, the static catalog, and the export/http helpers now
  live in their own modules (see **Frontend modules** below), but the UI itself is
  still a single component. `src/main.tsx` mounts it in `<StrictMode>`.

### Frontend modules

The frontend is no longer one file. When editing, put code where it already lives:

- **`src/App.tsx`** — the `App()` component: all state, effects, event handlers,
  and JSX.
- **`src/types.ts`** — shared interfaces: `ProductType` and `ManufactureResult`
  (the canonical `/api/manufacture` response shape; see below).
- **`src/constants.tsx`** — static UI catalog and constants: the `PRODUCTS` array
  (with inline lucide icons — hence `.tsx`), `PRESET_NICHES`, `NICHE_TREND_DATA`,
  `LOADER_MESSAGES`, and the archive keys `ARCHIVE_KEY` / `LEGACY_ARCHIVE_KEY`.
- **`src/lib/http.ts`** — `parseJsonResponse(res)`: reads a fetch body as text
  first so a non-JSON error/redirect page surfaces an actionable message instead
  of a cryptic `SyntaxError`. Use this instead of `res.json()` for API calls.
- **`src/lib/export.ts`** — pure client-side export helpers (`exportProductTxt`,
  `exportProductHtml`, `exportProductPdf`, `exportBatchPdf`, `exportMetadataCsv`).
  They take data + options explicitly (no component state) and trigger a browser
  download. Guarded by the Playwright UI smoke test.

### Deployment

- **Standalone Node (default):** `npm run build` then `npm run start` runs
  `dist/server.cjs`, the bundled Express server, which serves the static `dist/`
  frontend and the `/api/*` routes from one process. This is the model the
  `dev`/`build`/`start` scripts target.
- **Vercel:** `server.ts` is pre-bundled to a self-contained `server.generated.cjs`
  (esbuild, via `vercel.json`'s `buildCommand`) and `api/index.ts` loads it with
  `createRequire` and re-exports the Express `app` as a serverless function (an
  Express app is itself a `(req, res)` handler). `vercel.json` builds the frontend
  (`vite build` → `dist/`), routes `/api/*` to that function (an explicit
  `/api/(.*)` rewrite — nested paths like `/api/image/generate` must match), and
  rewrites everything else to `index.html` (SPA); the function has
  `maxDuration: 300`. `server.ts` detects Vercel via `process.env.VERCEL` and
  **skips** its own `app.listen()`/Vite bootstrap there. Vite is imported
  dynamically (dev only, via a variable specifier) so it never lands in the
  production bundle or the Vercel function trace.
  **Set `GEMINI_API_KEY` (and any Notion/Shopify vars) in the Vercel project's
  Environment Variables** — without them the API returns JSON errors.

### Server-side storage

- `DATA_DIR` is `os.tmpdir()` on Vercel (the only writable location on a serverless
  filesystem) and `process.cwd()` otherwise. Two JSON stores live there:
  `archive_store.json` (server-side archive backup) and `queue_store.json` (the
  task queue). On Vercel these are **ephemeral** (per-invocation tmp), so the
  authoritative archive is still the browser `localStorage` copy.

### Backend API endpoints (all in `server.ts`)

Rate-limited endpoints (marked ⏱) share an in-memory limiter tuned by
`RATE_LIMIT_PER_MIN` (default **20**/min) — it protects the paid Gemini calls.

- ⏱ `POST /api/manufacture` — main generator. Body: `{ productId, niche, angle, language }`.
  Uses `specMap`/`labelsMap` + a JSON `responseSchema` to return the product plus
  sales copy. Tries Gemini models in order via `getOrderedModels` (a per-process
  health tracker that temporarily demotes models that 503/429).
- ⏱ `GET /api/trends` — returns 5 trending niche strings.
- ⏱ `POST /api/image/generate` — generates a cover image (returns a base64 data URL).
- `POST /api/notion/push` — converts product text to Notion blocks and creates a page.
- `POST /api/shopify/push` — creates a product via the Shopify GraphQL Admin API.
- `GET /api/queue`, `POST /api/queue`, `POST /api/queue/clear`,
  `DELETE /api/queue/tasks/:id` — the task queue (persisted to `queue_store.json`).
- `GET /api/archive`, `POST /api/archive`, `POST /api/archive/sync`,
  `POST /api/archive/remove` — server-side archive backup (`archive_store.json`).
- `GET /api/autonomous-status`, `POST /api/autonomous-trigger` — the autonomous
  generator (brainstorm niche → generate a batch). **The hourly timer and the
  auto-`git push` to `main` are OFF by default** (they previously clobbered the
  repo); opt in with `ENABLE_AUTONOMOUS=true` / `ENABLE_AUTONOMOUS_GIT_PUSH=true`
  (never on Vercel).

### Product catalog

- Product types live as inline `specMap` (`id → full Gemini spec`) and `labelsMap`
  (`id → label`) in `server.ts`, mirrored by the `PRODUCTS` array in
  `src/constants.tsx` (each entry carries its own lucide icon). Adding a product
  means updating **both**. Product ids: `planner`, `prompts`, `templates`,
  `guide`, `checklist`, `swipe`.

### Frontend data model

- `ManufactureResult` (in `src/types.ts`) is the canonical shape returned by
  `/api/manufacture` and stored in the archive. If you change the response schema
  in `server.ts`, update this interface too.
- The **archive** persists to `localStorage` under the key **`nichesmith_archive`**
  (the constant `ARCHIVE_KEY` in `src/constants.tsx`; the legacy `dropkit_archive`
  key is migrated on first load). Helpers in `App.tsx` handle
  save/remove/import/backup/version history — keep all reads/writes going through
  that single key. A best-effort server backup goes to the `/api/archive*` routes.

## Testing / CI

There is no unit-test framework, but two **smoke tests** gate every change (both
run in CI, and you can run them locally after a build):

- **`scripts/smoke.cjs`** — boots the bundled `server.generated.cjs` and asserts
  every `/api/*` route is wired (returns JSON, not 404). Catches deleted/renamed
  routes a type-check can't. Uses validation/no-key paths, so it needs no
  `GEMINI_API_KEY` and makes no external calls. Run with
  `VERCEL=1 node scripts/smoke.cjs` after building the bundle.
- **`scripts/ui-smoke.mjs`** — launches the built `dist/` frontend in Playwright
  Chromium, seeds a fake archive into `localStorage`, and asserts the TXT/PDF
  export buttons actually fire downloads — browser-only behavior the type-check and
  API smoke test can't cover. Run with `node scripts/ui-smoke.mjs`.

`.github/workflows/ci.yml` runs on every PR and push to `main` (Node 22): `npm ci`
→ `npm run lint` (tsc) → `npm run build` → the Vercel esbuild bundle → the API
smoke test → Playwright install → the UI smoke test. It exists because past
outages came from build-breaking merges (a dropped symbol, a package imported but
missing from `package.json`, a broken serverless bundle, a silently deleted route).
Keep it green; enable it as a required status check on `main`.

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
- **API calls:** parse responses with `parseJsonResponse` from `src/lib/http.ts`,
  not `res.json()` — it gives actionable errors when the backend returns HTML.
- **Do not modify the HMR / file-watch settings** in `vite.config.ts`. They are
  intentionally gated on `DISABLE_HMR` to prevent flickering during AI Studio agent
  edits.
- When adding a new product type, add a matching entry to `specMap`/`labelsMap`
  in `server.ts` and to the `PRODUCTS` array in `src/constants.tsx` (same `id`).

## Environment variables

Copy `.env.example` to `.env.local` (loaded by `dotenv` in dev). AI Studio injects
several of these at runtime.

- `GEMINI_API_KEY` — **required** for all Gemini calls.
- `APP_URL` — host URL (self-referential links / callbacks).
- `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` — required only for Notion push.
- `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN` — required only for Shopify push.
- `RATE_LIMIT_PER_MIN` — per-IP request cap for the paid endpoints (default 20).
- `ENABLE_AUTONOMOUS`, `ENABLE_AUTONOMOUS_GIT_PUSH` — opt-in flags for the
  autonomous generator's hourly timer and auto-`git push` (both **off** by
  default; never enable on Vercel).

All secrets are server-side only; the frontend talks to Gemini/Notion/Shopify
exclusively through the Express API routes. **Never expose API keys to the client.**
`.env*` files are gitignored (except `.env.example`).

## Git workflow

- Develop on the designated feature branch; do not push to `main` without explicit
  permission.
- Run `npm run lint` before committing.
- Be careful merging long-lived divergent branches into `main` — a bad
  auto-resolution has silently deleted code and deploy config here before. Let CI
  verify the result before merging.
