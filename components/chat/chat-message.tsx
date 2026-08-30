"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChatProductCard } from "@/components/chat/chat-product-card";
import type { ChatUIMessage } from "@/lib/chat/types";

function Thinking({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

export function ChatMessage({
  message,
  wide = false,
}: {
  message: ChatUIMessage;
  wide?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "space-y-2 rounded-lg px-3 py-2 text-sm",
          isUser ? "max-w-[85%]" : wide ? "w-full max-w-2xl" : "max-w-[85%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return part.text ? (
              <p key={i} className="whitespace-pre-wrap leading-relaxed">
                {part.text}
              </p>
            ) : null;
          }

          if (part.type === "tool-showProducts") {
            if (part.state === "output-available") {
              const { products } = part.output;
              if (products.length === 0) return null;
              return (
                <div
                  key={i}
                  className={cn(
                    "gap-2",
                    wide && products.length > 1
                      ? "grid sm:grid-cols-2"
                      : "space-y-2",
                  )}
                >
                  {products.map((product) => (
                    <ChatProductCard key={product.id} product={product} />
                  ))}
                </div>
              );
            }
            return null;
          }

          if (part.type === "tool-findProducts") {
            if (part.state === "output-available" || part.state === "output-error") {
              return null;
            }
            return <Thinking key={i} label="Searching the catalog…" />;
          }

          if (part.type === "tool-getProductInfo") {
            if (part.state === "output-available" || part.state === "output-error") {
              return null;
            }
            return <Thinking key={i} label="Checking product details…" />;
          }

          return null;
        })}
      </div>
    </div>
  );
}
