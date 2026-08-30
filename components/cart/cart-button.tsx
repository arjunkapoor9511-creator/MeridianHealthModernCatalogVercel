"use client";

import { ShoppingBasket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-store";
import { CartSheet } from "@/components/cart/cart-sheet";

export function CartButton() {
  const { count, setOpen } = useCart();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label={`Open basket, ${count} item${count === 1 ? "" : "s"}`}
      >
        <ShoppingBasket />
        <span className="hidden sm:inline">Basket</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      <CartSheet />
    </>
  );
}
