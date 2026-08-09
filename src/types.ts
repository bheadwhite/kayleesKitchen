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
   * How many the recipe as written feeds, and what one serving is —
   * "2 cookies", "about 1½ cups".
   *
   * **Authored, and therefore not the same thing as the chef's estimate.**
   * `recipes/{id}/chef/yield` holds a figure a model read off the ingredients
   * and the method, stamped with a fingerprint so it invalidates itself; this
   * is what the recipe itself claims, written by whoever typed it in or
   * proposed by the chef and accepted. When both exist the authored one wins —
   * an estimate is what you fall back on when the recipe does not say.
   *
   * Absent on every recipe written before the fields existed, which is most of
   * them, and that is exactly the case the estimate cache goes on covering.
   */
  serves?: number | null
  servingSize?: string | null
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

/** Which meal of the day a planned recipe belongs to. */
export type MealSlot = "breakfast" | "lunch" | "dinner"

/** Somebody in a session, denormalised so a member list needs no second read. */
export interface SessionMember {
  uid: string
  name: string
  email: string | null
}

/**
 * A planning session — `sessions/{sessionId}`.
 *
 * **Planning is a group thing**, and the session is the group: a name, however
 * many are eating, a week, and one shopping list, shared by whoever is in it.
 * Somebody can be in several at once — a household's weeknights, a supper club,
 * a camping trip — and switching between them swaps the whole Plan tab. That is
 * why the plan hangs off a session rather than off a person: two people cooking
 * the same Thursday need one week between them, not two.
 *
 * `memberUids` is the access list *and* the query key: `array-contains` finds
 * your sessions on a single-field index, and the rules compare against it
 * directly rather than reading a membership document.
 */
export interface PlanningSession {
  id: string
  name: string
  ownerUid: string
  /**
   * How many the session cooks for by default. Every meal planned into it is
   * scaled to this unless that meal says otherwise — see `PlannedMeal.serves`.
   */
  covers: number
  memberUids: string[]
  members: SessionMember[]
  createdAt: Date | null
}

/**
 * An ask to join a session — `invites/{toEmail}_{sessionId}`.
 *
 * The composite id is doing real work, exactly as it does for a rating: a second
 * ask replaces the first rather than stacking, and — because the id can be
 * *derived* rather than looked up — the security rule can check that an ask
 * exists without being handed its id. That is what lets someone join a session
 * they are not yet a member of, with no Cloud Function in the middle.
 *
 * **Addressed by email, not by uid**, for the plain reason that a uid is not
 * something anyone can look up: the `users` profile documents hold names and
 * addresses and nothing else. An address is also what the rule can check
 * cheaply, since Firebase puts it in the token — the same way `isAdmin()` reads
 * it. The uid only has to exist at the moment of joining, and at that moment it
 * is `request.auth.uid`, supplied by the person joining about themselves.
 */
export interface SessionInvite {
  id: string
  sessionId: string
  /** Carried so the ask can be shown without reading a session you cannot read. */
  sessionName: string
  covers: number
  fromUid: string
  fromName: string
  toEmail: string
  createdAt: Date | null
}

/**
 * One recipe slotted into one meal of one day —
 * `sessions/{sessionId}/meals/{mealId}`.
 */
export interface PlannedMeal {
  id: string
  /**
   * The calendar day, as `YYYY-MM-DD`.
   *
   * A **string, not a Timestamp**, and that is the whole point: a Timestamp is
   * an *instant*, and an instant renders as a different day depending on where
   * the phone is and what time the meal was planned at. "Thursday's dinner" is a
   * day on a wall calendar. The format also sorts lexicographically, so the
   * range query needs no conversion at either end.
   */
  date: string
  slot: MealSlot
  recipeId: string
  /**
   * Denormalised off the recipe. A meal has to be able to name itself after its
   * recipe is deleted or while the list has not loaded — an agenda of blank rows
   * is worse than one naming a dish that is no longer filed.
   */
  title: string
  /**
   * How many this one meal is for, when it differs from the session's `covers`.
   * Absent means "whatever the session cooks for", so changing the session's
   * number moves every meal that has not been spoken for individually.
   *
   * Free to vary: the scaling spec is keyed by the recipe alone, so a meal set
   * to eleven costs no more to work out than the fourth meal set to four.
   */
  serves?: number
  /** Who put it up. A shared week wants to say whose idea a Tuesday was. */
  byUid: string
  byName: string
  /** Null for the instant between the local write and the server timestamp. */
  addedAt: Date | null
}

