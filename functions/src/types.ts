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

export interface GenerateImageRequest {
  draft: RecipeDraft
}

export interface GenerateImageResponse {
  mimeType: string
  /** Base64 payload, no `data:` prefix. */
  data: string
}
