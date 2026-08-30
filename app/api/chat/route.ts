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

/** Emit a single plain-text assistant message and close the stream. */
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

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const turns = latestTurns(messages);
  if (turns.length === 0) {
    return Response.json({ error: "empty" }, { status: 400 });
  }

  const scope = await classifyScope(turns);
  if (scope === "out_of_scope") {
    return fixedMessageResponse(outOfScopeMessage());
  }

  try {
    const system = await buildSystemPrompt(claims.insurance);
    const result = streamCatalogAgent({
      system,
      modelMessages: await convertToModelMessages(messages),
      insurance: claims.insurance,
      sub: claims.sub,
      abortSignal: req.signal,
    });

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
