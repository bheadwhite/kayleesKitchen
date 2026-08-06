import type { DirectionSection, Ingredient } from "./types.js"

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
 * Mirrors `src/recipeFingerprint.ts` on the client; the two packages share no
 * build. If they drift, every lookup misses and the chef is asked again —
 * wasteful, but never wrong, which is the right way for this to fail.
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
 * A stamp of **the ingredient lines alone**, keying the scaling spec.
 *
 * Narrower than the full fingerprint on purpose: a rule about how much flour to
 * buy is not changed by a clearer instruction on how to fold it in, so a
 * rewritten method must not throw the spec away and buy it again.
 *
 * Mirrors `src/recipeFingerprint.ts` on the client — same warning as above, and
 * the same benign failure if they drift.
 */
export const ingredientsFingerprint = (recipe: Fingerprintable): string =>
  hash(JSON.stringify(ingredientLines(recipe)))
