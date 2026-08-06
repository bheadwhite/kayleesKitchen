export interface Ingredient {
  name: string
  amount: string
  optional?: boolean
  unique?: boolean
}

export interface DirectionSection {
  sectionTitle: string
  steps: string[]
  /** Index of the step currently being edited. Transient — stripped before write. */
  editStep?: number | null
}

export interface Recipe {
  id?: string
  title: string
  ingredients: Ingredient[]
  directions: DirectionSection[]
  /** Owner. Recipes are scoped by the author's email address. */
  email?: string
  contributor?: string | null
  image?: string | null
  /**
   * Free-form labels — "salad", "mexican". Stored lowercase so the same idea
   * cannot arrive twice in different cases; the uppercase they are shown in is
   * styling, not storage.
   */
  tags?: string[]
  /**
   * The rating totals, kept on the recipe itself rather than derived from the
   * `ratings` collection — that collection is *not* readable by anyone but the
   * author of each rating, which is what makes ratings anonymous. Sum and count
   * rather than an average, so a changed rating is arithmetic instead of a
   * re-read of every rating ever left.
   */
  ratingSum?: number
  ratingCount?: number
  /**
   * Set once, server-side, by `addRecipe`. Null both for recipes written before
   * the field existed and for the instant between a local write and the server
   * timestamp landing — so anything reading it has to treat null as "not new"
   * rather than "brand new".
   */
  createdAt?: Date | null
}

/**
 * The slice of a recipe the editor owns and the AI assistant proposes.
 * Deliberately excludes `id`, `email`, `contributor`, and `image` — those are
 * set by the editor's own save path, not by anything the assistant returns.
 */
export interface RecipeDraft {
  title: string
  ingredients: Ingredient[]
  directions: DirectionSection[]
}

/**
 * The chef's working copy of a recipe — scaled to a different number of people,
 * or with a substitution worked through.
 *
 * **Never written to Firestore.** It is something to cook from for as long as
 * you are cooking, not something filed: the recipe it came from is untouched,
 * and that is what makes it safe to ask for one on somebody else's recipe.
 */
export interface ChefFork extends RecipeDraft {
  /** How many this copy feeds. */
  serves: number
  /** How many the recipe as filed feeds — the number it was scaled from. */
  baseServes: number
  /** One line on what changed and what to watch, shown above the recipe. */
  summary: string
  /**
   * Two or three words naming this copy — "Feeds 8", "Dairy-free". Written by
   * the chef rather than derived from `serves`, because two copies can feed the
   * same number and differ entirely, and because it is what a saved version's
   * chip is labelled with.
   */
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

/**
 * A copy someone kept: `recipes/{recipeId}/variants/{id}`.
 *
 * The one thing here that *is* written down. A fork is otherwise scratch —
 * asked for, cooked from, gone — but "double it" is a question a household asks
 * of the same recipe every Thanksgiving, and paying for the model to work it
 * out again each time is paying twice for an answer that did not change.
 * Loading one is a Firestore read and no model call at all.
 */
export interface ChefVariant extends ChefFork {
  id: string
  /** Who kept it. Null on an account with no address. */
  email: string | null
  /** Null for the instant between the local write and the server timestamp. */
  savedAt: Date | null
}

/**
 * What the chef worked out about how much a recipe makes: one document at
 * `recipes/{recipeId}/chef/yield`.
 *
 * **Written only by the `askChef` Cloud Function** — `firestore.rules` denies
 * client writes outright, the same way it does for `aiUsage`. This is the
 * number the model produced, and the callable is the only place that knows it
 * came from the model rather than from whoever typed it.
 *
 * Valid only while `fingerprint` still matches the recipe (see
 * `src/recipeFingerprint.ts`). Nothing sweeps stale ones up: an estimate for a
 * recipe that has moved on is simply never read, and is overwritten the next
 * time anybody asks.
 */
export interface RecipeYield {
  baseServes: number
  /** How the chef read the number off the recipe, so a cook can disagree. */
  basis: string
  /** What one serving is — see the same field on {@link ChefFork}. */
  servingSize?: string
  fingerprint: string
}

/**
 * One entry in the tag registry (`tags/{name}`). The name is both the document
 * id and the value stored on recipes; `color` is an id from `src/tagColors.ts`,
 * never a hex.
 */
export interface TagRecord {
  name: string
  color: string
}

/** Firestore `users` document. */
export interface UserProfile {
  firstName: string
  lastName: string
  email: string
}

/**
 * The signed-in user, flattened to just what the views need: the Firebase auth
 * identity plus the display name assembled from the `users` profile document.
 */
export interface SessionUser {
  uid: string
  email: string
  displayName: string | null
  /**
   * Google's account picture. Null for email/password accounts — nothing in this
   * app uploads one — so <Avatar> always needs its initials fallback.
   */
  photoURL: string | null
}

/** One sign-in, as shown in the admin console. */
export interface LoginEvent {
  id: string
  uid: string
  email: string | null
  method: "password" | "google" | "register"
  /** Null for the instant between the local write and the server timestamp. */
  at: Date | null
}

/**
 * One AI call. Written by the Cloud Functions — the token counts only exist on
 * the provider's response, which never reaches the browser.
 */
export interface AiUsageEvent {
  id: string
  feature: "assistant" | "chef" | "image"
  email: string | null
  model: string
  ok: boolean
  ms: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  /** Photos sent *to* the assistant, not images generated. */
  images: number
  errorCode?: string
  at: Date | null
}

export interface LoginValues {
  email?: string
  password?: string
}

export interface RegisterValues {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}
