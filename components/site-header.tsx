import { Activity } from "lucide-react";

import { CartButton } from "@/components/cart/cart-button";

/** Static page chrome - ships in the prerendered shell, no request data. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Meridian Health
          </span>
        </div>
        <CartButton />
      </div>
    </header>
  );
}
