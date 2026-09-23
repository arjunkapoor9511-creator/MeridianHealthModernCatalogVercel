// End-to-end types for the catalog chatbot. Shared by the route handler and the
// client components so tool-result parts (`tool-showProducts`, etc.) are typed
// in the UI.

import type { InferUITools, UIMessage } from "ai";

import type { buildChatTools } from "@/lib/chat/tools";

// Derived from the tool set itself, so the input/output types of each
// `tool-<name>` part stay in sync with lib/chat/tools.ts automatically — change
// a tool's schema and the UI stops compiling until it is updated to match.
export type ChatTools = InferUITools<ReturnType<typeof buildChatTools>>;

/**
 * The message shape `useChat` works with for this bot. The two `never`s are
 * metadata and data parts — this bot uses neither, only text + tool parts.
 */
export type ChatUIMessage = UIMessage<never, never, ChatTools>;
