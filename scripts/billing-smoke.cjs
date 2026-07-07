// Billing smoke test: boots the bundled app with BILLING_ENABLED=true and drives
// the whole SaaS flow offline (no network, no real Stripe/GEMINI calls):
//   - signup issues a key; the metered endpoint enforces the free hard cap
//     (401 without a key, consume to quota, 402 when exhausted with no overage);
//   - a self-signed Stripe webhook upgrades an account to a paid plan, after which
//     generations past quota succeed as metered overage (counter + header);
//   - the annual checkout path resolves the annual price (400 when unconfigured).
// A type-check can't catch broken metering/overage wiring; this can.
process.env.VERCEL = "1"; // skip the standalone listen() bootstrap
process.env.BILLING_ENABLED = "true";
process.env.FREE_QUOTA = "2";
process.env.STARTER_QUOTA = "1";
process.env.STRIPE_PRICE_STARTER = "price_starter_monthly";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy"; // lets the webhook verify signatures offline
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
// STRIPE_OVERAGE_METER_EVENT intentionally unset → overage is counted locally but
// no Stripe meter event is emitted (keeps the test fully offline).

const http = require("http");
const path = require("path");
const crypto = require("crypto");

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
  return { status: res.status, json, remaining: res.headers.get("x-dropkit-quota-remaining"), overage: res.headers.get("x-dropkit-overage") };
}

// Post a Stripe-signed webhook event with the exact raw body that was signed.
async function webhook(port, event) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
  const res = await fetch(`http://localhost:${port}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": `t=${t},v1=${sig}` },
    body: payload,
  });
  return res.status;
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
    const starterCfg = (cfg.json?.plans || []).find((p) => p.id === "starter");
    check("config exposes plans", cfg.json?.enabled === true && Array.isArray(cfg.json?.plans) && cfg.json.plans.length > 0);
    check("config exposes annual + overage fields", !!starterCfg && typeof starterCfg.annualPriceLabel === "string" && typeof starterCfg.overage === "boolean");

    // --- Free plan: hard cap ---
    const a = (await req(port, "POST", "/api/billing/signup", { email: "free@example.com" })).json?.account?.apiKey;
    check("signup issues dk_live_ key", !!a && a.startsWith("dk_live_"));
    const noKey = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" });
    check("no key -> 401", noKey.status === 401 && noKey.json?.reason === "invalid_key");
    const f1 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": a });
    const f2 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": a });
    check("free calls within quota pass gate", f1.status !== 402 && f2.status !== 402, "remaining=" + f1.remaining);
    const f3 = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" }, { "x-api-key": a });
    check("free over quota -> 402 hard cap", f3.status === 402 && f3.json?.reason === "quota_exceeded");

    // --- Paid plan via webhook: overage allowed ---
    const b = (await req(port, "POST", "/api/billing/signup", { email: "paid@example.com" })).json?.account?.apiKey;
    const whStatus = await webhook(port, {
      type: "checkout.session.completed",
      data: { object: { client_reference_id: b, customer: "cus_test_b", metadata: { plan: "starter" } } },
    });
    check("webhook accepted (signed)", whStatus === 200, "status=" + whStatus);

    const acctB = await req(port, "GET", "/api/billing/account", null, { "x-api-key": b });
    check("account upgraded to starter w/ overage", acctB.json?.account?.plan === "starter" && acctB.json?.account?.overageAllowed === true, "limit=" + acctB.json?.account?.limit);

    const p1 = await req(port, "POST", "/api/v1/generate", { product: "planner", niche: "x" }, { "x-api-key": b });
    check("paid call 1 within quota", p1.status !== 402, "remaining=" + p1.remaining);
    const p2 = await req(port, "POST", "/api/v1/generate", { product: "planner", niche: "x" }, { "x-api-key": b });
    check("paid over quota -> overage (not 402)", p2.status !== 402 && p2.overage === "1", "status=" + p2.status + " overageHdr=" + p2.overage);

    const acctB2 = await req(port, "GET", "/api/billing/account", null, { "x-api-key": b });
    check("overage counter recorded", acctB2.json?.account?.overage === 1, "overage=" + acctB2.json?.account?.overage);

    // --- Annual checkout path (no annual price configured -> 400, offline) ---
    const annual = await req(port, "POST", "/api/billing/checkout", { plan: "starter", interval: "year" }, { "x-api-key": b });
    check("annual checkout resolves annual price", annual.status === 400 && /annual/i.test(annual.json?.error || ""), "status=" + annual.status);

    // --- Public API discovery ---
    const products = await req(port, "GET", "/api/v1/products");
    check("v1 products lists catalog", Array.isArray(products.json?.products) && products.json.products.length > 0);
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
