"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-store";
import { formatPrice } from "@/lib/catalog";

export function CartSheet() {
  const { lines, subtotal, count, setQty, remove, open, setOpen } = useCart();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Your basket{count > 0 ? ` (${count})` : ""}</SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            Your basket is empty.
          </div>
        ) : (
          <ul className="flex-1 divide-y overflow-y-auto">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex gap-3 p-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-white">
                  <Image
                    src={product.imageUrl}
                    alt={product.imageAlt}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="line-clamp-2 text-xs font-medium">
                    {product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(product.price)}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label="Decrease quantity"
                        onClick={() => setQty(product.id, qty - 1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center text-xs tabular-nums">
                        {qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label="Increase quantity"
                        onClick={() => setQty(product.id, qty + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums">
                        {formatPrice(product.price * qty)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${product.name}`}
                        onClick={() => remove(product.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SheetFooter className="border-t">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <Button
            className="w-full"
            disabled={lines.length === 0}
            onClick={() =>
              toast.info("Placing orders is a feature under development")
            }
          >
            Place order
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
