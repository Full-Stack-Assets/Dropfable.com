// Client side of the SaaS billing layer. Stores the caller's API key in
// localStorage and talks to the /api/billing/* routes. When billing is disabled
// on the server (the default), fetchBillingConfig() returns enabled:false and the
// UI never surfaces any of this — the app behaves exactly as before.

const KEY_STORAGE = "dropkit_api_key";

export interface BillingPlan {
  id: string;
  name: string;
  priceLabel: string;
  annualPriceLabel: string;
  monthlyQuota: number;
  purchasable: boolean;
  annualPurchasable: boolean;
  overage: boolean;
  overagePriceLabel: string;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceLabel: string;
  purchasable: boolean;
}

export interface BillingConfig {
  enabled: boolean;
  ephemeral: boolean;
  checkout: boolean;
  referralBonus: number;
  plans: BillingPlan[];
  creditPacks: CreditPack[];
}

export interface AccountInfo {
  apiKey: string;
  email?: string;
  plan: string;
  planName: string;
  used: number;
  limit: number;
  overage: number;
  overageAllowed: boolean;
  overagePriceLabel: string;
  bonusCredits: number;
  referralCode: string;
}

export type BillingInterval = "month" | "year";

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore storage errors (private mode) */
  }
}

// Auth header for the metered endpoints. Empty when no key is stored, so calls
// still work in the unmetered (billing-off) mode.
export function authHeaders(): Record<string, string> {
  const key = getApiKey();
  return key ? { "x-api-key": key } : {};
}

export async function fetchBillingConfig(): Promise<BillingConfig | null> {
  try {
    const res = await fetch("/api/billing/config");
    if (!res.ok) return null;
    return (await res.json()) as BillingConfig;
  } catch {
    return null;
  }
}

export async function signup(email?: string, ref?: string): Promise<{ account: AccountInfo; warning?: string }> {
  const res = await fetch("/api/billing/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ref }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sign up failed.");
  setApiKey(data.account.apiKey);
  return data;
}

export async function fetchAccount(): Promise<AccountInfo | null> {
  const key = getApiKey();
  if (!key) return null;
  const res = await fetch("/api/billing/account", { headers: { "x-api-key": key } });
  if (res.status === 404) {
    // Key no longer recognized (e.g. ephemeral store reset) — drop it.
    setApiKey(null);
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return data.account as AccountInfo;
}

export async function startCheckout(plan: string, interval: BillingInterval = "month"): Promise<string> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plan, interval }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start checkout.");
  return data.url as string;
}

export async function startTopup(pack: string): Promise<string> {
  const res = await fetch("/api/billing/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ pack }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start credit purchase.");
  return data.url as string;
}

export async function openPortal(): Promise<string> {
  const res = await fetch("/api/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not open billing portal.");
  return data.url as string;
}
