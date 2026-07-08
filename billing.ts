// DropKit SaaS billing + metering core. React-free; bundled into the server by
// esbuild (imported from server.ts). Everything here is INERT unless billing is
// switched on via env, so the free/self-hosted app is unaffected by default.
//
// Enable with BILLING_ENABLED=true. Stripe features additionally require
// STRIPE_SECRET_KEY (+ price IDs + STRIPE_WEBHOOK_SECRET). Persistence uses
// Upstash Redis when UPSTASH_REDIS_REST_URL/_TOKEN are set (required on Vercel —
// serverless has no shared memory); otherwise an in-memory store (standalone dev).
import crypto from "crypto";

export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

export interface Plan {
  id: string;
  name: string;
  /** Stripe Price ID for the monthly subscription; null for the free tier. */
  priceId: string | null;
  /** Stripe Price ID for the annual subscription; null if not offered. */
  annualPriceId: string | null;
  /** Generations allowed per calendar month. */
  monthlyQuota: number;
  /** Display price for monthly billing, informational only. */
  priceLabel: string;
  /** Display price for annual billing, informational only. */
  annualPriceLabel: string;
  /**
   * Whether generations beyond monthlyQuota are allowed and billed as metered
   * overage (requires an active Stripe subscription on the account). The free
   * tier never overages — it hard-caps.
   */
  overage: boolean;
  /** Display price per overage unit, informational only. */
  overagePriceLabel: string;
}

// Overage defaults to on for paid plans, off for free. Toggle per plan via
// STARTER_OVERAGE / PRO_OVERAGE = "false".
const paidOverage = (envVar: string | undefined) => envVar !== "false";

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceId: null,
    annualPriceId: null,
    monthlyQuota: Number(process.env.FREE_QUOTA || 5),
    priceLabel: "$0",
    annualPriceLabel: "$0",
    overage: false,
    overagePriceLabel: "—",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER || null,
    annualPriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL || null,
    monthlyQuota: Number(process.env.STARTER_QUOTA || 100),
    priceLabel: process.env.STARTER_PRICE_LABEL || "$9/mo",
    annualPriceLabel: process.env.STARTER_ANNUAL_PRICE_LABEL || "$90/yr",
    overage: paidOverage(process.env.STARTER_OVERAGE),
    overagePriceLabel: process.env.STARTER_OVERAGE_LABEL || "$0.10/ea",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO || null,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || null,
    monthlyQuota: Number(process.env.PRO_QUOTA || 1000),
    priceLabel: process.env.PRO_PRICE_LABEL || "$29/mo",
    annualPriceLabel: process.env.PRO_ANNUAL_PRICE_LABEL || "$290/yr",
    overage: paidOverage(process.env.PRO_OVERAGE),
    overagePriceLabel: process.env.PRO_OVERAGE_LABEL || "$0.05/ea",
  },
};

// Resolve a Stripe Price ID for a plan + billing interval ("month" | "year").
export function priceIdForInterval(plan: Plan, interval: string | undefined): string | null {
  return interval === "year" ? plan.annualPriceId : plan.priceId;
}

export function getPlan(id: string | undefined): Plan {
  return (id && PLANS[id]) || PLANS.free;
}

// ---- One-time credit packs (pay-as-you-go) -------------------------------
// Non-subscription top-ups: a single Stripe payment adds non-expiring credits an
// account spends after its monthly quota runs out. Captures buyers who won't
// commit to a subscription. Purchasable only when a Stripe Price ID is configured.
export interface CreditPack {
  id: string;
  name: string;
  priceId: string | null;
  credits: number;
  priceLabel: string;
}

export const CREDIT_PACKS: Record<string, CreditPack> = {
  small: {
    id: "small",
    name: "Starter Pack",
    priceId: process.env.STRIPE_PRICE_CREDITS_SMALL || null,
    credits: Number(process.env.CREDITS_SMALL || 50),
    priceLabel: process.env.CREDITS_SMALL_LABEL || "$5",
  },
  large: {
    id: "large",
    name: "Value Pack",
    priceId: process.env.STRIPE_PRICE_CREDITS_LARGE || null,
    credits: Number(process.env.CREDITS_LARGE || 250),
    priceLabel: process.env.CREDITS_LARGE_LABEL || "$20",
  },
};

export function getCreditPack(id: string | undefined): CreditPack | undefined {
  return id ? CREDIT_PACKS[id] : undefined;
}

