// ---------------------------------------------------------------------------
// Product catalog data access
// ---------------------------------------------------------------------------
// Fetches the Azure products API on the server and returns normalised
// `Product[]` for a given insurance cohort.
//
// Caching: `getProducts` is a `use cache` function (Cache Components). The
// response is keyed by insurance provider and changes rarely, so we hold it
// with a long cacheLife and tag it `products:<insurance>` for targeted
// on-demand invalidation later (a webhook calling `updateTag`).
//
// The Azure URL and function key are read here, on the server, and never reach
// the browser - the reason this fetch lives in a Server Component path (see
// DECISIONS.md, "Fetch products directly in a Server Component").
// ---------------------------------------------------------------------------

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  mapProductRow,
  type Insurance,
  type Product,
  type ProductsResponse,
} from "@/lib/catalog";

export async function getProducts(insurance: Insurance): Promise<Product[]> {
  "use cache";
  // API is near-static; serve stale fast, refresh hourly, keep for a day.
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag(`products:${insurance}`);

  const base = process.env.AZURE_PRODUCTS_URL;
  const key = process.env.AZURE_PRODUCTS_KEY;
  if (!base || !key) {
    throw new Error(
      "AZURE_PRODUCTS_URL / AZURE_PRODUCTS_KEY are not configured",
    );
  }

  const res = await fetch(`${base}?insurance=${insurance}`, {
    headers: { "x-functions-key": key },
  });

  if (!res.ok) {
    throw new Error(
      `Products request failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as ProductsResponse;
  return data.products.map(mapProductRow);
}
