// ---------------------------------------------------------------------------
// Scope gate for the catalog chatbot
// ---------------------------------------------------------------------------
// The bot does exactly two things: answer questions about a specific product,
// and recommend products for a stated need. Everything else is deflected with a
// fixed line.
//
// Two layers enforce this:
//   1. classifyScope() below — a cheap, fast first pass (haiku) on the latest
//      user message. Out of scope => the route streams OUT_OF_SCOPE_MESSAGE and
//      never invokes the main agent.
//   2. The system prompt in lib/chat/agent.ts repeats the rule so anything that
//      slips through the classifier still gets the fixed line.
// ---------------------------------------------------------------------------

import "server-only";

import { generateObject } from "ai";

// Overridable for the same reason as CHAT_MODEL (see lib/chat/agent.ts).
export const SCOPE_MODEL =
  process.env.CHAT_SCOPE_MODEL ?? "anthropic/claude-haiku-4.5";

const SUPPORT_FALLBACK = "1-800-MERIDIAN";

/** The exact line the bot must return for anything out of scope. */
export function outOfScopeMessage(): string {
  const contact = process.env.CHAT_SUPPORT_CONTACT?.trim() || SUPPORT_FALLBACK;
  return `This query is currently out of scope, please contact support on ${contact}`;
}

export const SCOPE_VALUES = [
  "product_question",
  "recommendation",
  "out_of_scope",
] as const;
export type ScopeLabel = (typeof SCOPE_VALUES)[number];

const CLASSIFIER_PROMPT = `You are a strict scope classifier for a health-insurance product catalog assistant.
The assistant ONLY:
- "product_question": answers a question about a specific catalog product (specs, dimensions, warranty, features, price, availability).
- "recommendation": suggests catalog products that fit a stated need or situation.
Everything else is "out_of_scope": greetings-only, small talk, medical or clinical advice, orders / delivery / returns / billing / account issues, coverage or eligibility questions, anything not about choosing or understanding a mobility/care product.
Classify the LAST user message, using earlier turns only for context. Respond with one label.`;

/**
 * Classify the latest user turn. Fails open to "recommendation" (the safer
 * in-scope bucket) if the classifier itself errors — the system prompt is the
 * backstop.
 */
export async function classifyScope(
  messages: { role: string; text: string }[],
): Promise<ScopeLabel> {
  const transcript = messages
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: SCOPE_MODEL,
      output: "enum",
      enum: [...SCOPE_VALUES],
      system: CLASSIFIER_PROMPT,
      prompt: transcript,
      providerOptions: { gateway: { tags: ["feature:catalog-chat"] } },
    });
    return object as ScopeLabel;
  } catch (err) {
    console.error("classifyScope failed, failing open", err);
    return "recommendation";
  }
}
