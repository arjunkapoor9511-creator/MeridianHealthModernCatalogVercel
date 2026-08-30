import { Suspense } from "react";
import { headers } from "next/headers";
import { ShieldCheck } from "lucide-react";

import { CatalogProvider } from "@/components/catalog/catalog-store";
import { ChatWidget } from "@/components/chat/chat-widget";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { SortControl } from "@/components/catalog/sort-control";
import { ProductResults } from "@/components/catalog/product-results";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";
import { CATALOG_FACETS } from "@/lib/catalog-facets.generated";
import { INSURANCE_LABELS, type Insurance } from "@/lib/catalog";

function MemberBar({
  name,
  insurance,
}: {
  name: string;
  insurance: Insurance;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b pb-4">
      <div>
        <p className="text-xl font-semibold tracking-tight">Product catalog</p>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{name}</span>
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        Covered by{" "}
        <span className="font-medium text-foreground">
          {INSURANCE_LABELS[insurance]}
        </span>
      </p>
    </div>
  );
}

function NoSession() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <p>No session. Open the catalog from the Meridian Health storefront.</p>
      {process.env.MARKETPLACE_ENTRY_URL ? (
        <p className="mt-2">
          <a className="underline" href={process.env.MARKETPLACE_ENTRY_URL}>
            Go to the storefront
          </a>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Reads the verified identity headers injected by proxy.ts. This is a
 * request-time read with no async work, so it streams into the shell instantly
 * - the filter rail, sort control and member bar appear immediately while only
 * the product grid (a cached fetch) streams behind its own Suspense boundary.
 */
export async function Catalog() {
  const h = await headers();
  const insurance = h.get("x-user-insurance");
  const name = h.get("x-user-name")?.trim() || "Member";

  if (insurance !== "unitedhealthcare" && insurance !== "humana") {
    return <NoSession />;
  }

  const facets = CATALOG_FACETS[insurance];

  return (
    <CatalogProvider>
      <MemberBar name={name} insurance={insurance} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <FilterPanel facets={facets} />

        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <SortControl />
          </div>
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductResults insurance={insurance} />
          </Suspense>
        </div>
      </div>

      <ChatWidget />
    </CatalogProvider>
  );
}
