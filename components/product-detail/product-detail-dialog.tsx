"use client";

// The product detail popup. Opened from a card in the grid.
//
// PPR-in-spirit: the shell + everything we already know (brand, name, price,
// hero image, add-to-cart) paint the instant the dialog opens, straight from
// the `Product` the grid already holds. The "blanks" — carousel, description,
// features, specs, warranty, documents — show dimension-matched skeletons and
// stream in when `/api/product-detail/<sku>` resolves (cached, see
// lib/products.ts). See DECISIONS.md 2026-08-30.

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AddToCartButton } from "@/components/product-detail/add-to-cart-button";
import {
  COLLAPSED_DETAIL_HEIGHT,
  Expandable,
} from "@/components/product-detail/expandable";
import { ProductDetailSkeleton } from "@/components/product-detail/product-detail-skeleton";
import { ProductFeatures } from "@/components/product-detail/product-features";
import { ProductFiles } from "@/components/product-detail/product-files";
import { ProductGallery } from "@/components/product-detail/product-gallery";
import { ProductSpecs } from "@/components/product-detail/product-specs";
import { useProductDetail } from "@/components/product-detail/use-product-detail";
import {
  categoryLabel,
  formatPrice,
  type Product,
  type ProductImage,
} from "@/lib/catalog";

export function ProductDetailDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  // Keep rendering the last product through the close animation. Adjusting
  // state during render when a prop changes is the React-sanctioned pattern
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [shown, setShown] = useState<Product | null>(product);
  if (product && product !== shown) setShown(product);

  const state = useProductDetail(shown?.sku);
  const detail = state.detail;

  const onSale =
    shown?.compareAtPrice != null && shown.compareAtPrice > shown.price;

  const galleryImages: ProductImage[] =
    detail && detail.images.length > 0
      ? detail.images
      : shown
        ? [
            {
              url: shown.imageUrl,
              alt: shown.imageAlt,
              width: 1000,
              height: 1000,
            },
          ]
        : [];

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      {shown && (
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div className="md:self-start">
              <ProductGallery key={shown.sku} images={galleryImages} />
            </div>

            <div className="space-y-4">
              <DialogHeader className="space-y-1 pr-6 text-left">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {shown.brand}
                </p>
                <DialogTitle className="text-lg leading-snug">
                  {shown.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {shown.brand} — {categoryLabel(shown.category)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold">
                  {formatPrice(shown.price)}
                </span>
                {onSale && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(shown.compareAtPrice!)}
                  </span>
                )}
              </div>

              <AddToCartButton key={shown.sku} product={shown} />

              <Separator />

              {/* Fixed min-height so the loading skeleton, the collapsed
                  content, and the error note all occupy the same space — the
                  popup opens at one height for every product. */}
              <div className="min-h-80">
                {state.status === "loading" && (
                  <div
                    className="relative overflow-hidden"
                    style={{ maxHeight: COLLAPSED_DETAIL_HEIGHT }}
                  >
                    <ProductDetailSkeleton />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-popover to-transparent" />
                  </div>
                )}

                {state.status === "error" && (
                  <p className="text-sm text-muted-foreground">
                    Full details aren&apos;t available right now. Price and
                    availability above are current.
                  </p>
                )}

                {state.status === "ready" && detail && (
                  <Expandable key={shown.sku}>
                    <div className="space-y-5">
                      {detail.description && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {detail.description}
                        </p>
                      )}

                      <ProductFeatures features={detail.features} />
                      <ProductSpecs specs={detail.specs} />

                      {detail.warranty && (
                        <section>
                          <h3 className="mb-1 text-sm font-semibold">
                            Warranty
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {detail.warranty}
                          </p>
                        </section>
                      )}

                      <ProductFiles files={detail.files} />
                    </div>
                  </Expandable>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
