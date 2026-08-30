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
  mapProductDetail,
  mapProductRow,
  type Insurance,
  type Product,
  type ProductDetail,
  type ProductDetailResponse,
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

// ---------------------------------------------------------------------------
// Single-product detail
// ---------------------------------------------------------------------------
// Backs the product detail popup. Same Azure function app and key as
// `getProducts`, different path (`AZURE_PRODUCT_DETAIL_URL` -> `/api/productdetail`).
// Reached from `app/api/product-detail/[sku]/route.ts` (the popup is opened by a
// client interaction, so it fetches through that route rather than a Server
// Component). `use cache` keeps the Azure hit to one per SKU per revalidation
// window regardless of how many members open the same product.
// ---------------------------------------------------------------------------

export async function getProductDetail(
  sku: string,
): Promise<ProductDetail | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag(`product:${sku}`);

  const base = process.env.AZURE_PRODUCT_DETAIL_URL;
  const key = process.env.AZURE_PRODUCTS_KEY;
  if (!base || !key) {
    throw new Error(
      "AZURE_PRODUCT_DETAIL_URL / AZURE_PRODUCTS_KEY are not configured",
    );
  }

  const res = await fetch(`${base}?sku=${encodeURIComponent(sku)}`, {
    headers: { "x-functions-key": key },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Product detail request failed: ${res.status} ${await res.text()}`,
    );
  }

  return mapProductDetail((await res.json()) as ProductDetailResponse);
}
