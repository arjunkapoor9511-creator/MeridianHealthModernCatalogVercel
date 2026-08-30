"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat/chat-message";
import type { ChatUIMessage } from "@/lib/chat/types";

const SUGGESTIONS = [
  "How far can the Aspire Elio go on one charge?",
  "I'm 80kg and my front door is 0.6m wide — give me a foldable scooter under $3k with at least 20km range",
  "What medications are covered under my insurance plan?",
];

export function ChatPanel() {
  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
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
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}

          {status === "submitted" && (
            <p className="text-xs text-muted-foreground">Thinking…</p>
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
