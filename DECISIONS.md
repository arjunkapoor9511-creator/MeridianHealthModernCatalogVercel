# Decision Log

Architecture decisions for moderncatalog, newest first. Each entry is dated and
states the context, the decision, and the trade-offs accepted.

---

## 2026-08-29 — Cohort routing table in Global Config, read directly (not via the Flags SDK)

**Status:** Accepted

### Context

`proxy.ts` decides modern-vs-legacy per insurance cohort. That list was a
hard-coded array — changing it needed an edit + `git push` + a Vercel build
(minutes; the build can fail). We need to flip a cohort and, more importantly,
**roll back instantly** when errors climb.

### Decision

Move the routing table into **Vercel Global Config** (formerly Edge Config;
package `@vercel/global-config`, connection string `GLOBAL_CONFIG`) and read it
directly from `proxy.ts` via `lib/routing.ts`.

- Reads are sub-millisecond and in-region — no latency cost in the proxy.
- Edits (in the Vercel dashboard → Storage → Global Config → Items) propagate
  globally in seconds with **no redeploy and no build**. That is the
  instant-rollback property. `scripts/cohort.mjs` is a read-only inspector that
  prints current state and the exact edit to make.
- Config shape: `migratedCohorts` (string[]), `cohortOverrides`
  (`{ [sub]: "modern" | "legacy" }`, wins over the cohort rule — canary/exclude a
  single member), `killSwitch` (bool — everyone to legacy).
- `lib/routing.ts` falls back to `DEFAULT_MIGRATED = ["unitedhealthcare"]` if
  Global Config is unset, unreachable, or malformed — a config outage can never
  route a cohort somewhere untested.
- `proxy.ts` logs one structured line per request (`{at,sub,insurance,destination}`)
  so a spike can be correlated with the cohort during a cutover.

**Not** the Vercel Flags SDK (`flags`). It is an abstraction over a backing store
(which would still be Global Config), and its main value-add — consistent
percentage bucketing for experiments — buys nothing for an all-or-nothing
per-cohort migration decided in middleware. Revisit if we want *gradual* rollout
(10% → 50% → 100% of a cohort, bucketed by `sub`) or Vercel Toolbar per-browser
overrides; the Flags SDK would layer on top of the same Global Config without
changing the rollback path.

### Consequences

- New runtime dependency on Global Config availability in the proxy; mitigated by
  the code fallback.
- The routing table is operational state that lives outside git — its current
  value is not visible in the repo. `node scripts/cohort.mjs` prints it.
- Cutover/rollback is a manual dashboard edit. Scripting it would need a
  team-scoped Vercel API token (the project token `vcp_…` and the read-only
  connection-string token can't write Global Config items); deferred.
- Global Config change propagation is "seconds", not truly instantaneous.

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
  cookie on every page request and routes by cohort:
  - no/invalid session → 302 to `MARKETPLACE_ENTRY_URL` (the storefront);
  - **migrated** cohort (`MIGRATED` array — `unitedhealthcare` today) → continue
    to this app, stripping any client-supplied `x-user-*` and injecting the
    **verified** `x-user-insurance` / `-sub` / `-name`;
  - **not-yet-migrated** cohort (`humana`) → `NextResponse.rewrite` to
    `LEGACY_ORIGIN` — transparent, the browser URL stays on this domain.
- **`app/page.tsx`** reads `x-user-insurance` instead of a hard-coded constant.
- The persona query param is not a secret and rides in the URL; the **session
  credential is only ever set server-side in a cookie**, never in a URL.
- `MIGRATED` is hard-coded for the demo; production would read it from Edge Config
  so cohorts flip without a redeploy (with per-user overrides for testing).
- **Rewrite, not redirect**, for the legacy hop: keeps the strangler facade
  (users don't see a different URL). Trade-off accepted: the legacy site's own
  deep links (`/marketplace/*`) resolve against this domain and 404 until a
  unified domain exists; only its landing page works through the rewrite, which
  is all the demo needs. The legacy blob is self-contained (inline CSS/JS), so
  the landing page renders correctly when proxied.

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
