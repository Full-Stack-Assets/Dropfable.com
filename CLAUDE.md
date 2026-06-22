# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What DropKit is

DropKit is a **digital product factory**. Given a niche/audience, it uses Google
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
- **AI:** `@google/genai` (Gemini). Text uses `gemini-3.5-flash`; cover images use
  `gemini-2.5-flash-image`.
- **Key libraries:** `motion` (animations), `jspdf` (PDF export),
  `react-markdown`, `recharts` (trend sparklines), `qrcode.react`,
  `lucide-react` (icons), `@notionhq/client` (Notion push).

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

There is **no test suite** and **no ESLint config**. The only quality gate is
`npm run lint` (TypeScript type-checking). Run it before committing changes.

## Architecture

### Single server, single page

- **`server.ts`** is the entire backend. In development it creates a Vite server in
  middleware mode and mounts it on the same Express app (port **3000**) — there is
  **no separate `vite dev` process**. In production (`NODE_ENV=production`) it
  serves the static `dist/` build and falls back to `dist/index.html` for SPA
  routing.
- **`src/App.tsx`** (~2400 lines) is the entire frontend — one large default-export
  `App()` component holding all state via `useState`. There are no sub-component
  files or a `components/` directory yet. `src/main.tsx` just mounts it.

### Backend API endpoints (all in `server.ts`)

- `POST /api/manufacture` — main generator. Body: `{ productId, niche, angle, language }`.
  Uses `specMap`/`labelsMap` (both derived from the shared catalog) + a JSON
  `responseSchema` to return the product plus sales copy.
- `GET /api/trends` — returns 5 trending niche strings.
- `POST /api/image/generate` — generates a cover image (returns a base64 data URL).
- `POST /api/notion/push` — converts product text to Notion blocks and creates a page.
- `POST /api/shopify/push` — creates a product via the Shopify GraphQL Admin API.

### Shared product catalog

- **`src/products.ts`** is the single source of truth for the product types. It
  exports `PRODUCT_DEFS` (`id`, `label`, `code`, `blurb`, `spec`) and is imported
  by **both** the frontend (`src/App.tsx`) and the backend (`server.ts`):
  - `server.ts` derives `specMap` (`id → spec`, the full Gemini spec) and
    `labelsMap` (`id → label`) from it.
  - `src/App.tsx` builds its `PRODUCTS` array from it, attaching the lucide icon
    per `id` via the local `PRODUCT_ICONS` map (icons are UI-only). The UI's
    `name`/`spec` fields map to the catalog's `label`/`blurb`.
- Keep `products.ts` **React-/JSX-free** — it is bundled into the Node server
  build by esbuild. Product ids are: `planner`, `prompts`, `templates`, `guide`,
  `checklist`, `swipe`, `website`.

### Frontend data model

- `ManufactureResult` (in `src/App.tsx`) is the canonical shape returned by
  `/api/manufacture` and stored in the archive. If you change the response schema in
  `server.ts`, update this interface too.
- The **archive** persists to `localStorage` under the key **`dropkit_archive`**.
  Helpers handle save/remove/import/backup/version history — keep all reads/writes
  going through that single key.

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
- When adding a new product type, add one entry to `PRODUCT_DEFS` in
  `src/products.ts` and one icon to `PRODUCT_ICONS` in `src/App.tsx` (same `id`).
  `server.ts` and the UI catalog pick it up automatically — no other edits needed.

## Environment variables

Copy `.env.example` to `.env.local`. AI Studio injects several of these at runtime.

- `GEMINI_API_KEY` — **required** for all Gemini calls.
- `APP_URL` — host URL (self-referential links / callbacks).
- `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` — required only for Notion push.
- `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN` — required only for Shopify push.

All secrets are server-side only; the frontend talks to Gemini/Notion/Shopify
exclusively through the Express API routes. **Never expose API keys to the client.**
`.env*` files are gitignored (except `.env.example`).

## Git workflow

- Develop on the designated feature branch; do not push to `main` without explicit
  permission.
- Run `npm run lint` before committing.
- Do not create pull requests unless explicitly asked.
