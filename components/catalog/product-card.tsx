"use client";

import Image from "next/image";
import { Weight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-store";
import { categoryLabel, formatPrice, type Product } from "@/lib/catalog";
import { toast } from "sonner";

/** Matches the grid's column widths so next/image requests the right size. */
export const CARD_IMAGE_SIZES =
  "(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw";

export function ProductCard({
  product,
  priority = false,
  onOpen,
}: {
  product: Product;
  priority?: boolean;
  /** Open the product detail popup. */
  onOpen: () => void;
}) {
  const { add } = useCart();

  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  // The image and the title open the detail popup. They are separate buttons
  // (not one wrapping the whole card) so the "Add to cart" button below is not
  // nested inside another button.
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`View details for ${product.name}`}
        className="relative aspect-square cursor-pointer bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          fill
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-contain p-4 transition-transform group-hover:scale-[1.02]"
        />
        {onSale && (
          <Badge className="absolute top-2 left-2" variant="destructive">
            Sale
          </Badge>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>
        <h3 className="min-h-[2.5rem] text-sm leading-snug font-medium">
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="line-clamp-2 cursor-pointer text-left outline-none hover:underline focus-visible:underline"
          >
            {product.name}
          </button>
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">
            {formatPrice(product.price)}
          </span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice!)}
            </span>
          )}
        </div>

        <dl className="mt-1 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/70">Category</span>
            <dd className="font-medium text-foreground/80">
              {categoryLabel(product.category)}
            </dd>
          </div>
          {product.safeWorkingLoadKg != null && (
            <div className="flex items-center gap-1.5">
              <Weight className="size-3.5 shrink-0" aria-hidden />
              <dd>
                Safe working load{" "}
                <span className="font-medium text-foreground/80">
                  {product.safeWorkingLoadKg} kg
                </span>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-3">
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              add(product);
              toast.success(`Added to basket`, { description: product.name });
            }}
          >
            Add to cart
          </Button>
        </div>
      </div>
    </article>
  );
}
