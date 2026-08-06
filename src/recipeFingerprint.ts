import type { DirectionSection, Ingredient } from "@/types"

/**
 * cyrb53 — a short, fast, non-cryptographic hash. Nothing here is a security
 * boundary: the worst a collision can do is serve a yield estimate for a recipe
 * that changed, and 53 bits over a household's recipe box makes that not
 * happen.
 */
const hash = (input: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

interface Fingerprintable {
  ingredients?: Ingredient[]
  directions?: DirectionSection[]
}

/**
 * A short stamp of **the parts of a recipe that decide how much it makes**.
 *
 * This is what makes the chef's yield estimate cacheable. "How many does this
 * feed?" has one answer for a given recipe, it costs a model call to work out,
 * and a household asks it of the same dishes over and over — so the answer is
 * stored beside the recipe and re-used until the recipe itself moves. Comparing
 * the stamp is how "until someone changes it" is enforced without a Firestore
 * trigger to go stale or race.
 *
 * **Only the ingredients and the method are in it.** Renaming a recipe, tagging
 * it, or changing its photo cannot change how many it feeds, and invalidating
 * on those would throw the answer away for a typo fix. `unique` is out for the
 * same reason — it decides how an ingredient is *drawn*, not how much of it
 * there is.
 *
 * Mirrored by hand in `functions/src/recipeFingerprint.ts`; the two packages
 * share no build. If they drift, every lookup misses and the chef is asked
 * again — wasteful, but never wrong, which is the right way for this to fail.
 */
export const recipeFingerprint = (recipe: Fingerprintable): string =>
  hash(
    JSON.stringify([
      ingredientLines(recipe),
      (recipe.directions ?? []).map((s) => [s.sectionTitle, s.steps]),
    ])
  )

const ingredientLines = (recipe: Fingerprintable) =>
  (recipe.ingredients ?? []).map((i) => [i.name, i.amount, Boolean(i.optional)])

/**
 * A stamp of **the ingredient lines alone** — deliberately narrower than
 * {@link recipeFingerprint}, and the difference is the whole point.
 *
 * This is what the scaling spec is keyed by (`recipes/{id}/scaling/{...}`). A
 * spec says how each *line* responds to cooking for more people: which ones are
 * linear, which round to whole units, which are "to taste" and never move. None
 * of that can be changed by rewriting step four.
 *
 * Under the full fingerprint it would be. Fixing a typo in the method would
 * throw away a spec that is still perfectly correct and buy it again — which is
 * exactly the "why did that cost a model call?" that makes a cache feel
 * arbitrary. Two caches, two stamps, each invalidated by the edits that
 * actually reach it.
 *
 * The yield cache keeps the wider stamp on purpose: how much a recipe makes
 * *can* turn on the method ("bake in two tins", "reserve half for later"), so
 * it has to move when the method does.
 */
export const ingredientsFingerprint = (recipe: Fingerprintable): string =>
  hash(JSON.stringify(ingredientLines(recipe)))
