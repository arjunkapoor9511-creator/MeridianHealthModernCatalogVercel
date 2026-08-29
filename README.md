# moderncatalog

A Next.js (App Router) app that renders the Meridian Health product catalog.
Catalog data comes from an Azure Functions HTTP API backed by Azure SQL.

/ (landing page) currently renders the raw JSON response from the products API.

## Prerequisites

- Node.js 24+
- Access to the Meridian products Azure Function (URL + function key)

## Setup

```bash
npm install
```

Create `.env.local` in the project root:

```bash
AZURE_PRODUCTS_URL=https://<function-app>.azurewebsites.net/api/products
AZURE_PRODUCTS_KEY=<function-key>
```

`.env.local` is gitignored. The same two variables must also be set in the
Vercel project for the Development, Preview, and Production environments
(`vercel env add ...`), otherwise preview/production builds fail at fetch time.

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

## Project structure

```
app/
  layout.tsx     Root layout (html/body, fonts, metadata)
  page.tsx       Landing page — fetches and renders the products JSON
  globals.css    Global styles (Tailwind v4)
public/          Static assets
```

## Deploy

Pushes to `main` deploy to production via the GitHub–Vercel integration.
Branch pushes and PRs get preview deployments.

## Decisions

Architecture decisions are recorded in [DECISIONS.md](DECISIONS.md).
