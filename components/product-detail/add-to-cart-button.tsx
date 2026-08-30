"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-store";
import type { Product } from "@/lib/catalog";

/** Quantity stepper + add. Mirrors the toast the product card fires. */
export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Decrease quantity"
          disabled={qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          <Minus />
        </Button>
        <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Increase quantity"
          onClick={() => setQty((q) => q + 1)}
        >
          <Plus />
        </Button>
      </div>
      <Button
        className="flex-1"
        onClick={() => {
          add(product, qty);
          toast.success("Added to basket", {
            description: qty > 1 ? `${product.name} (×${qty})` : product.name,
          });
        }}
      >
        Add to cart
      </Button>
    </div>
  );
}
