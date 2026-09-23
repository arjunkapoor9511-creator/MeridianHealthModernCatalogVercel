// ---------------------------------------------------------------------------
// Scope gate for the catalog chatbot
// ---------------------------------------------------------------------------
// The bot answers questions about specific catalog products, recommends
// products for a stated need, and handles purchase intent for products already
// discussed. Everything else is deflected with a fixed line.
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

/**
 * The line the bot returns for anything out of scope. Single source of truth —
 * the route streams it verbatim AND the system prompt embeds it, so the wording
 * is identical whichever layer catches the query.
 */
export function outOfScopeMessage(): string {
  const contact = process.env.CHAT_SUPPORT_CONTACT?.trim() || SUPPORT_FALLBACK;
  return `I currently can't address this query, but you may be able to get support through ${contact}.`;
}

export const SCOPE_VALUES = [
  "product_question",
  "recommendation",
  "out_of_scope",
] as const;
export type ScopeLabel = (typeof SCOPE_VALUES)[number];

const CLASSIFIER_PROMPT = `You are a scope classifier for a health-insurance mobility/care product catalog assistant.
Labels:
- "product_question": a question about a specific catalog product (specs, dimensions, warranty, features, price, whether it's covered).
- "recommendation": asking for a product suggestion for a stated need OR a follow-up in an ongoing product conversation — including short affirmations and purchase intent about products already discussed ("fantastic", "I'll take it", "I want to buy it", "add it", "why?", "which one"). When earlier turns are about catalog products, lean towards "recommendation" for brief replies.
- "out_of_scope": greetings with no request, small talk, medical or clinical advice, delivery / returns / billing / account issues, questions about insurance coverage or eligibility for things OTHER than these products (e.g. medications, doctor visits), anything not about choosing, understanding, or acquiring a product from this catalog.
Classify the LAST user message, using earlier turns for context. Respond with one label.`;

/**
 * Classify the latest user turn. Fails open to "recommendation" (the safer
 * in-scope bucket) if the classifier itself errors — the system prompt is the
 * backstop.
 */
export async function classifyScope(
  messages: { role: string; text: string }[],
): Promise<ScopeLabel> {
  // Last 6 turns only — enough context to judge a terse follow-up ("that one",
  // "why?") without paying for the whole history on every turn.
  const transcript = messages
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  try {
    // `output: "enum"` constrains the model to exactly one SCOPE_VALUES string —
    // no JSON parsing, no free text to sanitise.
    const { object } = await generateObject({
      model: SCOPE_MODEL,
      output: "enum",
      enum: [...SCOPE_VALUES],
      system: CLASSIFIER_PROMPT,
      prompt: transcript,
      // Same cost tag as the main agent so both legs of a turn roll up together.
      providerOptions: { gateway: { tags: ["feature:catalog-chat"] } },
    });
    return object as ScopeLabel;
  } catch (err) {
    // Never block a turn on the classifier. "recommendation" is the safe
    // in-scope bucket; the system prompt still deflects anything truly off-topic.
    console.error("classifyScope failed, failing open", err);
    return "recommendation";
  }
}
