"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useCatalog } from "@/components/catalog/catalog-store";
import { ProductCard } from "@/components/catalog/product-card";
import { CATALOG_GRID_CLASS } from "@/components/catalog/product-grid-skeleton";
import {
  filterProducts,
  isFilterActive,
  sortProducts,
  type Product,
} from "@/lib/catalog";

export function ProductGrid({ products }: { products: Product[] }) {
  const { filters, sort, clear } = useCatalog();

  const visible = useMemo(
    () => sortProducts(filterProducts(products, filters), sort),
    [products, filters, sort],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {visible.length === products.length
          ? `${products.length} products`
          : `${visible.length} of ${products.length} products`}
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No products match these filters</p>
          {isFilterActive(filters) && (
            <Button variant="outline" size="sm" onClick={clear}>
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className={CATALOG_GRID_CLASS}>
          {visible.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
