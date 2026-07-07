// Express wiring for the SaaS billing layer. Kept separate from billing.ts (the
// pure core) so the route/Stripe glue lives in one place. Everything here is a
// no-op unless BILLING_ENABLED=true, so the free/self-hosted app is unchanged.
//
// The Stripe SDK is imported lazily (only when a secret key is configured) so the
// standalone build never needs it at runtime unless billing is actually turned on.
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import {
  BILLING_ENABLED,
  PLANS,
  CREDIT_PACKS,
  getPlan,
  getCreditPack,
  getStore,
  createAccount,
  addBonusCredits,
  meter,
  publicAccount,
  storageIsEphemeral,
  priceIdForInterval,
} from "./billing";

let stripeSingleton: any = null;
async function getStripe(): Promise<any | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (stripeSingleton) return stripeSingleton;
  const Stripe = (await import("stripe")).default;
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

function appUrl(req: Request): string {
  return (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function apiKeyFrom(req: Request): string | undefined {
  const header = req.headers["x-api-key"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return (fromHeader || req.body?.apiKey || req.query?.key) as string | undefined;
}

// Report one overage unit to Stripe's metered billing (best-effort; a failure
// here must never block a generation the caller is entitled to). Requires
// STRIPE_OVERAGE_METER_EVENT to name a configured Stripe billing meter.
async function reportOverage(customerId: string | undefined): Promise<void> {
  const eventName = process.env.STRIPE_OVERAGE_METER_EVENT;
  if (!customerId || !eventName) return;
  const stripe = await getStripe();
  if (!stripe) return;
  try {
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: { stripe_customer_id: customerId, value: "1" },
    });
  } catch (err: any) {
    console.warn("[billing] overage meter event failed:", err?.message);
  }
}

// Per-request quota gate for the paid Gemini endpoints. A no-op when billing is
// off; otherwise it check-and-consumes one unit of the caller's monthly quota.
// Beyond quota, paid plans with overage enabled continue on metered billing.
export function requireQuota() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!BILLING_ENABLED) return next();
    const result = await meter(apiKeyFrom(req));
    if (!result.ok) {
      const code = result.reason === "invalid_key" ? 401 : 402;
      const error =
        result.reason === "invalid_key"
          ? "Missing or invalid API key. Create a free key on the Pricing page and send it as the x-api-key header."
          : "Monthly quota reached. Upgrade your plan (or enable overage on a paid plan) to keep generating.";
      return res.status(code).json({ error, reason: result.reason, limit: result.limit, plan: result.plan });
    }
    if (typeof result.remaining === "number") {
      res.setHeader("X-DropKit-Quota-Remaining", String(result.remaining));
      res.setHeader("X-DropKit-Quota-Limit", String(result.limit ?? ""));
    }
    if (result.overage) {
      res.setHeader("X-DropKit-Overage", String(result.overageUsed ?? 1));
      // Fire-and-forget so metering latency doesn't slow the generation.
      void reportOverage(result.customerId);
    }
    if (typeof result.bonusRemaining === "number") {
      res.setHeader("X-DropKit-Bonus-Remaining", String(result.bonusRemaining));
    }
    next();
  };
}

// The webhook must read the RAW request body to verify Stripe's signature, so it
// has to be registered BEFORE the global express.json() parser. Call this right
// after `const app = express()` and before app.use(express.json()).
export function registerBillingWebhook(app: Express): void {
  if (!BILLING_ENABLED) return;
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const stripe = await getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) return res.status(503).json({ error: "Stripe webhook not configured." });

    let event: any;
    try {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      console.warn("[billing] webhook signature verification failed:", err?.message);
      return res.status(400).json({ error: "Signature verification failed." });
    }

    try {
      await handleStripeEvent(event);
    } catch (err: any) {
      console.error("[billing] webhook handler error:", err?.message);
      // 200 so Stripe doesn't hammer retries for a bug on our side; logged above.
    }
    res.json({ received: true });
  });
}

// Map a Stripe Price ID (monthly or annual) back to one of our plan ids.
function planIdForPrice(priceId: string | undefined): string {
  if (!priceId) return "free";
  const match = Object.values(PLANS).find((p) => p.priceId === priceId || p.annualPriceId === priceId);
  return match ? match.id : "free";
}

async function handleStripeEvent(event: any): Promise<void> {
  const store = getStore();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const apiKey = session.client_reference_id as string | undefined;
      if (!apiKey) return;

      // One-time credit-pack purchase (mode: payment) — add non-expiring credits.
      if (session.mode === "payment") {
        const credits = Number(session.metadata?.credits || 0);
        if (credits > 0) await addBonusCredits(apiKey, credits);
        break;
      }

      // Subscription checkout — set the customer and activate the plan.
      const account = await store.getByKey(apiKey);
      if (!account) return;
      account.stripeCustomerId = (session.customer as string) || account.stripeCustomerId;
      const planId = (session.metadata && session.metadata.plan) || account.plan;
      account.plan = PLANS[planId] ? planId : account.plan;
      await store.put(account);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const account = await store.getByCustomer(sub.customer as string);
      if (!account) return;
      const priceId = sub.items?.data?.[0]?.price?.id as string | undefined;
      const active = sub.status === "active" || sub.status === "trialing";
      account.plan = active ? planIdForPrice(priceId) : "free";
      await store.put(account);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const account = await store.getByCustomer(sub.customer as string);
      if (!account) return;
      account.plan = "free";
      await store.put(account);
      break;
    }
    default:
      break;
  }
}

