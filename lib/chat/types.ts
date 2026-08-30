// End-to-end types for the catalog chatbot. Shared by the route handler and the
// client components so tool-result parts (`tool-searchProducts`, etc.) are typed
// in the UI.

import type { InferUITools, UIMessage } from "ai";

import type { buildChatTools } from "@/lib/chat/tools";

export type ChatTools = InferUITools<ReturnType<typeof buildChatTools>>;

/** The message shape `useChat` works with for this bot. No metadata, no data parts. */
export type ChatUIMessage = UIMessage<never, never, ChatTools>;
