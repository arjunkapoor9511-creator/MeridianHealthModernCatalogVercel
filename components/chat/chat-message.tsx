"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ChatProductCard } from "@/components/chat/chat-product-card";
import { ReasoningDisclosure } from "@/components/chat/reasoning-disclosure";
import type { ChatUIMessage } from "@/lib/chat/types";

function Thinking({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

export function ChatMessage({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-lg px-3 py-2 text-sm",
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

          if (part.type === "reasoning") {
            return (
              <ReasoningDisclosure
                key={i}
                text={part.text}
                streaming={part.state !== "done"}
              />
            );
          }

          if (part.type === "tool-searchProducts") {
            if (part.state === "output-available") {
              const { products, error } = part.output;
              if (error) {
                return (
                  <p key={i} className="text-xs text-muted-foreground">
                    {error}
                  </p>
                );
              }
              if (products.length === 0) return null;
              return (
                <div key={i} className="space-y-2">
                  {products.map((product) => (
                    <ChatProductCard key={product.id} product={product} />
                  ))}
                </div>
              );
            }
            if (part.state === "output-error") {
              return (
                <p key={i} className="text-xs text-muted-foreground">
                  Couldn&apos;t search the catalog just now.
                </p>
              );
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
