# Decision Log

Architecture decisions for moderncatalog, newest first. Each entry is dated and
states the context, the decision, and the trade-offs accepted.

---

## 2026-08-29 — Fetch products directly in a Server Component, not via a Route Handler proxy

**Status:** Accepted

### Context

The landing page needs the product catalog from the Meridian Azure Functions API
(`GET /api/products?insurance=<slug>`). The call requires a function key and the
catalog is small and changes infrequently. Two options were considered:

- **A.** `await fetch(...)` directly inside the page Server Component.
- **B.** A Next.js Route Handler (`app/api/products/route.ts`) that proxies Azure,
  with the frontend calling that internal endpoint.

### Decision

Use option A — fetch Azure directly in the Server Component.

Rationale:

- **Secrets stay server-side.** The fetch runs on Vercel's server, so
  `AZURE_PRODUCTS_URL` and `AZURE_PRODUCTS_KEY` are never sent to the browser and
  never enter the client bundle.
- **The catalog changes rarely, so we cache aggressively.** Each request uses
  `next: { revalidate: 300 }`, keyed by URL — effectively one cached entry per
  insurance provider. Azure/SQL is hit at most once per provider per revalidation
  window regardless of traffic. This can be tightened to on-demand invalidation
  (`revalidateTag('products')` from a webhook) later without changing the page.
- **Less machinery.** No extra route, no second network hop, data fetching sits
  where it is rendered.

### Consequences

Accepted trade-offs:

- No client-side refetch. Filtering, search, "load more", or polling without a
  full navigation would require adding a Route Handler at that point.
- The raw API response shape (PascalCase `ProductRow` fields) is coupled to the
  page. A proxy would have been the natural place to rename/trim/validate once.
- No internal products endpoint for other consumers (mobile, webhooks).

Reversal is cheap: adding `app/api/products/route.ts` later is small and does not
disturb the existing page.

### Related

- Data fetching lives inline in `app/page.tsx` rather than a `lib/` module while
  there is a single consumer. Extract to `lib/products.ts` (with `server-only`)
  when a second route needs the data.
