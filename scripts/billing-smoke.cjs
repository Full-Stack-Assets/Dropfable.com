// Billing smoke test: boots the bundled app with BILLING_ENABLED=true and a tiny
// free quota, then exercises the SaaS flow end to end — signup issues a key, the
// metered endpoint enforces the quota (401 without a key, consume, 402 when
// exhausted), and Stripe routes fail closed (503) when no secret is configured.
// A type-check can't catch broken metering wiring; this can. No GEMINI/Stripe
// keys or network needed.
process.env.VERCEL = "1"; // skip the standalone listen() bootstrap
process.env.BILLING_ENABLED = "true";
process.env.FREE_QUOTA = "2";
const http = require("http");
const path = require("path");

const mod = require(path.join(__dirname, "..", "server.generated.cjs"));
const app = mod && mod.default ? mod.default : mod;

async function req(port, method, p, body, headers) {
  const res = await fetch(`http://localhost:${port}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json, remaining: res.headers.get("x-dropkit-quota-remaining") };
}

async function main() {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  let failed = 0;
  const check = (name, ok, detail) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " -> " + detail : ""}`);
    if (!ok) failed++;
  };

  try {
    const cfg = await req(port, "GET", "/api/billing/config");
    check("config enabled with plans", cfg.json?.enabled === true && Array.isArray(cfg.json?.plans) && cfg.json.plans.length > 0);

    const su = await req(port, "POST", "/api/billing/signup", { email: "smoke@example.com" });
    const key = su.json?.account?.apiKey;
    check("signup issues dk_live_ key", !!key && key.startsWith("dk_live_"));
    check("signup free quota = 2", su.json?.account?.limit === 2, "limit=" + su.json?.account?.limit);

    const acct = await req(port, "GET", "/api/billing/account", null, { "x-api-key": key });
    check("account lookup by key", acct.json?.account?.apiKey === key);

    const noKey = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" });
    check("metered call without key -> 401", noKey.status === 401 && noKey.json?.reason === "invalid_key");

    const m1 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": key });
    check("call 1 passes gate", m1.status !== 401 && m1.status !== 402, "remaining=" + m1.remaining);
    const m2 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": key });
    check("call 2 passes gate", m2.status !== 401 && m2.status !== 402);
    const m3 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": key });
    check("call 3 -> 402 quota exceeded", m3.status === 402 && m3.json?.reason === "quota_exceeded");

    const co = await req(port, "POST", "/api/billing/checkout", { plan: "starter" }, { "x-api-key": key });
    check("checkout without Stripe key -> 503", co.status === 503);
  } finally {
    server.close();
  }

  if (failed) {
    console.error(`\n${failed} billing smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll billing smoke checks passed.");
}

main().catch((err) => {
  console.error("Billing smoke crashed:", err);
  process.exit(1);
});
