import type { ChefFork, RecipeDraft } from "@/types"

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

/**
 * One turn with the chef. Text only, unlike {@link AssistantTurn} — the chef is
 * looking at a recipe that rides along in the request, so there is nothing to
 * photograph.
 */
export interface ChefTurn {
  role: "user" | "assistant"
  text: string
}

/** Request body for the `askChef` callable. */
export interface ChefRequest {
  turns: ChefTurn[]
  /** The recipe as filed. Read, never changed. */
  recipe: RecipeDraft
  /** The working copy on screen, or null while reading the original. */
  fork: ChefFork | null
  /**
   * Which recipe this is, so the callable can look up and record the yield it
   * settled on. Null for a recipe with no id — nothing to key a cache by, and
   * the chef simply works it out fresh.
   */
  recipeId?: string | null
}

/**
 * Response from the callable. `fork` is null when the chef only answered —
 * "how long does this keep" leaves the recipe alone.
 */
export interface ChefResponse {
  text: string
  fork: ChefFork | null
  /** What the chef reckons the filed recipe makes. Null when it did not say. */
  baseServes: number | null
}
