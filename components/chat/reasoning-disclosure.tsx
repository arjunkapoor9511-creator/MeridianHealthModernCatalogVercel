"use client";

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Collapsed "thinking" disclosure, like Claude chat / Claude Code. While the
 * model is still reasoning it stays open; once done it collapses unless the user
 * has opened it.
 */
export function ReasoningDisclosure({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = streaming || open;

  if (!text.trim() && !streaming) return null;

  return (
    <div className="rounded-md bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
      >
        {streaming ? (
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
        ) : (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        )}
        {streaming ? "Thinking…" : "Thought process"}
      </button>

      {expanded && text.trim() && (
        <p className="whitespace-pre-wrap px-2 pb-2 leading-relaxed text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  );
}
