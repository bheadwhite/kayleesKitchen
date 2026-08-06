import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { ScalingRequest, ScalingResponse } from "./types"

/**
 * Over `httpsCallable`'s 70-second default and under the callable's own
 * `timeoutSeconds`, for the reason `src/ai/chef.ts` gives: a browser that gives
 * up early abandons a call the server goes on to finish and bill.
 *
 * Short, because this happens with somebody waiting on a shopping list and the
 * caller has a working fallback behind it — a recipe whose rules cannot be
 * worked out in a minute is better carried through with its amounts as written.
 */
const CALL_TIMEOUT_MS = 60_000

/**
 * Asks the chef how a recipe's ingredient lines respond to cooking for more
 * people, once, for as long as those lines stay put.
 *
 * The result is written to `recipes/{id}/scaling/{fingerprint}` by the callable
 * and read from there by everyone afterwards — so this is only ever reached for
 * a recipe nobody has scaled since it was last edited, and the answer covers
 * every serving count rather than the one being asked for.
 */
export const analyseScaling = async (request: ScalingRequest): Promise<ScalingResponse> => {
  const call = httpsCallable<ScalingRequest, ScalingResponse>(
    functions,
    "analyseRecipeScaling",
    { timeout: CALL_TIMEOUT_MS }
  )
  const { data } = await call(request)
  return data
}
