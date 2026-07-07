// Public, versioned REST API for third-party integrators. A stable surface
// (`/api/v1/*`) distinct from the internal `/api/*` routes the app's own UI uses,
// so we can evolve the app without breaking external callers. It reuses the same
// generator, per-IP rate limit, and quota metering as the first-party endpoints.
//
// Auth: when billing is enabled every metered call requires the caller's API key
// in the `x-api-key` header (enforced by the shared requireQuota middleware). When
// billing is disabled the API is open, matching the free/self-hosted app.
import type { Express, RequestHandler } from "express";
import { BILLING_ENABLED, getStore, publicAccount } from "./billing";

interface PublicApiDeps {
  /** The shared generator (server.ts's manufactureProduct). */
  manufacture: (productId: string, niche: string, angle?: string, language?: string) => Promise<any>;
  /** id → human label for the generatable product catalog. */
  productLabels: Record<string, string>;
  /** Shared per-IP rate limiter. */
  rateLimit: RequestHandler;
  /** Shared quota gate (already instantiated: requireQuota()). */
  requireQuota: RequestHandler;
}

export function registerPublicApi(app: Express, deps: PublicApiDeps): void {
  const { manufacture, productLabels, rateLimit, requireQuota } = deps;

  // Self-describing index so integrators can discover the surface.
  app.get("/api/v1", (_req, res) => {
    res.json({
      name: "DropKit Generator API",
      version: "1",
      auth: BILLING_ENABLED
        ? "Send your API key as the 'x-api-key' request header. Create one on the Pricing page."
        : "No authentication required (billing is disabled on this instance).",
      endpoints: {
        "GET /api/v1/products": "List the product types you can generate.",
        "GET /api/v1/account": "Your plan, quota, usage, and overage (requires x-api-key).",
        "POST /api/v1/generate": "Generate a product. JSON body: { product, niche, angle?, language? }.",
      },
      responseHeaders: {
        "X-DropKit-Quota-Remaining": "Generations left in the current period.",
        "X-DropKit-Quota-Limit": "Your plan's monthly quota.",
        "X-DropKit-Overage": "Overage units consumed this period (only when over quota).",
      },
    });
  });

  // Discoverable product catalog.
  app.get("/api/v1/products", (_req, res) => {
    res.json({ products: Object.entries(productLabels).map(([id, label]) => ({ id, label })) });
  });

  // Account/usage lookup for the caller's key.
  app.get("/api/v1/account", async (req, res) => {
    if (!BILLING_ENABLED) {
      return res.json({ billing: false, message: "Billing is disabled on this instance; there is no quota." });
    }
    const key = (req.headers["x-api-key"] as string) || undefined;
    if (!key) return res.status(401).json({ error: "Provide your API key via the 'x-api-key' header." });
    const account = await getStore().getByKey(key);
    if (!account) return res.status(401).json({ error: "Invalid API key." });
    res.json({ billing: true, account: publicAccount(account) });
  });

  // The metered generator. rateLimit → requireQuota → generate. Quota headers are
  // set by requireQuota; over-quota paid callers are billed via overage.
  app.post("/api/v1/generate", rateLimit, requireQuota, async (req, res) => {
    try {
      const productId = (req.body?.product || req.body?.productId) as string | undefined;
      const { niche, angle, language } = req.body || {};
      if (!productId) return res.status(400).json({ error: "Field 'product' is required (see GET /api/v1/products)." });
      const data = await manufacture(productId, niche, angle, language);
      res.json({ product: data });
    } catch (err: any) {
      const msg = err?.message || "Generation failed.";
      const status = /required|invalid product/i.test(msg) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });
}
