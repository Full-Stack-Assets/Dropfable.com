# DropKit — The Digital Product Factory

DropKit is an AI-powered digital product factory. Give it a niche and a product type, and it generates a complete, high-value digital product (planners, prompt packs, templates, guides, checklists, swipe files, or website copy) along with the Etsy and Gumroad sales copy needed to sell it.

Under the hood it pairs a React 19 single-page app with an Express server that talks to Google's Gemini models. The server keeps API keys off the client and exposes a small set of endpoints for content generation, cover-art creation, trend discovery, and publishing to external platforms.

## Features

- **7 product types** — Planner/Workbook (30-day), AI Prompt Pack (50 prompts), Template Pack (25 fill-in scripts), Mini-Guide/Book (~3k words), Checklist System (10 checklists), Swipe File (75 hooks), and a 5-page Website Generator.
- **Ready-to-sell sales copy** — Each product comes with a product title, Etsy listing title, recommended price, listing description, 13 Etsy tags, a Gumroad blurb, and a 3-month growth/launch roadmap.
- **Niche targeting** — Specify any niche/audience plus an optional angle, and generate output in a chosen language.
- **Batch & "generate all" modes** — Produce multiple products at once, including one of every product type for a niche.
- **AI cover art** — Generate a premium cover image for any product via Gemini's image model.
- **Trend discovery** — Fetch currently trending niches/audiences to seed ideas.
- **Exports** — Download products as PDF, HTML, plain text, or metadata CSV, with options for printer-friendly layouts, page breaks, watermarks, logos, and QR codes.
- **Local archive** — Save, search, version, restore, back up, and import generated products using browser `localStorage`.
- **Publishing integrations** — Push generated products directly to **Notion** (as formatted pages) and **Shopify** (as products).

## Tech Stack

- **Frontend:** React 19, TypeScript, [Vite](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Motion](https://motion.dev/), [Recharts](https://recharts.org/), [lucide-react](https://lucide.dev/), `react-markdown`, `qrcode.react`, and `jspdf`.
- **Backend:** [Express](https://expressjs.com/) with the Vite dev server mounted as middleware.
- **AI:** [`@google/genai`](https://www.npmjs.com/package/@google/genai) (Gemini) for content and image generation.
- **Integrations:** [`@notionhq/client`](https://www.npmjs.com/package/@notionhq/client) for Notion, and the Shopify Admin GraphQL API for Shopify.

## Project Structure

```
.
├── index.html          # SPA entry point
├── server.ts           # Express server + API routes + Vite middleware
├── src/
│   ├── App.tsx         # Main application UI and logic
│   ├── main.tsx        # React entry point
│   └── index.css       # Tailwind theme and global styles
├── vite.config.ts      # Vite + React + Tailwind config
├── tsconfig.json       # TypeScript configuration
└── .env.example        # Sample environment variables
```

## API Endpoints

The Express server in `server.ts` exposes:

| Method | Endpoint              | Description                                                       |
| ------ | --------------------- | ---------------------------------------------------------------- |
| `POST` | `/api/manufacture`    | Generate a digital product and its sales copy for a niche.       |
| `GET`  | `/api/trends`         | Return 5 currently trending niches/audiences.                    |
| `POST` | `/api/image/generate` | Generate cover art for a product.                                |
| `POST` | `/api/notion/push`    | Create a formatted page for the product in Notion.               |
| `POST` | `/api/shopify/push`   | Create the product in a Shopify store.                           |

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your keys (see [Environment Variables](#environment-variables) below). At minimum, set `GEMINI_API_KEY`.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:3000`.

## Environment Variables

Configure these in a `.env` file (see `.env.example`):

| Variable                 | Required | Description                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `GEMINI_API_KEY`         | Yes      | Google Gemini API key used for content and image generation.       |
| `APP_URL`                | No       | Public URL where the app is hosted (for self-referential links).   |
| `NOTION_API_KEY`         | No       | Notion internal integration token (required for Notion push).      |
| `NOTION_PARENT_PAGE_ID`  | No       | Notion page ID under which new product pages are created.          |
| `SHOPIFY_ACCESS_TOKEN`   | No       | Shopify Admin API access token (required for Shopify push).        |
| `SHOPIFY_STORE_DOMAIN`   | No       | Shopify store domain, e.g. `your-store.myshopify.com`.             |

The Notion and Shopify variables are only needed if you use the corresponding publishing integrations.

## Scripts

| Script            | Description                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `npm run dev`     | Start the Express + Vite dev server with hot reloading.               |
| `npm run build`   | Build the client with Vite and bundle the server with esbuild.        |
| `npm run start`   | Run the production build from `dist/`.                                |
| `npm run preview` | Preview the production client build.                                  |
| `npm run lint`    | Type-check the project with `tsc --noEmit`.                           |
| `npm run clean`   | Remove build artifacts.                                               |
