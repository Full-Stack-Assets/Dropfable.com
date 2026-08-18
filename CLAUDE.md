# Dropfable / DropKit contributor map

Product is **Dropfable** (dropfable.com). Code and exports still say DropKit. Archive key is `dropkit_archive` — do not rename.

## Stack

- SPA: Vite + React on GitHub Pages. `VITE_API_BASE_URL` rewrites `/api/*` in `src/api-base.ts`.
- API: `server.ts` Express. Gemini generation, queue, image covers, optional Stripe billing.
- Auth: Firebase. Signed-in archive is Firestore `users/{uid}.archivedItems`. Signed-out: localStorage.

## Do not

- Put `GEMINI_API_KEY` in the client.
- Enable `AUTONOMOUS_ENABLED` or `AUTONOMOUS_GIT_PUSH` on the Pages repo.
- Emit Etsy listing copy for prompt packs.
- Re-add Notion/Shopify or billing extras (referrals, overage) until a paying cohort exists.
- Restore Vercel-only paths unless you are actually deploying there.

## Tests

`npm run lint`, `npm test` (API + billing smoke), `npm run test:ui` after `npx vite build`.
