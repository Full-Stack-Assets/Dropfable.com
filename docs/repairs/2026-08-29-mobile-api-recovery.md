# DropKit mobile/API recovery receipt

- Work item: restore the public DropKit Factory experience shown failing on a 311-pixel-wide iPhone viewport.
- Baseline: `26c8a26` on `main`.
- Root cause: the latest Pages workflow failed before deployment, leaving an older bundle that called `/api/*` on a static host. The static HTML response surfaced in iOS Safari as “The string did not match the expected pattern.” The prior Vercel API deployments are disabled.
- Repair: validate the optional API origin, provide local format detection/radar/manufacturing fallbacks, preserve the hosted API path, remove the hard deployment dependency on an API URL, use the repository Node 22 baseline, and make the header/radar controls responsive at 311 pixels.
- Verification: `npm run lint` PASS; `npm test` PASS; `npm run build` PASS; `git diff --check` PASS.
- UI gate: the Playwright test now covers the 311-pixel radar → manufacture → archive flow and horizontal-overflow check. Local execution was blocked because the runtime could not download Chromium; the existing GitHub CI installs Chromium and owns this final gate after push.
- Deployment status: source repair complete; live publication requires a GitHub-authenticated push to the repository.
