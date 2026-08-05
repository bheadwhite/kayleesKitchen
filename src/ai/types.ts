import type { RecipeDraft } from "@/types"

/** Formats Claude accepts as image input. */
export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp"

export interface AssistantImage {
  mediaType: ImageMediaType
  /** Base64 payload only — the `data:` prefix is stripped before sending. */
  data: string
}

/**
 * One turn of the conversation. Images stay attached to the turn that carried
 * them so a later "look at the second photo again" still has something to look
 * at — the alternative, sending photos only on the newest turn, makes the
 * assistant blind to them one message later.
 */
export type AssistantTurn =
  | { role: "user"; text: string; images: AssistantImage[] }
  | { role: "assistant"; text: string }

/** Request body for the `recipeAssistant` callable. */
export interface AssistantRequest {
  turns: AssistantTurn[]
  /** What the editor currently holds, so the assistant edits rather than invents. */
  currentDraft: RecipeDraft
}

/** Response from the callable. `draft` is null when the turn was conversational. */
export interface AssistantResponse {
  text: string
  draft: RecipeDraft | null
}
