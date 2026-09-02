// ---------------------------------------------------------------------------
// POST /api/chat — the catalog chatbot
// ---------------------------------------------------------------------------
// Flow:
//   1. Verify the mm_session cookie (this route is outside proxy.ts, same as
//      /api/product-detail).
//   2. Classify the latest user turn (cheap model). Out of scope -> stream the
//      fixed deflection line, no agent call.
//   3. Otherwise run the tool-calling agent (Sonnet via AI Gateway) with the
//      member's cohort-bound tools and stream the UI message response.
//
// POST route handlers are never cached (Cache Components or not).
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { buildSystemPrompt, streamCatalogAgent } from "@/lib/chat/agent";
import { classifyScope, outOfScopeMessage } from "@/lib/chat/scope";
import type { ChatUIMessage } from "@/lib/chat/types";

export const maxDuration = 60;

/**
 * Emit a single plain-text assistant message and close the stream. Used for the
 * out-of-scope deflection and the hard-failure fallback — no model call. The
 * client can't tell it apart from a streamed reply: same UI-message SSE shape,
 * just one hand-written text part.
 */
function fixedMessageResponse(text: string): Response {
  const stream = createUIMessageStream<ChatUIMessage>({
    execute: ({ writer }) => {
      const id = "msg-fixed";
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * Flatten the UI messages to `{ role, text }` for the scope classifier — drop
 * tool parts and any turn with no text. The full messages array (tool parts and
 * all) still goes to the agent unchanged.
 */
function latestTurns(messages: ChatUIMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      text: m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim(),
    }))
    .filter((m) => m.text.length > 0);
}

export async function POST(req: Request): Promise<Response> {
  let body: { messages?: ChatUIMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = body.messages ?? [];

  // Auth: this route is outside proxy.ts, so verify the session cookie here.
  // `claims.insurance` (the member's cohort) scopes every tool; `claims.sub`
  // (member id) tags the gateway call for per-user rate limiting.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const turns = latestTurns(messages);
  if (turns.length === 0) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  // Layer 1 of the scope gate: a cheap haiku classifier on the recent turns.
  // Out of scope -> stream the fixed line and never touch the main agent.
  // (Layer 2 is the system prompt, which repeats the rule for anything that
  // slips through here.)
  const scope = await classifyScope(turns);
  if (scope === "out_of_scope") {
    return fixedMessageResponse(outOfScopeMessage());
  }

  try {
    // System prompt inlines the member's covered catalog (name/brand/price/SKU)
    // so the model can resolve names to SKUs and answer basic questions without
    // a tool call.
    const system = await buildSystemPrompt(claims.insurance);
    // `convertToModelMessages` turns the UI messages — including prior
    // tool-showProducts parts — back into model messages, so follow-ups like
    // "I'll take the second one" still have the earlier cards in context.
    const result = streamCatalogAgent({
      system,
      modelMessages: await convertToModelMessages(messages),
      insurance: claims.insurance,
      sub: claims.sub,
      abortSignal: req.signal,
    });

    // Adapt the streamText result to a UI-message SSE stream (text + tool
    // parts). The tool-calling loop runs server-side; each step streams to the
    // client as it happens.
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => {
          console.error("chat stream error", error);
          return "Sorry — something went wrong. Please try again.";
        },
      }),
    });
  } catch (error) {
    console.error("chat route error", error);
    return fixedMessageResponse(
      "Sorry — the assistant is unavailable right now. Please try again shortly.",
    );
  }
}
