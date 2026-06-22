# DropKit

DropKit is a full-stack AI-powered web app built with **React + Vite** on the frontend and an **Express + TypeScript** server backend.

It is designed to help you run AI-assisted workflows and integrations (including Google Gemini and Notion), while keeping local development and deployment simple.

---

## Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Recharts, Lucide React
- **Backend:** Node.js, Express 4, TypeScript
- **AI / Integrations:** `@google/genai`, `@notionhq/client`
- **Tooling:** `tsx`, `esbuild`

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** (Node.js 20 LTS recommended)
- **npm** (comes with Node.js)
- A valid **Gemini API key**

---

## Getting Started (Local Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/Full-Stack-Assets/Dropkit.git
   cd Dropkit
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create local environment file**

   Create a `.env.local` file in the project root.

4. **Add required environment variables**

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Run the development server**

   ```bash
   npm run dev
   ```

---

## Available Scripts

### `npm run dev`
Runs the app in development mode using `tsx server.ts`.

### `npm run build`
Builds the frontend with Vite and bundles the backend server with esbuild:
- Frontend output: `dist/`
- Backend output: `dist/server.cjs`

### `npm run start`
Starts the production server from the built output:

```bash
node dist/server.cjs
```

### `npm run preview`
Previews the Vite build output.

### `npm run lint`
Type-checks the project using TypeScript (`tsc --noEmit`).

### `npm run clean`
Removes generated build artifacts.

---

## Environment Variables

DropKit currently expects at least the following variable:

- `GEMINI_API_KEY` — used for Gemini API access.

If you use Notion-backed features in your server implementation, you may also need additional variables such as Notion credentials (for example, integration token and database/page identifiers) depending on how your server routes are configured.

> Tip: Keep secrets only in local/private `.env*` files and your deployment platform’s secret manager. Never commit secrets to git.

---

## Project Structure (High Level)

```text
Dropkit/
├─ server.ts            # Express server entrypoint
├─ package.json
├─ README.md
├─ src/                 # Frontend source (React + Vite)
├─ dist/                # Production build output
└─ .env.local           # Local environment variables (not committed)
```

---

## Build & Production Deployment

1. Build the app:

   ```bash
   npm run build
   ```

2. Start in production mode:

   ```bash
   npm run start
   ```

For deployment, ensure your host provides all required environment variables (especially `GEMINI_API_KEY`) and runs the same build/start flow.

---

## Troubleshooting

### Missing `GEMINI_API_KEY`
If requests to Gemini fail, verify `.env.local` exists and contains a valid key.

### Type errors during lint/check
Run:

```bash
npm run lint
```

Then fix reported TypeScript issues before building.

### Build succeeds but app fails to start
Ensure `npm run build` generated `dist/server.cjs`, then run `npm run start`.

---

## Notes

This README has been updated from the initial AI Studio starter template to reflect the current DropKit repository setup and scripts.
