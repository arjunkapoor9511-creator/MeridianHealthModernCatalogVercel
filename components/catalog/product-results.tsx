import { ProductGrid } from "@/components/catalog/product-grid";
import { getProducts } from "@/lib/products";
import type { Insurance } from "@/lib/catalog";

/** Cached fetch (see lib/products.ts). Streams into the grid Suspense slot. */
export async function ProductResults({ insurance }: { insurance: Insurance }) {
  const products = await getProducts(insurance);
  return <ProductGrid products={products} />;
}
