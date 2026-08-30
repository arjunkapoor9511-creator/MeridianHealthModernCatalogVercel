# Decision Log

Architecture decisions for moderncatalog, newest first. Each entry is dated and
states the context, the decision, and the trade-offs accepted.

---

## 2026-08-29 — Demo auth handoff: signed session cookie + `proxy.ts`, not a token in the URL

**Status:** Accepted (demo scaffolding)

### Context

The MeridianHealth storefront (`MeridianHealth/site/index.html`) needs to hand an
authenticated user to this app, carrying their insurance provider so the right
catalog cohort renders. There is no IdP for the demo. A prior suggestion was to
pass one JWT with all user attributes in the redirect URL.

### Decision

- **`GET /api/demo-login?persona=<modern-mark|legacy-luke>`** maps a persona to a
  hard-coded identity, mints an **HS256-signed session JWT**, sets it as the
  `mm_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in prod), and
  302-redirects to `/`. The persona→identity map lives inline in the route — it
  stands in for a member/eligibility service lookup.
- **`proxy.ts`** (Next.js 16's renamed middleware, Node.js runtime) verifies the
  cookie on every page request. No/invalid session → 302 to
  `MARKETPLACE_ENTRY_URL` (the storefront). Valid → it strips any client-supplied
  `x-user-*` headers and injects the **verified** `x-user-insurance` / `-sub` /
  `-name` for the render.
- **`app/page.tsx`** reads `x-user-insurance` instead of a hard-coded constant.
- The persona query param is not a secret and rides in the URL; the **session
  credential is only ever set server-side in a cookie**, never in a URL.
- Both cohorts currently render on this app. The "not-yet-migrated → rewrite to
  the legacy origin" branch is a commented stub in `proxy.ts`.

### Consequences

Accepted trade-offs:

- **`await headers()` makes `/` render dynamically** (per request). The `fetch`
  Data Cache is separate and keyed by URL, so each insurance still gets its own
  5-minute entry — the Azure call stays cheap.
- **HS256 is symmetric** — anyone with `SESSION_SECRET` can mint a session. Fine
  when one app both signs and verifies; a real storefront→app handoff needs
  asymmetric signing or an encrypted JWE so the signer holds only a public key.
- No `aud` / `jti` / revocation / refresh; 8h TTL. Documented in
  `lib/session.ts`, not built.
- Insurance is frozen into the token for the demo; production should read it
  fresh from the system of record (plans change).
- `proxy.ts` runs on every non-`/api` route; the matcher must keep excluding
  `/api` or `/api/demo-login` becomes unreachable without a session.

Reversal / evolution is cheap: swapping `demo-login` for a real OIDC callback
leaves the cookie contract, `proxy.ts`, and the page unchanged.

### Related

- Full design + verification steps: `demo-auth-plan.md` (gitignored).
- Cross-domain auth / strangler-fig routing discussion: `interview-prep.md`
  (gitignored).
- This is the "second consumer" that triggered extracting shared server code
  into `lib/` (`lib/session.ts`), as anticipated below.

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
