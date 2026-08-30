"use client";

// Floating catalog-assistant widget. The launcher button is tiny; the panel
// (which pulls in the AI SDK client runtime) is a dynamic, client-only chunk
// loaded on first open, so it never touches the catalog's initial render / LCP.

import { useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, MessageCircle, Minimize2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ChatPanel = dynamic(
  () => import("@/components/chat/chat-panel").then((m) => m.ChatPanel),
  { ssr: false },
);

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl",
            expanded
              ? "h-[calc(100dvh-6rem)] w-[min(72rem,calc(100vw-2rem))]"
              : "h-[32rem] max-h-[calc(100dvh-6rem)] w-[min(24rem,calc(100vw-2rem))]",
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Catalog assistant</p>
              <p className="text-xs text-muted-foreground">
                Product questions &amp; recommendations
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Shrink assistant" : "Expand assistant"}
              >
                {expanded ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel wide={expanded} />
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open catalog assistant"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MessageCircle className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
