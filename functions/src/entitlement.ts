import { HttpsError } from "firebase-functions/v2/https"

/** Every callable that can spend money with a provider. */
export type SpendingFeature = "assistant" | "chef" | "image" | "shopping" | "scaling"

export interface Caller {
  uid: string
  email: string | null
}

/**
 * The one place a model call can be refused.
 *
 * **It lets everybody through today, and that is deliberate.** What this is for
 * is the seam: every callable asks here before it spends, so turning AI into
 * something metered, tiered, or capped later is a change to this function's body
 * and a collection to read — not a hunt through four callables for the places
 * that quietly cost money.
 *
 * The seam only means anything because of what sits behind it. Everything the
 * model produces is written down as durable data the app reads on its own:
 * `recipes/{id}/chef/yield`, `recipes/{id}/scaling/{fingerprint}`, and
 * `pantry/{name}`. So a household that cannot spend still plans its week, still
 * builds a shopping list, and still gets any recipe anybody has ever analysed
 * scaled to any number — the thing that would be sold is the *asking*, not the
 * using, and the app degrades by getting less clever rather than by stopping.
 *
 * Called with the feature so that a future limit can be per-feature: image
 * generation and a shopping list are not the same price and will not want the
 * same cap.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const assertCanSpend = async (
  caller: Caller,
  feature: SpendingFeature
): Promise<void> => {
  // No entitlement check yet. When there is one it belongs here, and it should
  // throw `resource-exhausted` for a cap reached and `permission-denied` for a
  // tier that never had the feature — the clients already treat both as "the
  // chef could not be reached" and fall back rather than failing.
  if (caller.uid === "") {
    throw new HttpsError("unauthenticated", "Sign in first.")
  }
}
