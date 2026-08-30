import { Skeleton } from "@/components/ui/skeleton";

/** One placeholder card. Dimensions mirror <ProductCard> exactly so the
 *  skeleton -> real-card swap causes no layout shift. */
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Skeleton className="h-3 w-16" />
        <div className="min-h-[2.5rem] space-y-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="mt-0.5 h-5 w-20" />
        <Skeleton className="mt-1 h-3 w-28" />
        <Skeleton className="mt-1 h-3 w-32" />
        <Skeleton className="mt-auto h-7 w-full" />
      </div>
    </div>
  );
}

export const CATALOG_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** Mirrors <ProductGrid>'s wrapper exactly — the `space-y-4` container and the
 *  result-count line — so streaming the real grid in shifts nothing. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-5 w-28" />
      <div className={CATALOG_GRID_CLASS}>
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