/**
 * One line on the shopping list — `sessions/{sessionId}/shopping/{itemId}`.
 *
 * The list is **persistent and appended to**, not derived from the plan: it is
 * read in a shop, and a recipe swapped at home while somebody is standing in the
 * dairy aisle must not rewrite what they are reading. That is also what gives
 * manual items — milk, paper towels — somewhere to live.
 */
export interface ShoppingItem {
  id: string
  /** "yellow onion". Normalised lowercase, like a tag, so two spellings merge. */
  name: string
  /** "3 medium", "1 cup + 2 tbsp", "to taste". Empty for a bare manual item. */
  amount: string
  /** A key from `SECTIONS` in `src/shoppingList.ts`; anything else reads as other. */
  section: string
  /** Recipe titles this line came from. Empty for something typed in by hand. */
  from: string[]
  /**
   * The ids behind `from`, in no particular order.
   *
   * `from` is what a person reads, and titles are all the chef ever produces —
   * but a title is not an identity: two recipes may share one, and renaming a
   * recipe would otherwise orphan every line crediting it. The client fills
   * this in from the meals it actually sent, so the pairing is known rather
   * than matched.
   *
   * **Optional, and absent on every line written before it existed.** A line
   * with no ids still shows its credits and still merges; what it cannot do is
   * be attributed to a recipe on the list's cover chips, so it is left alone
   * rather than guessed at.
   */
  fromIds?: string[]
  checked: boolean
  /** Order within the section, as the chef listed it. */
  sort: number
  /** Typed in by hand rather than read off a recipe. */
  manual?: boolean
  /** Who put it on the list, and who ticked it off. Null before either. */
  byUid?: string | null
  tickedByUid?: string | null
  /** Null for the instant between the local write and the server timestamp. */
  addedAt: Date | null
}

/**
 * Which aisle an ingredient is found in — `pantry/{normalisedName}`.
 *
 * The same idea as the tag registry, and the same idea as the yield cache:
 * **what the chef works out is written down as data the app can then read
 * without it.** "Butter is in the dairy aisle" is a fact about a shop, not
 * about this list, and re-buying it on every build would be paying repeatedly
 * for an answer that never changes. Written only by the callable, read by
 * everyone — including a household with no AI entitlement at all, who get
 * correctly sorted lists for nothing.
 */
export interface PantryEntry {
  name: string
  /** A key from `SECTIONS` in `src/shoppingList.ts`. */
  section: string
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
  feature: "assistant" | "chef" | "image" | "shopping" | "scaling"
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
  /**
   * Calls to the provider this one request took. A feature that quietly needs
   * three swings every time is indistinguishable from a healthy one without it.
   */
  attempts?: number
  errorCode?: string
  /** The provider's HTTP status, when the failure came back as one. */
  errorStatus?: number
  /**
   * What the provider actually said — the difference between "retry later" and
   * "this has never worked". Recorded server-side; see `AiUsageEvent` in
   * `functions/src/telemetry.ts` for why it is safe to keep.
   */
  errorMessage?: string
  at: Date | null
}

/** One bucket of summed usage — the shape repeated per day, feature, and model. */
export interface UsageBucket {
  calls: number
  ok: number
  failed: number
  ms: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  images: number
  attempts: number
}

/**
 * A day of AI usage, summed server-side — see `AI_USAGE_DAILY_COLLECTION`.
 *
 * The day is `YYYY-MM-DD` **in UTC**, which is the one place in this app a date
 * is not the cook's local day. It is a billing bucket rather than a wall
 * calendar, the server cannot know the household's timezone, and the split
 * washes out of any weekly or monthly total.
 */
export interface DailyUsage extends UsageBucket {
  date: string
  /**
   * Each feature carries its own per-model split, because cost needs a rate and
   * a rate belongs to a model. Pricing a feature from its bare token totals only
   * works while every callable runs the same model — which is the assumption
   * most likely to break next.
   */
  features: Partial<Record<AiUsageEvent["feature"], UsageBucket & { models: Record<string, UsageBucket> }>>
  /** Keyed by the exact model string, so a swap shows as a new row. */
  models: Record<string, UsageBucket>
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
