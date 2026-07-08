# DropKit Public API (v1)

A stable, versioned REST surface for generating digital products programmatically.
It reuses the same generator, per-IP rate limit, and quota metering as the web app,
so integrations are billed exactly like first-party usage.

Base URL: your deployment origin (e.g. `https://your-app.vercel.app`).

## Authentication

When billing is enabled (`BILLING_ENABLED=true`), every metered call must send an
API key in the `x-api-key` header. Create a key on the app's **Pricing** page (or
`POST /api/billing/signup`). When billing is disabled, the API is open.

```
x-api-key: dk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Rate limits & quota headers

Requests are rate-limited per IP (`RATE_LIMIT_PER_MIN`, default 20/min → `429` when
exceeded). Metered responses carry your remaining allowance:

| Header | Meaning |
| --- | --- |
| `X-DropKit-Quota-Remaining` | Included-quota generations left this month. |
| `X-DropKit-Quota-Limit` | Your plan's monthly quota. |
| `X-DropKit-Bonus-Remaining` | Remaining non-expiring bonus credits. |
| `X-DropKit-Overage` | Overage units consumed this month (only when over quota). |

Consumption order per generation: **included quota → bonus credits → metered
overage → hard cap**. Over the limit with no credits/overage returns `402`.

## Endpoints

### `GET /api/health`
Unauthenticated readiness probe. Returns billing/storage/model status, uptime, and
the deployed commit. Never rate-limited.

### `GET /api/v1`
Self-describing index of the API surface.

### `GET /api/v1/products`
Lists the generatable product types.

```json
{ "products": [ { "id": "planner", "label": "Planner / Workbook" }, ... ] }
```

### `GET /api/v1/account`
Your plan, quota, usage, overage, bonus-credit balance, referral code, and a
`history` array — a continuous 30-day daily usage series (`{ date, count }`, oldest
→ newest) suitable for charting. Requires `x-api-key`.

### `POST /api/v1/generate`
Generate a product. Metered.

Request body:

| Field | Required | Description |
| --- | --- | --- |
| `product` | yes | Product type id (see `/api/v1/products`). Alias: `productId`. |
| `niche` | yes | Target audience / niche. |
| `angle` | no | Optional angle or flavor. |
| `language` | no | Output language (default English). |

```bash
curl -X POST https://your-app/api/v1/generate \
  -H "x-api-key: dk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"product":"planner","niche":"busy parents","angle":"minimalist"}'
```

Response: `{ "product": { ...ManufactureResult... } }` — the full product content plus
Etsy/Gumroad sales copy (title, tags, price recommendation, listing description).

## Error responses

All errors are JSON `{ "error": "..." }` with an appropriate status:

| Status | Meaning |
| --- | --- |
| `400` | Missing/invalid field (e.g. no `product`). |
| `401` | Missing or invalid API key (billing enabled). |
| `402` | Monthly quota reached and no credits/overage available. |
| `429` | Rate limit exceeded — retry after a minute. |
| `500` | Upstream generation error — safe to retry transient failures. |

## Billing endpoints (first-party)

The web app uses these; integrators typically only need `signup` to mint a key.

- `GET /api/billing/config` — public plan/pack catalog and feature flags.
- `POST /api/billing/signup` — create a free account + API key. Body: `{ email?, ref? }`.
- `GET /api/billing/account` — account/usage (via `x-api-key`).
- `POST /api/billing/checkout` — start a subscription Checkout. Body: `{ plan, interval? }`.
- `POST /api/billing/topup` — buy a one-time credit pack. Body: `{ pack }`.
- `POST /api/billing/portal` — open the Stripe billing portal.
- `POST /api/billing/webhook` — Stripe webhook sink (raw body; signature-verified).
