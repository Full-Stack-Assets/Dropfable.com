// Smoke test: boot the bundled Express app and assert the API routes are wired.
// A type-check can't catch a *deleted route* (that's how /api/trends and
// /api/image/generate silently disappeared in a past merge) — this can. Each
// check fails the build if a route 404s or returns a non-JSON body. It uses
// validation/no-key paths so it needs no GEMINI_API_KEY and no external calls.
//
// Run after building server.generated.cjs (see vercel.json buildCommand / CI).
const http = require("http");

const mod = require("../server.generated.cjs");
const app = mod && mod.default ? mod.default : mod;

// [method, path, body, allowedStatuses|null]. null = any status except 404.
const CHECKS = [
  ["GET", "/api/autonomous-status", null, [200]],
  ["GET", "/api/queue", null, [200]],
  ["GET", "/api/billing/config", null, [200]],
  ["GET", "/api/trends", null, null],
  ["POST", "/api/manufacture", "{}", null],
  ["POST", "/api/image/generate", "{}", [400]],
  ["POST", "/api/notion/push", "{}", null],
  ["POST", "/api/shopify/push", "{}", null],
];

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  let failed = 0;
  for (const [method, path, body, allowed] of CHECKS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`http://localhost:${port}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      const notFound = res.status === 404;
      const statusOk = allowed ? allowed.includes(res.status) : !notFound;
      const ok = isJson && !notFound && statusOk;
      console.log(`${ok ? "PASS" : "FAIL"} ${method} ${path} -> ${res.status} (${ct || "no content-type"})`);
      if (!ok) failed++;
    } catch (err) {
      console.log(`FAIL ${method} ${path} -> threw ${err && err.message}`);
      failed++;
    }
  }

  server.close();
  if (failed) {
    console.error(`\n${failed} smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