export interface Account {
  apiKey: string;
  email?: string;
  plan: string; // plan id
  stripeCustomerId?: string;
  usage: number; // included-quota generations used this period (capped at monthlyQuota)
  overage: number; // generations beyond quota this period (metered/billed)
  bonusCredits: number; // non-expiring pay-as-you-go / referral credits
  referralCode: string; // this account's code to share
  referredBy?: string; // apiKey of the referrer, if any
  periodStart: string; // "YYYY-MM" bucket the usage counts against
  history: Record<string, number>; // "YYYY-MM-DD" -> generations that day (last 30 days)
  createdAt: string;
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Number of days of per-day usage history retained on each account.
const HISTORY_DAYS = 30;

// Record one generation against today's bucket and prune anything older than the
// retention window. Date strings are ISO (YYYY-MM-DD) so lexical compare == chronological.
function bumpHistory(account: Account): void {
  const history = account.history || (account.history = {});
  const day = today();
  history[day] = (history[day] || 0) + 1;
  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const d of Object.keys(history)) {
    if (d < cutoff) delete history[d];
  }
}

export function newApiKey(): string {
  return "dk_live_" + crypto.randomBytes(24).toString("hex");
}

// Short, shareable, URL-safe referral code.
export function newReferralCode(): string {
  return crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
}

// ---- Storage abstraction -------------------------------------------------

export interface AccountStore {
  getByKey(apiKey: string): Promise<Account | null>;
  getByCustomer(customerId: string): Promise<Account | null>;
  getByReferral(code: string): Promise<Account | null>;
  put(account: Account): Promise<void>;
}

class InMemoryStore implements AccountStore {
  private byKey = new Map<string, Account>();
  private custIndex = new Map<string, string>();
  private refIndex = new Map<string, string>();
  async getByKey(apiKey: string) {
    return this.byKey.get(apiKey) ?? null;
  }
  async getByCustomer(customerId: string) {
    const key = this.custIndex.get(customerId);
    return key ? this.byKey.get(key) ?? null : null;
  }
  async getByReferral(code: string) {
    const key = this.refIndex.get(code);
    return key ? this.byKey.get(key) ?? null : null;
  }
  async put(account: Account) {
    this.byKey.set(account.apiKey, account);
    if (account.stripeCustomerId) this.custIndex.set(account.stripeCustomerId, account.apiKey);
    if (account.referralCode) this.refIndex.set(account.referralCode, account.apiKey);
  }
}

// Upstash Redis over its REST API (works on serverless; no SDK dependency).
class UpstashStore implements AccountStore {
  constructor(private url: string, private token: string) {}
  private async cmd(command: any[]): Promise<any> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data: any = await res.json();
    return data.result;
  }
  async getByKey(apiKey: string) {
    const v = await this.cmd(["GET", `acct:key:${apiKey}`]);
    return v ? (JSON.parse(v) as Account) : null;
  }
  async getByCustomer(customerId: string) {
    const key = await this.cmd(["GET", `acct:cust:${customerId}`]);
    return key ? this.getByKey(key) : null;
  }
  async getByReferral(code: string) {
    const key = await this.cmd(["GET", `acct:ref:${code}`]);
    return key ? this.getByKey(key) : null;
  }
  async put(account: Account) {
    await this.cmd(["SET", `acct:key:${account.apiKey}`, JSON.stringify(account)]);
    if (account.stripeCustomerId) {
      await this.cmd(["SET", `acct:cust:${account.stripeCustomerId}`, account.apiKey]);
    }
    if (account.referralCode) {
      await this.cmd(["SET", `acct:ref:${account.referralCode}`, account.apiKey]);
    }
  }
}

let storeSingleton: AccountStore | null = null;
export function getStore(): AccountStore {
  if (storeSingleton) return storeSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  storeSingleton = url && token ? new UpstashStore(url, token) : new InMemoryStore();
  return storeSingleton;
}

