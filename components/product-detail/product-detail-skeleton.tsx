import { Skeleton } from "@/components/ui/skeleton";

/** Fills the info column while the detail fetch is in flight. Sized so the
 *  skeleton -> content swap keeps the dialog from jumping. */
export function ProductDetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-full" />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
