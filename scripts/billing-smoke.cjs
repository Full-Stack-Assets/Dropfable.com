// Billing smoke test: boots the bundled app with BILLING_ENABLED=true and drives
// the whole SaaS flow offline (no network, no real Stripe/GEMINI calls):
//   - signup issues a key + referral code; the metered endpoint enforces the free
//     hard cap (401 without a key, consume to quota, 402 when exhausted);
//   - a self-signed Stripe webhook upgrades an account to a paid plan, after which
//     generations past quota succeed as metered overage (counter + header);
//   - a one-time credit-pack webhook (mode: payment) tops up non-expiring bonus
//     credits, which are spent after quota — even on the free plan;
//   - referral signups grant bonus credits to both the referrer and the referee;
//   - the annual checkout path resolves the annual price (400 when unconfigured).
// A type-check can't catch broken metering/credit/referral wiring; this can.
process.env.VERCEL = "1"; // skip the standalone listen() bootstrap
process.env.BILLING_ENABLED = "true";
process.env.FREE_QUOTA = "2";
process.env.STARTER_QUOTA = "1";
process.env.REFERRAL_BONUS = "10";
process.env.CREDITS_SMALL = "3";
process.env.STRIPE_PRICE_CREDITS_SMALL = "price_credits_small";
process.env.STRIPE_PRICE_STARTER = "price_starter_monthly";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy"; // lets the webhook verify signatures offline
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
// STRIPE_OVERAGE_METER_EVENT intentionally unset → overage counted locally only.

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
  return {
    status: res.status,
    json,
    remaining: res.headers.get("x-dropkit-quota-remaining"),
    overage: res.headers.get("x-dropkit-overage"),
    bonus: res.headers.get("x-dropkit-bonus-remaining"),
  };
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

const gen = (port, key) => req(port, "POST", "/api/v1/generate", { product: "planner", niche: "x" }, { "x-api-key": key });

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
    check("config exposes credit packs + referral bonus", Array.isArray(cfg.json?.creditPacks) && cfg.json.creditPacks.length > 0 && cfg.json?.referralBonus === 10);

    // --- Free plan: hard cap ---
    const aResp = (await req(port, "POST", "/api/billing/signup", { email: "free@example.com" })).json?.account;
    const a = aResp?.apiKey;
    check("signup issues dk_live_ key + referral code", !!a && a.startsWith("dk_live_") && !!aResp?.referralCode);
    const noKey = await req(port, "POST", "/api/manufacture", { productId: "planner", niche: "x" });
    check("no key -> 401", noKey.status === 401 && noKey.json?.reason === "invalid_key");
    const f1 = await gen(port, a);
    const f2 = await gen(port, a);
    check("free calls within quota pass gate", f1.status !== 402 && f2.status !== 402, "remaining=" + f1.remaining);
    const f3 = await gen(port, a);
    check("free over quota -> 402 hard cap", f3.status === 402 && f3.json?.reason === "quota_exceeded");

    // --- Credit pack (one-time payment webhook) tops up a FREE account ---
    const d = (await req(port, "POST", "/api/billing/signup", {})).json?.account?.apiKey;
    const packWh = await webhook(port, {
      type: "checkout.session.completed",
      data: { object: { mode: "payment", client_reference_id: d, metadata: { credits: "3", pack: "small" } } },
    });
    check("credit-pack webhook accepted", packWh === 200, "status=" + packWh);
    const acctD = await req(port, "GET", "/api/billing/account", null, { "x-api-key": d });
    check("bonus credits added", acctD.json?.account?.bonusCredits === 3, "bonus=" + acctD.json?.account?.bonusCredits);
    // 2 included + 3 bonus = 5 allowed, 6th blocked.
    let lastFree;
    for (let i = 0; i < 5; i++) lastFree = await gen(port, d);
    check("free plan spends bonus credits past quota", lastFree.status !== 402, "bonusRemainingHdr=" + lastFree.bonus);
    const d6 = await gen(port, d);
    check("blocked after quota + credits exhausted", d6.status === 402);

    // --- Referral: referee + referrer both earn credits ---
    const ref = (await req(port, "POST", "/api/billing/signup", { ref: aResp.referralCode })).json?.account;
    check("referee granted referral credits", ref?.bonusCredits === 10, "bonus=" + ref?.bonusCredits);
    const acctA = await req(port, "GET", "/api/billing/account", null, { "x-api-key": a });
    check("referrer granted referral credits", acctA.json?.account?.bonusCredits === 10, "bonus=" + acctA.json?.account?.bonusCredits);

    // --- Paid plan via webhook: overage allowed ---
    const b = (await req(port, "POST", "/api/billing/signup", { email: "paid@example.com" })).json?.account?.apiKey;
    const whStatus = await webhook(port, {
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", client_reference_id: b, customer: "cus_test_b", metadata: { plan: "starter" } } },
    });
    check("subscription webhook accepted (signed)", whStatus === 200, "status=" + whStatus);
    const acctB = await req(port, "GET", "/api/billing/account", null, { "x-api-key": b });
    check("account upgraded to starter w/ overage", acctB.json?.account?.plan === "starter" && acctB.json?.account?.overageAllowed === true);
    const p1 = await gen(port, b); // within quota (1)
    const p2 = await gen(port, b); // over quota -> overage
    check("paid over quota -> overage (not 402)", p1.status !== 402 && p2.status !== 402 && p2.overage === "1", "overageHdr=" + p2.overage);

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
