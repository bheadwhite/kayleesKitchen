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

/**
 * A recipe as the *editor* holds it — the body plus its tags. Deliberately not
 * folded into `RecipeDraft`, which `ChefFork` extends: a scaled working copy has
 * no business proposing tags.
 */
export interface EditorDraft extends RecipeDraft {
  tags: string[]
  /**
   * How many the recipe feeds and what one serving is, as the chef reads them
   * off the recipe — **null when it will not say**, which is the point of them
   * being nullable in a `strict` schema. A tool that forced a number would get
   * a guess, and a confident wrong yield is worse than an empty field: it is
   * the figure a shopping list scales from.
   */
  serves: number | null
  servingSize: string | null
}

export interface AssistantRequest {
  turns: AssistantTurn[]
  currentDraft: EditorDraft
  /** The household's tag vocabulary. Optional — an older client sends none. */
  tagLibrary?: string[]
  /** Every title already in the recipe box, so a new idea is genuinely new. */
  recipeTitles?: string[]
  /**
   * Categories the cook is asking inside, from the household's own tags. The
   * baseline anything suggested has to fit — not a filter on transcription.
   */
  categories?: string[]
  /**
   * Ideas offered in this conversation and turned down, by title. The drafts
   * themselves never enter the transcript — an assistant turn carries text
   * alone — so this is the only record of what has already been refused.
   */
  rejected?: string[]
}

export interface AssistantResponse {
  text: string
  draft: EditorDraft | null
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
  /**
   * What the recipe document itself claims it makes, when it claims anything.
   *
   * Ranked **above** the cached estimate: one is a person writing down what
   * their recipe makes, the other is a model reading it off the ingredients.
   * Without this the chip could read "Serves 6" from the recipe while the chef,
   * seeing only its own older estimate, insisted on four in the same breath.
   * Optional on the wire — an older client sends none.
   */
  authored?: { serves: number | null; servingSize: string | null }
}

export interface ChefResponse {
  text: string
  fork: ChefFork | null
  /** What the chef reckons the recipe as filed makes. Null when it did not say. */
  baseServes: number | null
}

/** One planned meal, as the shopping list is built from it. */
export interface ShoppingMeal {
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
 * `existing` carries **only the unticked rows**. A row the chef is never shown
 * is a row it cannot merge into, which is how "nothing already bought gets its
 * quantity changed" is actually made true; the client re-checks it as well.
 */
export interface ShoppingRequest {
  meals: ShoppingMeal[]
  existing: ShoppingKnown[]
  /**
   * The pantry: ingredient name → aisle, for every name anyone has shopped for.
   * Sent so the chef is only asked about names nobody has seen before — the
   * aisle an ingredient is in never changes, and re-buying it every build is
   * paying repeatedly for the same answer.
   */
  known: Record<string, string>
}

/** Mirrors `ScaleRule` / `Rounding` / `ScaledLine` in `src/scaling.ts`. */
export interface ScaledLine {
  name: string
  text: string
  rule: "linear" | "sublinear" | "fixed"
  qty?: number | null
  unit?: string | null
  rounding?: "exact" | "quarter" | "half" | "whole" | null
  prefer?: "up" | "down" | null
  exponent?: number | null
  optional?: boolean | null
  note?: string | null
}

export interface VesselRule {
  upTo: number
  text: string
}

/**
 * How a recipe's ingredient lines respond to cooking for more people —
 * `recipes/{id}/scaling/{ingredientsFingerprint}`. Mirrors `ScalingSpec` in
 * `src/scaling.ts`; the two packages share no build.
 */
export interface ScalingSpec {
  baseServes: number
  lines: ScaledLine[]
  vessels?: VesselRule[]
  notes?: string
  fingerprint: string
}

export interface ScalingRequest {
  recipeId: string
  recipe: RecipeDraft
  fingerprint: string
}

export interface ScalingResponse {
  spec: ScalingSpec
}

/** One line of the list as the chef proposes it. */
export interface ShoppingProposal {
  name: string
  amount: string
  section: string
  from: string[]
  /** An existing row this line now covers, when the two words differ. */
  mergesWith?: string | null
}

export interface ShoppingResponse {
  items: ShoppingProposal[]
  note: string
}

export interface GenerateImageRequest {
  draft: RecipeDraft
}

export interface GenerateImageResponse {
  mimeType: string
  /** Base64 payload, no `data:` prefix. */
  data: string
}
