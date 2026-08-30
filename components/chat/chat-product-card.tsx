"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-store";
import { ProductDetailDialog } from "@/components/product-detail/product-detail-dialog";
import { categoryLabel, formatPrice, type Product } from "@/lib/catalog";

/** Compact product card rendered inside a chat message. */
export function ChatProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [open, setOpen] = useState(false);

  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`View details for ${product.name}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          fill
          sizes="80px"
          className="object-contain p-1.5"
        />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="line-clamp-2 text-left text-sm leading-snug font-medium outline-none hover:underline focus-visible:underline"
        >
          {product.name}
        </button>

        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {formatPrice(product.price)}
          </span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compareAtPrice!)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {categoryLabel(product.category)}
          </span>
        </div>

        <div className="mt-1 flex gap-2">
          <Button
            size="xs"
            onClick={() => {
              add(product);
              toast.success("Added to basket", { description: product.name });
            }}
          >
            Add to basket
          </Button>
          <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
            View details
          </Button>
        </div>
      </div>

      <ProductDetailDialog
        product={open ? product : null}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
