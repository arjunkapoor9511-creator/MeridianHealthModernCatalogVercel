# moderncatalog

A Next.js (App Router) app that renders the Meridian Health product catalog.
Catalog data comes from an Azure Functions HTTP API backed by Azure SQL.

/ (landing page) renders the raw JSON response from the products API for the
signed-in user's insurance cohort. Access is gated by a demo session (see
[Demo auth](#demo-auth)).

## Prerequisites

- Node.js 24+
- Access to the Meridian products Azure Function (URL + function key)

## Setup

```bash
npm install
```

Create `.env.local` in the project root (copy [.env.example](.env.example)):

```bash
AZURE_PRODUCTS_URL=https://<function-app>.azurewebsites.net/api/products
AZURE_PRODUCTS_KEY=<function-key>
SESSION_SECRET=<32+ char random>          # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MARKETPLACE_ENTRY_URL=<storefront URL>    # where MeridianHealth/site/index.html is served
LEGACY_ORIGIN=<legacy marketplace URL>   # not-yet-migrated cohorts are rewritten here
GLOBAL_CONFIG=<connection string>        # `vercel env pull` after connecting the Global Config store
```

`.env.local` is gitignored. All of these must also be set in the Vercel project
for the Development, Preview, and Production environments (`vercel env add ...`) —
`GLOBAL_CONFIG` is injected automatically when you connect the store.

## Develop

```bash
npm run dev      # http://localhost:3000
```

Next.js reads `.env.local` only at startup — restart the dev server after editing it.

## Scripts

| Command         | Purpose                              |
| --------------- | ------------------------------------ |
| `npm run dev`   | Local dev server with hot reload     |
| `npm run build` | Production build                     |
| `npm run start` | Serve the production build           |
| `npm run lint`  | ESLint                               |

## Data source

`GET {AZURE_PRODUCTS_URL}?insurance=<slug>`

- Auth: `x-functions-key` header (function-level key).
- `insurance` query param is required — `unitedhealthcare` or `humana`.
- Response: `{ insuranceProvider, count, products: ProductRow[] }`.

The API contract and sample requests live in the MeridianHealth repo
(`requests.http`).

## How data flows

The landing page ([app/page.tsx](app/page.tsx)) is an async Server Component. It
calls the Azure API on the server, caches the response
(`next: { revalidate: 300 }`), and renders it. The Azure URL and key never reach
the browser. See [DECISIONS.md](DECISIONS.md) for the rationale.

## Demo auth

There is no IdP. The MeridianHealth storefront hands users off via a persona link:

```
storefront "Sign in as Modern Mark / Legacy Luke"
  → GET /api/demo-login?persona=<modern-mark|legacy-luke>
      → maps persona → identity (inline map; stands in for an eligibility service)
      → mints a signed JWT, sets the `mm_session` cookie, 302 → /
  → proxy.ts verifies the cookie, then routes by cohort (table in Global Config):
      → no/invalid session          → 302 to MARKETPLACE_ENTRY_URL (storefront)
      → migrated cohort (united)    → this app; injects verified x-user-* headers
      → not-yet-migrated (humana)   → transparent rewrite to LEGACY_ORIGIN
  → app/page.tsx reads x-user-insurance and fetches that cohort's products
```

| Persona | `sub` | Insurance | Lands on |
| ------- | ----- | --------- | -------- |
| `modern-mark` | `UHC-44107` | `unitedhealthcare` | this app (26 products) |
| `legacy-luke` | `HUM-20938` | `humana` | legacy marketplace (rewrite; URL stays on this domain) |

Session details, the prod-hardening path, and the design rationale are in
[lib/session.ts](lib/session.ts) and [DECISIONS.md](DECISIONS.md).

Quick check:

```bash
npm run dev
curl -i "http://localhost:3000/api/demo-login?persona=modern-mark"   # 302 + Set-Cookie mm_session
curl -i "http://localhost:3000/"                                     # 302 → MARKETPLACE_ENTRY_URL (no cookie)
# with a legacy-luke cookie: GET / returns 200 + header x-middleware-rewrite: <LEGACY_ORIGIN>
```

### Cohort switch (cut over / roll back)

The modern-vs-legacy routing table lives in **Vercel Global Config**, read by
[lib/routing.ts](lib/routing.ts). Editing it takes effect globally in seconds —
**no redeploy, no build**. If Global Config is unreadable, routing falls back to
`DEFAULT_MIGRATED = ["unitedhealthcare"]`.

| Global Config key | Meaning |
| ----------------- | ------- |
| `migratedCohorts` | `string[]` of insurances served by this app |
| `cohortOverrides` | `{ [sub]: "modern" \| "legacy" }` — one member; wins over the cohort rule |
| `killSwitch`      | `true` → every signed-in user goes to legacy |

**Inspect** current state (read-only, no token):

```bash
node scripts/cohort.mjs            # prints the table + effective routing per cohort
```

**Edit** in the Vercel dashboard → **Storage → Global Config → Items**:

| Action | Set |
| ------ | --- |
| Cut Humana over | `migratedCohorts` = `["unitedhealthcare", "humana"]` |
| Roll back | `migratedCohorts` = `["unitedhealthcare"]` |
| Canary one member first | `cohortOverrides` = `{ "HUM-20938": "modern" }` |
| Panic (everyone → legacy) | `killSwitch` = `true` (set `false` to undo) |

**Cutover runbook**

1. Set `cohortOverrides` = `{ "HUM-20938": "modern" }`. Sign in as Legacy Luke,
   confirm the modern app works end to end for that one member.
2. Set `migratedCohorts` = `["unitedhealthcare", "humana"]`. Watch the proxy logs
   (`{"at":"proxy",...,"destination":...}`) and error rate for ~10–15 min.
3. Trouble → set `migratedCohorts` back to `["unitedhealthcare"]` (or
   `killSwitch` = `true`). Back on legacy within seconds.
4. Fine → remove the `HUM-20938` entry from `cohortOverrides`.

## Project structure

```
proxy.ts         Session gate + cohort routing (runs before every page)
app/
  layout.tsx     Root layout (html/body, fonts, metadata)
  page.tsx       Landing page — renders the products JSON for the session's insurance
  globals.css    Global styles (Tailwind v4)
  api/
    demo-login/  GET route: persona → session cookie → redirect
lib/
  session.ts     Sign / verify the demo session JWT
  routing.ts     modern-vs-legacy decision, backed by Global Config
scripts/
  cohort.mjs     Cut a cohort over / roll back (edits Global Config, no redeploy)
public/          Static assets
```

## Deploy

Pushes to `main` deploy to production via the GitHub–Vercel integration.
Branch pushes and PRs get preview deployments.

## Decisions

Architecture decisions are recorded in [DECISIONS.md](DECISIONS.md).
