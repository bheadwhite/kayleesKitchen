/** Mirrors `src/ai/types.ts` on the client. Keep the two in sync by hand. */

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp"

export interface AssistantImage {
  mediaType: ImageMediaType
  data: string
}

export type AssistantTurn =
  | { role: "user"; text: string; images: AssistantImage[] }
  | { role: "assistant"; text: string }

export interface Ingredient {
  name: string
  amount: string
  optional?: boolean
  unique?: boolean
}

export interface DirectionSection {
  sectionTitle: string
  steps: string[]
}

export interface RecipeDraft {
  title: string
  ingredients: Ingredient[]
  directions: DirectionSection[]
}

export interface AssistantRequest {
  turns: AssistantTurn[]
  currentDraft: RecipeDraft
}

export interface AssistantResponse {
  text: string
  draft: RecipeDraft | null
}

/** One turn with the chef. Text only — the recipe is already in the request. */
export interface ChefTurn {
  role: "user" | "assistant"
  text: string
}

/**
 * A working copy of a recipe. Never written to Firestore — it exists for as
 * long as someone is cooking from it.
 */
export interface ChefFork extends RecipeDraft {
  serves: number
  baseServes: number
  summary: string
  label: string
  /**
   * What one serving is — "2 cookies", "about 1½ cups", "one 3×4-inch square".
   * Without it the count is unreadable for anything portioned: "serves 18"
   * says nothing about a batch of cookies until you know whether a serving is
   * one of them or three. Optional in the type because estimates stored before
   * the field existed do not carry one.
   */
  servingSize?: string
}

export interface ChefRequest {
  turns: ChefTurn[]
  /** The recipe as filed. The chef reads it and never changes it. */
  recipe: RecipeDraft
  /** The working copy on screen, or null if they are reading the original. */
  fork: ChefFork | null
  /**
   * Which recipe this is, so the callable can look up and record the yield it
   * settled on. Null for a recipe with no id — nothing to key a cache by, and
   * the chef simply works it out fresh.
   */
  recipeId?: string | null
}

export interface ChefResponse {
  text: string
  fork: ChefFork | null
  /** What the chef reckons the recipe as filed makes. Null when it did not say. */
  baseServes: number | null
}

export interface GenerateImageRequest {
  draft: RecipeDraft
}

export interface GenerateImageResponse {
  mimeType: string
  /** Base64 payload, no `data:` prefix. */
  data: string
}
