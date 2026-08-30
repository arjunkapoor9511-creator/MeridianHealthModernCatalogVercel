import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

/** Prerendered static shell shown until the identity headers resolve (instant
 *  in practice). Layout matches <Catalog> so nothing shifts on swap. */
export function CatalogShellSkeleton() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-y-2 border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-4 w-16" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Skeleton className="h-8 w-[190px]" />
          </div>
          <ProductGridSkeleton />
        </div>
      </div>
    </div>
  );
}
