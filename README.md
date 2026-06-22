# DropKit — the digital product factory

DropKit turns a niche or audience into a complete, ready-to-sell digital product
**and** the sales copy to sell it. Pick a product type, type in an audience, and
Google Gemini generates the full product plus optimized Etsy/Gumroad listings.
Everything can be exported, archived locally, and pushed to Notion or Shopify.

> Scaffolded with [Google AI Studio](https://ai.studio/apps/85c3a74b-817c-4f1a-b79a-016cef8f88a2).

## What it generates

Seven product types — choose one, or batch-generate all of them for a niche:

| Type | What you get |
| --- | --- |
| **Planner / Workbook** | A 30-day planner with daily prompts, weekly reviews, and a final reflection |
| **AI Prompt Pack** | 50 copy-paste prompts with `[VARIABLES]`, across 5 categories |
| **Template Pack** | 25 fill-in-the-blank communication templates |
| **Mini-Guide / Book** | A ~2,000–3,000 word deep-dive with 6–8 chapters |
| **Checklist System** | 10 related checklists with a "which to use when" index |
| **Swipe File** | 75 subject lines / hooks / captions across 5 themes |
| **Website Generator** | 5-page wireframe + copy (Home, About, Services, Testimonials, Contact) |

Each generation also returns sales copy: a product title, an Etsy listing title,
13 Etsy tags, a listing description, a Gumroad blurb, a recommended price, and a
3-month launch roadmap.

## Features

- **Single product or batch** generation for any niche, with trending-niche
  suggestions fetched from Gemini.
- **Cover image generation** via Gemini's image model.
- **Exports:** TXT, HTML, PDF (single or multi-product), and a metadata CSV.
- **Local archive** (persisted in `localStorage`) with search, clustering,
  version history, backup/import, and inline title editing.
- **Integrations:** push a product to **Notion** (as a page) or **Shopify** (as a
  product) directly from the UI.
- **Multi-language** output, optional watermark/logo, and a per-product revenue
  calculator.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS v4 (configured via
  `@theme` in `src/index.css`).
- **Backend:** a single Express 4 server (`server.ts`), run with `tsx` in dev.
- **AI:** `@google/genai` (Gemini) — `gemini-3.5-flash` for text,
  `gemini-2.5-flash-image` for covers.
- **Notable libs:** `motion`, `jspdf`, `react-markdown`, `recharts`,
  `qrcode.react`, `lucide-react`, `@notionhq/client`.

## Getting started

**Prerequisites:** Node.js 18+.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    then set GEMINI_API_KEY in .env.local

# 3. Run the dev server
npm run dev
```

The app runs at **http://localhost:3000**. In development, Express hosts the API
**and** the Vite frontend (via middleware) on the same port — there is no
separate Vite process.

### Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. All secrets are
server-side only; the browser never sees an API key.

| Variable | Required | Used for |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Yes** | All Gemini text/image calls |
| `APP_URL` | No | Self-referential links / callbacks |
| `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` | Notion push only | Creating Notion pages |
| `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN` | Shopify push only | Creating Shopify products |

## Scripts

```bash
npm run dev      # dev server (Express + Vite middleware) on :3000
npm run build    # build frontend (vite) + bundle server (esbuild -> dist/server.cjs)
npm run start    # run the production build: node dist/server.cjs
npm run preview  # vite preview
npm run lint     # tsc --noEmit (type-check; the only quality gate)
npm run clean    # remove dist/ and server.js
```

There is no test suite; `npm run lint` is the quality gate — run it before committing.

## Project structure

```
server.ts          Entire backend: Express API + Vite middleware (dev) / static serving (prod)
src/
  App.tsx          Entire frontend (single React component, all state via useState)
  products.ts      Shared product catalog (PRODUCT_DEFS) — imported by App.tsx AND server.ts
  index.css        Tailwind v4 theme tokens (@theme) + global styles
  main.tsx         React entry point
index.html         HTML shell
vite.config.ts     Vite config (React + Tailwind plugins, @ alias, AI Studio HMR gate)
```

### API endpoints (all in `server.ts`)

| Method & path | Purpose |
| --- | --- |
| `POST /api/manufacture` | Generate a product + sales copy (`{ productId, niche, angle, language }`) |
| `GET /api/trends` | Return 5 trending niche strings |
| `POST /api/image/generate` | Generate a cover image (base64 data URL) |
| `POST /api/notion/push` | Create a Notion page from a product |
| `POST /api/shopify/push` | Create a Shopify product |

`src/products.ts` is the single source of truth for product ids, labels, and
specs; both the frontend catalog and the server's `specMap`/`labelsMap` are
derived from it.

## Building for production

```bash
npm run build   # outputs static frontend to dist/ and dist/server.cjs
npm run start   # NODE_ENV=production node dist/server.cjs, serves dist/ + API on :3000
```

## Contributing

See [CLAUDE.md](./CLAUDE.md) for architecture details and conventions (theme
tokens, the shared product catalog, the AI Studio HMR gate, and how to add a new
product type). Develop on a feature branch and run `npm run lint` before
committing.
