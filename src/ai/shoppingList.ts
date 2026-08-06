import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { ShoppingRequest, ShoppingResponse } from "./types"

/**
 * Well over `httpsCallable`'s 70-second default, and under the callable's own
 * `timeoutSeconds` — the same arrangement as `src/ai/chef.ts`, for the same
 * reason: a browser that gives up early abandons a call the server goes on to
 * finish and bill.
 *
 * Shorter than the chef's 180s, though. Reading a week of recipes into one list
 * is a single pass with no rewriting to do, and the cook pressing this has a
 * working fallback waiting behind it — a build that has not landed in ninety
 * seconds is better replaced by the verbatim list than waited on.
 */
const CALL_TIMEOUT_MS = 90_000

/**
 * Calls the `buildShoppingList` Cloud Function, which holds the Anthropic key
 * and rejects unauthenticated callers.
 *
 * The caller is expected to fall back to `consolidateVerbatim` when this throws.
 * Consolidating amounts is worth a model call; being *able to shop* is not worth
 * depending on one.
 */
export const buildShoppingList = async (
  request: ShoppingRequest
): Promise<ShoppingResponse> => {
  const call = httpsCallable<ShoppingRequest, ShoppingResponse>(
    functions,
    "buildShoppingList",
    { timeout: CALL_TIMEOUT_MS }
  )
  const { data } = await call(request)
  return data
}
