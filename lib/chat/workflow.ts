// ---------------------------------------------------------------------------
// Catalog chatbot workflow
// ---------------------------------------------------------------------------
// The "use workflow" entrypoint, kept in its own file (no other exports) per
// the Workflow SDK's own guidance — mixing workflow/step functions into a
// file with unrelated exports is a known source of bundler bugs. See
// lib/chat/agent.ts for the (plain, non-durable) system-prompt builder this
// workflow's caller uses, and lib/chat/tools.ts for the step functions.
//
// Durability: `chatCatalogWorkflow` runs in a sandboxed VM with no Node.js/
// fetch access, so it can only orchestrate (create the agent, call
// `agent.stream()`). All actual I/O (the tool calls in lib/chat/tools.ts)
// happens in "use step" functions, which run with full Node.js access and
// are retried automatically on transient failure.
//
// Known gaps vs the previous `streamText`-based version (DurableAgent is
// still experimental — see node_modules/@workflow/ai/docs):
//   - `abortSignal` isn't wired up yet, so a client navigating away no longer
//     aborts the model call server-side. `timeout` bounds it instead.
//   - `onError` on `agent.stream()` is log-only; it can't inject a friendly
//     error string into the stream the way `toUIMessageStream`'s `onError`
//     did. A mid-stream failure now surfaces however DurableAgent's own
//     error chunk renders, rather than our fixed "Sorry — something went
//     wrong" text.
// ---------------------------------------------------------------------------

import "server-only";

import { stepCountIs, type ModelMessage, type UIMessageChunk } from "ai";
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";

import { CHAT_FALLBACK_MODEL, CHAT_MODEL } from "@/lib/chat/agent";
import { chatTools, type ChatToolContext } from "@/lib/chat/tools";
import type { Product } from "@/lib/catalog";

export interface StreamCatalogAgentOptions {
  system: string;
  modelMessages: ModelMessage[];
  /** Verified member id — used for gateway per-user rate limiting / tracking. */
  sub: string;
  /** The member's cohort-scoped catalog, prefetched once per turn by the route. */
  catalog: Product[];
}

/**
 * The catalog chatbot, as a durable workflow. `"use workflow"` means this
 * function itself has no Node.js/fetch access — it only orchestrates: build
 * the agent, hand it the tool set, stream. All the actual work (Azure calls)
 * happens in the "use step" functions inside lib/chat/tools.ts.
 *
 * Called via `start(chatCatalogWorkflow, [opts])` from app/api/chat/route.ts,
 * which then streams the run's default output (`run.readable`) back to the
 * client — the same UI-message-chunk protocol `streamText` produced before.
 */
export async function chatCatalogWorkflow(
  opts: StreamCatalogAgentOptions,
): Promise<void> {
  "use workflow";
  const { system, modelMessages, sub, catalog } = opts;

  const agent = new DurableAgent({
    // Plain "provider/model" string -> routed through the AI Gateway, no
    // provider SDK import.
    model: CHAT_MODEL,
    instructions: system,
    // Cohort-bound: every SKU the tools return is checked against `catalog`
    // (see ChatToolContext), never fetched fresh per tool call.
    tools: chatTools,
    providerOptions: {
      gateway: {
        user: sub, // per-member rate limiting + cost attribution
        tags: [
          "feature:catalog-chat",
          `env:${process.env.VERCEL_ENV ?? "development"}`,
        ],
        models: [CHAT_FALLBACK_MODEL], // failover if the primary is unavailable
      },
    },
  });

  const context: ChatToolContext = { catalog };

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<UIMessageChunk>(),
    // Cap the tool-calling loop (findProducts -> showProducts is 2 steps;
    // a question that also shows a card is 2; 6 leaves headroom without looping).
    stopWhen: stepCountIs(6),
    experimental_context: context,
    // DurableAgent doesn't support abortSignal yet (see module comment) —
    // bound the call so a stuck request can't run past the route's
    // maxDuration budget.
    timeout: 55_000,
    onError: ({ error }) => {
      console.error("chat workflow stream error", error);
    },
  });
}
