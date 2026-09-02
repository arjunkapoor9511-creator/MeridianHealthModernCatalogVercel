"use client";

// Renders one message bubble. A message is a list of ordered `parts`; this
// component switches on `part.type` to draw text and the tool UI. Tool parts
// arrive as `tool-<name>` (typed via ChatUIMessage) and move through states:
// input-streaming -> input-available -> output-available | output-error.
//
// Tool activity is deliberately NOT surfaced here: while the model is calling
// tools and before the reply streams, ChatPanel shows a single "Thinking…"
// bubble. This component only renders finished, user-facing content — assistant
// prose and the product cards from `tool-showProducts`.

import { cn } from "@/lib/utils";
import { ChatProductCard } from "@/components/chat/chat-product-card";
import type { ChatUIMessage } from "@/lib/chat/types";

export function ChatMessage({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";

  const rendered = message.parts
    .map((part, i) => {
      // Assistant prose streams in token-by-token as `part.text` grows.
      // Skip empty text parts (they exist briefly before the first delta).
      if (part.type === "text") {
        return part.text ? (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {part.text}
          </p>
        ) : null;
      }

      // The generative-UI tool: once the server has hydrated the SKUs against
      // the member's catalog, render an interactive card per product.
      if (
        part.type === "tool-showProducts" &&
        part.state === "output-available"
      ) {
        const { products } = part.output;
        if (products.length === 0) return null;
        return (
          <div key={i} className="space-y-2">
            {products.map((product) => (
              <ChatProductCard key={product.id} product={product} />
            ))}
          </div>
        );
      }

      // Retrieval tools (findProducts, getProductInfo) and pending showProducts
      // calls have no visible output — the "Thinking…" bubble covers the wait.
      return null;
    })
    .filter(Boolean);

  // Nothing to show yet (e.g. an assistant turn that has only fired tool calls
  // so far) — stay out of the way; ChatPanel is showing "Thinking…".
  if (rendered.length === 0) return null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "min-w-0 space-y-2 rounded-lg px-3 py-2 text-sm",
          isUser
            ? "max-w-[85%] bg-primary text-primary-foreground"
            : "max-w-[42rem] bg-muted text-foreground",
        )}
      >
        {rendered}
      </div>
    </div>
  );
}
