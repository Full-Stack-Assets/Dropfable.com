// Unit tests for the pure billing core (billing.ts). Fast and granular — they
// exercise meter()'s consumption order, monthly rollover, referral crediting,
// credit top-ups, and the plan/pack resolvers directly against the in-memory
// store, without booting the server. Run with `npm test` (tsx --test).
//
// Env is fixed BEFORE importing billing.ts (PLANS/quotas are read at module load),
// so quotas are deterministic regardless of the ambient environment.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FREE_QUOTA = "3";
process.env.STARTER_QUOTA = "2";
process.env.REFERRAL_BONUS = "5";
process.env.SIGNUP_BONUS = "0";
process.env.STRIPE_PRICE_STARTER = "price_starter";
process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_annual";
process.env.STRIPE_PRICE_CREDITS_SMALL = "price_credits_small";
process.env.CREDITS_SMALL = "50";
delete process.env.UPSTASH_REDIS_REST_URL; // force the in-memory store

const {
  createAccount,
  addBonusCredits,
  meter,
  getPlan,
  getCreditPack,
  priceIdForInterval,
  publicAccount,
  historySeries,
  getStore,
  PLANS,
} = await import("../billing.ts");

const todayISO = () => new Date().toISOString().slice(0, 10);

test("createAccount issues a free account with a referral code", async () => {
  const acct = await createAccount("a@example.com");
  assert.ok(acct.apiKey.startsWith("dk_live_"));
  assert.equal(acct.plan, "free");
  assert.equal(acct.usage, 0);
  assert.equal(acct.bonusCredits, 0);
  assert.match(acct.referralCode, /^[0-9A-F]{10}$/);
});

test("meter enforces the free monthly quota then hard-caps", async () => {
  const { apiKey } = await createAccount();
  const quota = PLANS.free.monthlyQuota;
  for (let i = 0; i < quota; i++) {
    const r = await meter(apiKey);
    assert.equal(r.ok, true, `call ${i + 1} within quota`);
    assert.equal(r.overage, false);
  }
  const over = await meter(apiKey);
  assert.equal(over.ok, false);
  assert.equal(over.reason, "quota_exceeded");
});

test("meter rejects an unknown/missing key", async () => {
  assert.equal((await meter(undefined)).reason, "invalid_key");
  assert.equal((await meter("dk_live_nope")).reason, "invalid_key");
});

test("bonus credits are spent after quota (even on the free plan)", async () => {
  const { apiKey } = await createAccount();
  const quota = PLANS.free.monthlyQuota;
  for (let i = 0; i < quota; i++) await meter(apiKey); // exhaust included quota
  await addBonusCredits(apiKey, 2);

  const b1 = await meter(apiKey);
  assert.equal(b1.ok, true);
  assert.equal(b1.bonus, true);
  assert.equal(b1.bonusRemaining, 1);
  const b2 = await meter(apiKey);
  assert.equal(b2.ok, true);
  assert.equal(b2.bonusRemaining, 0);
  const b3 = await meter(apiKey);
  assert.equal(b3.ok, false, "blocked once quota + credits are exhausted");
});

test("overage is allowed only for paid plans with a Stripe customer", async () => {
  const { apiKey } = await createAccount();
  const store = getStore();
  const acct = await store.getByKey(apiKey);
  assert.ok(acct);
  acct!.plan = "starter";
  acct!.stripeCustomerId = "cus_x";
  await store.put(acct!);

  const quota = PLANS.starter.monthlyQuota;
  for (let i = 0; i < quota; i++) {
    const r = await meter(apiKey);
    assert.equal(r.overage, false);
  }
  const over = await meter(apiKey);
  assert.equal(over.ok, true);
  assert.equal(over.overage, true);
  assert.equal(over.overageUsed, 1);
  assert.equal(over.customerId, "cus_x");
});

test("usage and overage reset on a new calendar month; credits persist", async () => {
  const { apiKey } = await createAccount();
  await addBonusCredits(apiKey, 4);
  const store = getStore();
  const acct = (await store.getByKey(apiKey))!;
  acct.usage = PLANS.free.monthlyQuota; // pretend quota is used up
  acct.periodStart = "2000-01"; // force a rollover on the next meter()
  await store.put(acct);

  const r = await meter(apiKey);
  assert.equal(r.ok, true);
  assert.equal(r.overage, false, "first call of the new month uses included quota, not a credit");
  const after = (await store.getByKey(apiKey))!;
  assert.equal(after.usage, 1);
  assert.equal(after.bonusCredits, 4, "purchased credits never expire");
});

test("referral credits both the referrer and the referee", async () => {
  const referrer = await createAccount("ref@example.com");
  const referee = await createAccount("new@example.com", referrer.referralCode);
  const bonus = Number(process.env.REFERRAL_BONUS);
  assert.equal(referee.bonusCredits, bonus);
  assert.equal(referee.referredBy, referrer.apiKey);

  const updatedReferrer = (await getStore().getByKey(referrer.apiKey))!;
  assert.equal(updatedReferrer.bonusCredits, bonus);
});

test("an unknown referral code grants no bonus and no referredBy", async () => {
  const acct = await createAccount("x@example.com", "ZZZZZZZZZZ");
  assert.equal(acct.bonusCredits, 0);
  assert.equal(acct.referredBy, undefined);
});

test("plan and credit-pack resolvers", () => {
  assert.equal(getPlan("pro").id, "pro");
  assert.equal(getPlan("nonexistent").id, "free");
  assert.equal(getPlan(undefined).id, "free");
  assert.equal(priceIdForInterval(PLANS.starter, "year"), "price_starter_annual");
  assert.equal(priceIdForInterval(PLANS.starter, "month"), "price_starter");
  assert.equal(getCreditPack("small")?.credits, 50);
  assert.equal(getCreditPack("nope"), undefined);
});

test("publicAccount exposes safe, complete fields", async () => {
  const { apiKey } = await createAccount("pub@example.com");
  const acct = (await getStore().getByKey(apiKey))!;
  const pub = publicAccount(acct);
  assert.equal(pub.plan, "free");
  assert.equal(pub.limit, PLANS.free.monthlyQuota);
  assert.equal(typeof pub.bonusCredits, "number");
  assert.match(pub.referralCode, /^[0-9A-F]{10}$/);
});

test("meter records per-day usage history", async () => {
  const { apiKey } = await createAccount();
  await meter(apiKey);
  await meter(apiKey);
  const acct = (await getStore().getByKey(apiKey))!;
  assert.equal(acct.history[todayISO()], 2, "two generations counted today");
});

test("history prunes entries older than the retention window", async () => {
  const { apiKey } = await createAccount();
  const store = getStore();
  const acct = (await store.getByKey(apiKey))!;
  acct.history["2000-01-01"] = 5; // ancient entry
  await store.put(acct);

  await meter(apiKey); // triggers a prune on write
  const after = (await store.getByKey(apiKey))!;
  assert.equal(after.history["2000-01-01"], undefined, "stale day dropped");
  assert.equal(after.history[todayISO()], 1);
});

test("historySeries returns a continuous zero-filled 30-day window", () => {
  const series = historySeries({ [todayISO()]: 3 });
  assert.equal(series.length, 30);
  assert.equal(series[29].date, todayISO(), "last entry is today");
  assert.equal(series[29].count, 3);
  assert.equal(series[0].count, 0, "older days zero-filled");
  // dates strictly increasing
  for (let i = 1; i < series.length; i++) assert.ok(series[i].date > series[i - 1].date);
});
