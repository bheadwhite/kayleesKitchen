import type { ScalingSpec } from "@/scaling"
import type { ProposedItem } from "@/shoppingList"
import type { ChefFork, Ingredient, RecipeDraft } from "@/types"

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

/** One planned meal, as the shopping list is built from it. */
export interface ShoppingMeal {
  /** The recipe's title — what the list credits a line to. */
  title: string
  ingredients: Ingredient[]
}

/** A line already on the list, as the chef is shown it. */
export interface ShoppingKnown {
  id: string
  name: string
  amount: string
  section: string
  /**
   * Which recipes this line already covers.
   *
   * **Without this the chef cannot tell its own work from anybody else's**, and
   * the instruction it was given — fold your line into that one and give the
   * combined amount — turned a second press of Build into four pounds of beef.
   * A line that already credits a recipe in this request is a line this build
   * is restating, not adding to.
   */
  from: string[]
}

/**
 * Request body for the `buildShoppingList` callable.
 *
 * `existing` carries **only the unticked rows**, and that is what makes the
 * "never merge into something already bought" rule hold: the chef cannot merge
 * into a row it was never shown. `mergePlan` re-checks it anyway — the guarantee
 * is not the model's to keep — but this is where it is actually made true.
 *
 * `meals` arrive **already scaled** to however many are eating, so this call is
 * merging and nothing else. `known` is the pantry: ingredient name → aisle, for
 * every name anyone has ever shopped for, so the chef is only asked about names
 * nobody has seen before.
 */
export interface ShoppingRequest {
  meals: ShoppingMeal[]
  existing: ShoppingKnown[]
  known: Record<string, string>
}

/** Request body for the `analyseRecipeScaling` callable. */
export interface ScalingRequest {
  recipeId: string
  recipe: RecipeDraft
  /**
   * The ingredients stamp this is being worked out for. Sent rather than
   * recomputed server-side so the document the callable writes is keyed by
   * exactly what the client will look for — the two implementations are
   * mirrored by hand, and a drift would otherwise mean every lookup misses.
   */
  fingerprint: string
}

/**
 * Response from the callable: how this recipe's ingredient lines respond to
 * cooking for more people. Asked **once per version of the ingredient list**,
 * then applied locally for any number — see `src/scaling.ts`.
 */
export interface ScalingResponse {
  spec: ScalingSpec
}

/** Response from the callable: the list as it should now read. */
export interface ShoppingResponse {
  items: ProposedItem[]
  /** A sentence for the cook — what was folded together, what looked odd. */
  note: string
}
