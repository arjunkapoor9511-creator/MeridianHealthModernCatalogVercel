// ---------------------------------------------------------------------------
// POST /api/chat — the catalog chatbot
// ---------------------------------------------------------------------------
// Flow:
//   1. Verify the mm_session cookie (this route is outside proxy.ts, same as
//      /api/product-detail).
//   2. Classify the latest user turn (cheap model). Out of scope -> stream the
//      fixed deflection line, no agent call.
//   3. Otherwise start the tool-calling agent (Sonnet via AI Gateway) as a
//      Workflow SDK workflow, and stream its run back as the UI message
//      response — see lib/chat/agent.ts for why this runs as a workflow.
//
// POST route handlers are never cached (Cache Components or not).
// ---------------------------------------------------------------------------

import { cookies } from "next/headers";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { start } from "workflow/api";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { buildSystemPrompt } from "@/lib/chat/agent";
import { chatCatalogWorkflow } from "@/lib/chat/workflow";
import { classifyScope, outOfScopeMessage } from "@/lib/chat/scope";
import { getProducts } from "@/lib/products";
import type { ChatUIMessage } from "@/lib/chat/types";

// The tool-calling loop (search -> reason -> show) plus Sonnet's own latency can
// outrun the platform's default budget on a slow turn; 60s gives it room.
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
      // Hand-write the three SSE events the client expects for one text part:
      // open the part, push the whole string as a single delta, close it. A
      // stable id keeps it one part rather than three.
      const id = "msg-fixed";
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  // Same envelope `useChat` gets from a real streamed reply, so the client
  // renders it through the normal message path.
  return createUIMessageStreamResponse({ stream });
}

/**
 * Flatten the UI messages to `{ role, text }` for the scope classifier — drop
 * tool parts and any turn with no text. The full messages array (tool parts and
 * all) still goes to the agent unchanged.
 */
function latestTurns(messages: ChatUIMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant") // drop system/other
    .map((m) => ({
      role: m.role,
      // Concatenate just the text parts of the turn; tool-call / tool-result
      // parts carry no natural-language content the classifier can use.
      text: m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim(),
    }))
    .filter((m) => m.text.length > 0); // e.g. an assistant turn that was tool calls only
}

export async function POST(req: Request): Promise<Response> {
  // `useChat` POSTs `{ messages: ChatUIMessage[] }`. Guard the JSON parse so a
  // malformed body is a clean 400, not an unhandled throw.
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

  // Text-only view of the conversation for the classifier. Empty means the
  // client sent us nothing to act on (no text in any turn).
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
    // Fetched once per turn and handed to every tool call via
    // experimental_context (see lib/chat/tools.ts) — cheap since getProducts
    // is cached upstream, and it's also what the system prompt digest uses.
    const catalog = await getProducts(claims.insurance);
    // System prompt inlines the member's covered catalog (name/brand/price/SKU)
    // so the model can resolve names to SKUs and answer basic questions without
    // a tool call.
    const system = buildSystemPrompt(claims.insurance, catalog);
    // `convertToModelMessages` turns the UI messages — including prior
    // tool-showProducts parts — back into model messages, so follow-ups like
    // "I'll take the second one" still have the earlier cards in context.
    const modelMessages = await convertToModelMessages(messages);

    // Starts the workflow (see lib/chat/agent.ts) and returns immediately —
    // the tool-calling loop runs as a durable run, not inline in this request.
    const run = await start(chatCatalogWorkflow, [
      {
        system,
        modelMessages,
        sub: claims.sub, // per-member gateway rate limiting / cost attribution
        catalog, // scopes every tool to the member's cohort
      },
    ]);

    // The run's default stream is already UI-message-chunk shaped (DurableAgent
    // writes to it via getWritable<UIMessageChunk>()), so it goes straight to
    // the client — no toUIMessageStream adapter needed. The run id lets a
    // future client reconnect to an interrupted stream (see WorkflowChatTransport).
    return createUIMessageStreamResponse({
      stream: run.readable,
      headers: { "x-workflow-run-id": run.runId },
    });
  } catch (error) {
    // Threw before the first byte (prompt build, model handshake) — still safe
    // to send a normal Response.
    console.error("chat route error", error);
    return fixedMessageResponse(
      "Sorry — the assistant is unavailable right now. Please try again shortly.",
    );
  }
}