/** True on serverless without a shared store — accounts won't persist. */
export function storageIsEphemeral(): boolean {
  return !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ---- Accounts + metering -------------------------------------------------

// Create a free account. An optional referral code (from ?ref=) credits both the
// new account and the referrer with REFERRAL_BONUS credits; SIGNUP_BONUS credits
// every new account regardless. Bonus credits never expire.
export async function createAccount(email?: string, referredByCode?: string): Promise<Account> {
  const store = getStore();
  const signupBonus = Number(process.env.SIGNUP_BONUS || 0);
  const referralBonus = Number(process.env.REFERRAL_BONUS || 0);

  let referredBy: string | undefined;
  let bonusCredits = signupBonus;

  if (referredByCode && referralBonus > 0) {
    const referrer = await store.getByReferral(referredByCode.toUpperCase());
    if (referrer) {
      referredBy = referrer.apiKey;
      bonusCredits += referralBonus;
      referrer.bonusCredits = (referrer.bonusCredits || 0) + referralBonus;
      await store.put(referrer);
    }
  }

  const account: Account = {
    apiKey: newApiKey(),
    email,
    plan: "free",
    usage: 0,
    overage: 0,
    bonusCredits,
    referralCode: newReferralCode(),
    referredBy,
    periodStart: currentPeriod(),
    history: {},
    createdAt: new Date().toISOString(),
  };
  await store.put(account);
  return account;
}

// Add pay-as-you-go / promo credits to an account (used by the credit-pack
// webhook). Returns the updated account, or null if the key is unknown.
export async function addBonusCredits(apiKey: string, credits: number): Promise<Account | null> {
  const store = getStore();
  const account = await store.getByKey(apiKey);
  if (!account) return null;
  account.bonusCredits = (account.bonusCredits || 0) + credits;
  await store.put(account);
  return account;
}

export interface MeterResult {
  ok: boolean;
  reason?: "invalid_key" | "quota_exceeded";
  remaining?: number;
  limit?: number;
  plan?: string;
  /** True when this unit was allowed beyond quota and should be billed as overage. */
  overage?: boolean;
  /** Total overage units consumed this period (present when overage is true). */
  overageUsed?: number;
  /** Stripe customer to bill the overage against (present when overage is true). */
  customerId?: string;
  /** True when this unit was drawn from the account's bonus-credit balance. */
  bonus?: boolean;
  /** Remaining bonus-credit balance after this call. */
  bonusRemaining?: number;
}

// Check-and-consume one generation for an API key. Consumption order:
//   1. the plan's monthly included quota (resets each calendar month),
//   2. non-expiring bonus credits (pay-as-you-go / referral),
//   3. metered overage (paid plans with an active Stripe subscription),
//   4. otherwise hard-cap with quota_exceeded.
export async function meter(apiKey: string | undefined): Promise<MeterResult> {
  if (!apiKey) return { ok: false, reason: "invalid_key" };
  const store = getStore();
  const account = await store.getByKey(apiKey);
  if (!account) return { ok: false, reason: "invalid_key" };

  const period = currentPeriod();
  if (account.periodStart !== period) {
    account.periodStart = period;
    account.usage = 0;
    account.overage = 0;
  }
  account.bonusCredits = account.bonusCredits || 0;

  const plan = getPlan(account.plan);

  // 1. Included monthly quota.
  if (account.usage < plan.monthlyQuota) {
    account.usage += 1;
    bumpHistory(account);
    await store.put(account);
    return {
      ok: true,
      remaining: plan.monthlyQuota - account.usage,
      limit: plan.monthlyQuota,
      plan: plan.id,
      overage: false,
      bonusRemaining: account.bonusCredits,
    };
  }

  // 2. Bonus credits (pay-as-you-go / referral) — non-expiring.
  if (account.bonusCredits > 0) {
    account.bonusCredits -= 1;
    bumpHistory(account);
    await store.put(account);
    return {
      ok: true,
      remaining: 0,
      limit: plan.monthlyQuota,
      plan: plan.id,
      overage: false,
      bonus: true,
      bonusRemaining: account.bonusCredits,
    };
  }

  // 3. Metered overage (requires an active Stripe subscription).
  const canOverage = plan.overage && !!account.stripeCustomerId;
  if (!canOverage) {
    return { ok: false, reason: "quota_exceeded", remaining: 0, limit: plan.monthlyQuota, plan: plan.id };
  }
  account.overage = (account.overage || 0) + 1;
  bumpHistory(account);
  await store.put(account);
  return {
    ok: true,
    remaining: 0,
    limit: plan.monthlyQuota,
    plan: plan.id,
    overage: true,
    overageUsed: account.overage,
    customerId: account.stripeCustomerId,
    bonusRemaining: 0,
  };
}

export function publicAccount(account: Account) {
  const plan = getPlan(account.plan);
  const rolledOver = account.periodStart !== currentPeriod();
  const used = rolledOver ? 0 : account.usage;
  const overage = rolledOver ? 0 : account.overage || 0;
  return {
    apiKey: account.apiKey,
    email: account.email,
    plan: plan.id,
    planName: plan.name,
    used,
    limit: plan.monthlyQuota,
    overage,
    overageAllowed: plan.overage && !!account.stripeCustomerId,
    overagePriceLabel: plan.overagePriceLabel,
    bonusCredits: account.bonusCredits || 0,
    referralCode: account.referralCode || "",
    history: historySeries(account.history || {}),
  };
}

// A continuous, zero-filled last-30-days series (oldest → newest) built from the
// sparse per-day history map, ready for a client-side sparkline.
export function historySeries(history: Record<string, number>): Array<{ date: string; count: number }> {
  const series: Array<{ date: string; count: number }> = [];
  const now = Date.now();
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ date, count: history[date] || 0 });
  }
  return series;
}
