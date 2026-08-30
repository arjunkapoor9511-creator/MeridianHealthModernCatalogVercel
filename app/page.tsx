// Product catalog page.
//
// Rendering (Cache Components / PPR):
//   - Static shell (prerendered): the "Meridian Health" header, the basket
//     button, and <CatalogShellSkeleton/> (filter rail + sort + grid skeletons).
//   - <Catalog/> streams in as soon as proxy.ts's identity headers are read
//     (no async work) -> member bar + real filter rail + sort control.
//   - <ProductResults/> (a cached fetch, see lib/products.ts) streams into the
//     grid behind its own Suspense boundary.

import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { Catalog } from "@/components/catalog/catalog";
import { CatalogShellSkeleton } from "@/components/catalog/catalog-shell-skeleton";

export default function Page() {
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Suspense fallback={<CatalogShellSkeleton />}>
          <Catalog />
        </Suspense>
      </main>
    </div>
  );
}
