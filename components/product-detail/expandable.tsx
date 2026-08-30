"use client";

// Caps a variable-length block at a fixed height with a "Show more" toggle.
// Product detail copy (description + features + specs + warranty + documents)
// differs a lot between products; without this the popup opens at a different
// height every time and jumps on the skeleton -> content swap. Collapsed, every
// product's popup is the same height.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Collapsed height of the detail region (px). The loading skeleton is clipped
 *  to the same value so the swap moves nothing. */
export const COLLAPSED_DETAIL_HEIGHT = 256;

// Measure before paint so the collapsed height is right on the first frame.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Expandable({
  children,
  collapsedHeight = COLLAPSED_DETAIL_HEIGHT,
}: {
  children: ReactNode;
  collapsedHeight?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setFullHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overflows = fullHeight != null && fullHeight > collapsedHeight + 24;
  const collapsed = overflows && !expanded;

  return (
    <div>
      <div
        data-slot="expandable-viewport"
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: collapsed
            ? collapsedHeight
            : fullHeight != null
              ? fullHeight + 4
              : collapsedHeight,
        }}
      >
        <div ref={innerRef}>{children}</div>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-popover to-transparent" />
        )}
      </div>

      {overflows && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full text-muted-foreground"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            aria-hidden
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </Button>
      )}
    </div>
  );
}
