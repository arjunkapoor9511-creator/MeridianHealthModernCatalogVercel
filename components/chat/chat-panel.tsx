"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat/chat-message";
import type { ChatUIMessage } from "@/lib/chat/types";

const SUGGESTIONS = [
  "How far can the Aspire Elio go on one charge?",
  "I'm 80kg and my front door is 0.6m wide — give me a foldable scooter under $3k with at least 20km range",
  "What medications are covered under my insurance plan?",
];

export function ChatPanel() {
  // `useChat` owns the message list + streaming status. Every send POSTs the
  // whole `messages` array (text parts AND prior tool parts) to /api/chat via
  // DefaultChatTransport; the SSE response is parsed back into typed message
  // parts. `ChatUIMessage` carries the tool types so `tool-showProducts` etc.
  // are type-safe where we render them (see chat-message.tsx).
  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // "submitted" = request sent, no tokens yet; "streaming" = tokens arriving.
  // Either one blocks a second send and disables the composer.
  const busy = status === "submitted" || status === "streaming";

  // While the request is in flight AND the assistant reply has no visible
  // content yet (still calling tools, or thinking before the first token), show
  // ONE "Thinking…" bubble instead of per-tool spinners. It clears the moment
  // real content — prose or product cards — starts rendering.
  const last = messages[messages.length - 1];
  const assistantHasContent =
    last?.role === "assistant" &&
    last.parts.some(
      (p) =>
        (p.type === "text" && p.text.trim().length > 0) ||
        (p.type === "tool-showProducts" &&
          p.state === "output-available" &&
          p.output.products.length > 0),
    );
  const showThinking = busy && !assistantHasContent;

  // Keep the transcript pinned to the bottom as messages / tokens arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Single entry point for both the composer form and the suggestion buttons.
  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    // Appends a user message locally and fires the POST; the assistant reply
    // streams in as a new message that grows part-by-part.
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4"
        aria-live="polite"
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.length === 0 ? (
            // Empty state: the canned prompts double as one-tap sends. The
            // third one is deliberately out of scope — it exercises the
            // classifier's fixed deflection line.
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask about a product in your plan, or tell me what you need and
                I&apos;ll suggest options.
              </p>
              <div className="flex flex-col items-start gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-lg border px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Each message renders its own parts (text + tool UI). Generative
            // UI (product cards) comes out of the `tool-showProducts` parts.
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}

          {/* Single placeholder for the whole pre-response phase (thinking +
              tool calls). ChatMessage renders nothing until real content lands. */}
          {showThinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      </div>

      <form
        className="mx-auto flex w-full max-w-3xl items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a product…"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Message"
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={busy || input.trim().length === 0}
          aria-label="Send"
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