// JSON billing routes. Register AFTER app.use(express.json()).
export function registerBillingRoutes(app: Express): void {
  // Public config — always available so the frontend can decide whether to show
  // the Pricing UI. Reports enabled:false when billing is off.
  app.get("/api/billing/config", (_req: Request, res: Response) => {
    res.json({
      enabled: BILLING_ENABLED,
      ephemeral: BILLING_ENABLED && storageIsEphemeral(),
      checkout: BILLING_ENABLED && !!process.env.STRIPE_SECRET_KEY,
      referralBonus: Number(process.env.REFERRAL_BONUS || 0),
      plans: Object.values(PLANS).map((p) => ({
        id: p.id,
        name: p.name,
        priceLabel: p.priceLabel,
        annualPriceLabel: p.annualPriceLabel,
        monthlyQuota: p.monthlyQuota,
        purchasable: !!p.priceId,
        annualPurchasable: !!p.annualPriceId,
        overage: p.overage,
        overagePriceLabel: p.overagePriceLabel,
      })),
      creditPacks: Object.values(CREDIT_PACKS).map((c) => ({
        id: c.id,
        name: c.name,
        credits: c.credits,
        priceLabel: c.priceLabel,
        purchasable: !!c.priceId,
      })),
    });
  });

  if (!BILLING_ENABLED) return;

  // Create a free account + API key. Accepts an optional referral code.
  app.post("/api/billing/signup", async (req: Request, res: Response) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : undefined;
      const ref = typeof req.body?.ref === "string" ? req.body.ref.trim() : undefined;
      const account = await createAccount(email || undefined, ref || undefined);
      res.json({
        account: publicAccount(account),
        warning: storageIsEphemeral()
          ? "Storage is ephemeral on this deployment — set UPSTASH_REDIS_REST_URL/_TOKEN so accounts persist."
          : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Signup failed." });
    }
  });

  // Look up the caller's account/usage by API key.
  app.get("/api/billing/account", async (req: Request, res: Response) => {
    const apiKey = apiKeyFrom(req);
    if (!apiKey) return res.status(400).json({ error: "Provide your API key via the x-api-key header or ?key=." });
    const account = await getStore().getByKey(apiKey);
    if (!account) return res.status(404).json({ error: "Unknown API key." });
    res.json({ account: publicAccount(account) });
  });

  // Start a Stripe Checkout session to subscribe to a paid plan.
  app.post("/api/billing/checkout", async (req: Request, res: Response) => {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: "Checkout is not configured (missing STRIPE_SECRET_KEY)." });
    const apiKey = apiKeyFrom(req);
    const planId = req.body?.plan as string | undefined;
    const interval = req.body?.interval === "year" ? "year" : "month";
    if (!apiKey) return res.status(400).json({ error: "Missing API key." });
    if (!planId || !PLANS[planId]) return res.status(400).json({ error: "Unknown plan." });
    const plan = getPlan(planId);
    const priceId = priceIdForInterval(plan, interval);
    if (!priceId) {
      return res.status(400).json({ error: `Plan "${planId}" has no ${interval === "year" ? "annual" : "monthly"} price configured.` });
    }
    const account = await getStore().getByKey(apiKey);
    if (!account) return res.status(404).json({ error: "Unknown API key." });

    try {
      const base = appUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: apiKey,
        customer: account.stripeCustomerId || undefined,
        customer_email: account.stripeCustomerId ? undefined : account.email || undefined,
        metadata: { plan: planId, apiKey, interval },
        allow_promotion_codes: true,
        success_url: `${base}/?billing=success`,
        cancel_url: `${base}/?billing=cancelled`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Could not start checkout." });
    }
  });

  // Buy a one-time credit pack (pay-as-you-go). Stripe Checkout in payment mode;
  // the webhook credits the account when the payment completes.
  app.post("/api/billing/topup", async (req: Request, res: Response) => {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: "Credit purchase is not configured (missing STRIPE_SECRET_KEY)." });
    const apiKey = apiKeyFrom(req);
    const packId = req.body?.pack as string | undefined;
    if (!apiKey) return res.status(400).json({ error: "Missing API key." });
    const pack = getCreditPack(packId);
    if (!pack) return res.status(400).json({ error: "Unknown credit pack." });
    if (!pack.priceId) return res.status(400).json({ error: `Credit pack "${pack.id}" has no price configured.` });
    const account = await getStore().getByKey(apiKey);
    if (!account) return res.status(404).json({ error: "Unknown API key." });

    try {
      const base = appUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: pack.priceId, quantity: 1 }],
        client_reference_id: apiKey,
        customer: account.stripeCustomerId || undefined,
        customer_email: account.stripeCustomerId ? undefined : account.email || undefined,
        metadata: { apiKey, credits: String(pack.credits), pack: pack.id },
        allow_promotion_codes: true,
        success_url: `${base}/?billing=credits`,
        cancel_url: `${base}/?billing=cancelled`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Could not start credit purchase." });
    }
  });

  // Open the Stripe billing portal to manage/cancel a subscription.
  app.post("/api/billing/portal", async (req: Request, res: Response) => {
    const stripe = await getStripe();
    if (!stripe) return res.status(503).json({ error: "Billing portal is not configured." });
    const apiKey = apiKeyFrom(req);
    if (!apiKey) return res.status(400).json({ error: "Missing API key." });
    const account = await getStore().getByKey(apiKey);
    if (!account?.stripeCustomerId) return res.status(400).json({ error: "No Stripe customer for this account yet." });
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: account.stripeCustomerId,
        return_url: `${appUrl(req)}/?billing=portal`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Could not open billing portal." });
    }
  });
}
