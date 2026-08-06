import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { ChefRequest, ChefResponse } from "./types"

/**
 * `httpsCallable` defaults to a 70-second timeout while the callable is
 * deployed at 300. Working a whole recipe through a rescale is not a fast
 * request, and a browser that gives up at 70s abandons a call the server goes
 * on to finish and bill. Keep this under `timeoutSeconds` in
 * `functions/src/chef.ts` and comfortably over how long a fork actually takes.
 */
const CALL_TIMEOUT_MS = 180_000

/**
 * Calls the `askChef` Cloud Function. The Anthropic key lives there and never
 * reaches the browser; the callable rejects unauthenticated requests.
 */
export const askChef = async (request: ChefRequest): Promise<ChefResponse> => {
  const call = httpsCallable<ChefRequest, ChefResponse>(functions, "askChef", {
    timeout: CALL_TIMEOUT_MS,
  })
  const { data } = await call(request)
  return data
}
