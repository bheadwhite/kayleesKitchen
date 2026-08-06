import { FieldValue } from "firebase-admin/firestore"

import { db } from "./db.js"
import { recipeFingerprint } from "./recipeFingerprint.js"
import type { RecipeDraft } from "./types.js"

/**
 * One document, at a fixed id, holding what the chef worked out about how much
 * a recipe makes: `recipes/{recipeId}/chef/yield`.
 *
 * A fixed id rather than a generated one so there can only ever be one answer
 * per recipe — the second estimate overwrites the first instead of stacking a
 * history nobody reads.
 */
const YIELD_DOC = "yield"

const yieldRef = (recipeId: string) =>
  db().collection("recipes").doc(recipeId).collection("chef").doc(YIELD_DOC)

export interface CachedYield {
  baseServes: number
  /** The sentence the chef gave for how it read the number off the recipe. */
  basis: string
  /** What one serving is — "2 cookies", "about 1½ cups". */
  servingSize?: string
  /** The recipe this was worked out from — see `recipeFingerprint`. */
  fingerprint: string
}

/**
 * The stored estimate, **only if it still describes the recipe in hand**.
 *
 * The fingerprint comparison is the whole invalidation strategy. A Firestore
 * trigger on recipe writes would be the other way, and it is worse in every
 * respect that matters here: another deployed function, a window where the
 * estimate is live and wrong, no answer at all for recipes edited before the
 * trigger existed, and nothing to check against if it ever misfires. A stamp
 * the reader verifies cannot be out of date, because being out of date is the
 * thing it reports.
 *
 * Never throws. A cache that cannot be read is a cache miss, and a cache miss
 * costs a model call — not a failed request.
 */
export const readCachedYield = async (
  recipeId: string,
  recipe: RecipeDraft
): Promise<CachedYield | null> => {
  try {
    const snapshot = await yieldRef(recipeId).get()
    const data = snapshot.data() as CachedYield | undefined
    if (data == null) return null
    return data.fingerprint === recipeFingerprint(recipe) ? data : null
  } catch (error) {
    console.error("Could not read the cached yield", error)
    return null
  }
}

/**
 * Records what the chef worked out, stamped with the recipe it was worked out
 * from.
 *
 * Written server-side for the same reason token counts are: this is the number
 * the model produced, and the callable is the only place that knows it came
 * from the model rather than from whoever typed it. `firestore.rules` denies
 * client writes outright — the admin SDK bypasses rules, so nothing else can
 * put a figure here.
 *
 * Never throws and is never awaited by the request path. A cook standing in a
 * kitchen with an answer on screen does not care that the next session will
 * have to ask again; failing their request over it would be absurd.
 */
export const cacheYield = (
  recipeId: string,
  recipe: RecipeDraft,
  estimate: { baseServes: number; basis: string; servingSize?: string }
): void => {
  try {
    void yieldRef(recipeId)
      .set({
        baseServes: estimate.baseServes,
        basis: estimate.basis ?? "",
        servingSize: estimate.servingSize ?? "",
        fingerprint: recipeFingerprint(recipe),
        at: FieldValue.serverTimestamp(),
      })
      .catch((error) => console.error("Could not cache the yield", error))
  } catch (error) {
    // Guarded whole, not just the promise: `db()` can throw synchronously
    // before there is anything to attach a `.catch()` to.
    console.error("Could not cache the yield", error)
  }
}
