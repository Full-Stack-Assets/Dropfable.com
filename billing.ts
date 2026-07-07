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
  /** Stripe Price ID; null for the free tier (no checkout). */
  priceId: string | null;
  /** Generations allowed per calendar month. */
  monthlyQuota: number;
  /** Display price, informational only. */
  priceLabel: string;
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceId: null,
    monthlyQuota: Number(process.env.FREE_QUOTA || 5),
    priceLabel: "$0",
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER || null,
    monthlyQuota: Number(process.env.STARTER_QUOTA || 100),
    priceLabel: process.env.STARTER_PRICE_LABEL || "$9/mo",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO || null,
    monthlyQuota: Number(process.env.PRO_QUOTA || 1000),
    priceLabel: process.env.PRO_PRICE_LABEL || "$29/mo",
  },
};

export function getPlan(id: string | undefined): Plan {
  return (id && PLANS[id]) || PLANS.free;
}

export interface Account {
  apiKey: string;
  email?: string;
  plan: string; // plan id
  stripeCustomerId?: string;
  usage: number; // generations used in the current period
  periodStart: string; // "YYYY-MM" bucket the usage counts against
  createdAt: string;
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function newApiKey(): string {
  return "dk_live_" + crypto.randomBytes(24).toString("hex");
}

// ---- Storage abstraction -------------------------------------------------

export interface AccountStore {
  getByKey(apiKey: string): Promise<Account | null>;
  getByCustomer(customerId: string): Promise<Account | null>;
  put(account: Account): Promise<void>;
}

class InMemoryStore implements AccountStore {
  private byKey = new Map<string, Account>();
  private custIndex = new Map<string, string>();
  async getByKey(apiKey: string) {
    return this.byKey.get(apiKey) ?? null;
  }
  async getByCustomer(customerId: string) {
    const key = this.custIndex.get(customerId);
    return key ? this.byKey.get(key) ?? null : null;
  }
  async put(account: Account) {
    this.byKey.set(account.apiKey, account);
    if (account.stripeCustomerId) this.custIndex.set(account.stripeCustomerId, account.apiKey);
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
  async put(account: Account) {
    await this.cmd(["SET", `acct:key:${account.apiKey}`, JSON.stringify(account)]);
    if (account.stripeCustomerId) {
      await this.cmd(["SET", `acct:cust:${account.stripeCustomerId}`, account.apiKey]);
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

export async function createAccount(email?: string): Promise<Account> {
  const account: Account = {
    apiKey: newApiKey(),
    email,
    plan: "free",
    usage: 0,
    periodStart: currentPeriod(),
    createdAt: new Date().toISOString(),
  };
  await getStore().put(account);
  return account;
}

export interface MeterResult {
  ok: boolean;
  reason?: "invalid_key" | "quota_exceeded";
  remaining?: number;
  limit?: number;
  plan?: string;
}

// Check-and-consume one generation for an API key. Rolls the usage counter over
// at the start of each calendar month.
export async function meter(apiKey: string | undefined): Promise<MeterResult> {
  if (!apiKey) return { ok: false, reason: "invalid_key" };
  const store = getStore();
  const account = await store.getByKey(apiKey);
  if (!account) return { ok: false, reason: "invalid_key" };

  const period = currentPeriod();
  if (account.periodStart !== period) {
    account.periodStart = period;
    account.usage = 0;
  }

  const plan = getPlan(account.plan);
  if (account.usage >= plan.monthlyQuota) {
    return { ok: false, reason: "quota_exceeded", remaining: 0, limit: plan.monthlyQuota, plan: plan.id };
  }

  account.usage += 1;
  await store.put(account);
  return { ok: true, remaining: plan.monthlyQuota - account.usage, limit: plan.monthlyQuota, plan: plan.id };
}

export function publicAccount(account: Account) {
  const plan = getPlan(account.plan);
  if (account.periodStart !== currentPeriod()) {
    return { apiKey: account.apiKey, email: account.email, plan: plan.id, planName: plan.name, used: 0, limit: plan.monthlyQuota };
  }
  return {
    apiKey: account.apiKey,
    email: account.email,
    plan: plan.id,
    planName: plan.name,
    used: account.usage,
    limit: plan.monthlyQuota,
  };
}
