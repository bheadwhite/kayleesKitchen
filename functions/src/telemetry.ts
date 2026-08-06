import { getApp, initializeApp, type App } from "firebase-admin/app"
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore"

/**
 * Where AI calls are recorded for the admin console.
 *
 * This is written **server-side on purpose**: token counts only exist on the
 * Anthropic response, which never reaches the browser, and a client-reported
 * usage number is a number the client can make up. The console reads this
 * collection; nothing writes to it except these functions.
 */
export const AI_USAGE_COLLECTION = "aiUsage"

let firestore: Firestore | undefined

/**
 * The Firestore handle, initialised on first use.
 *
 * Ask for the default app; create one only if that fails. Both of the obvious
 * shortcuts are wrong here, and each was tried:
 *
 * - `getFirestore()` with no argument looks up the default app and throws
 *   `app/no-app` when there isn't one.
 * - `getApps().length > 0 ? getApp() : initializeApp()` looks safer and is not:
 *   the runtime has apps registered that are **not** the default, so the length
 *   is non-zero, the ternary takes the `getApp()` branch, and that throws the
 *   same `app/no-app`. Counting apps says nothing about whether the *default*
 *   one exists.
 *
 * `try { getApp() } catch { initializeApp() }` asks the only question that
 * matters and cannot be fooled by either case.
 */
const db = (): Firestore => {
  if (!firestore) {
    let app: App
    try {
      app = getApp()
    } catch {
      app = initializeApp()
    }
    firestore = getFirestore(app)
  }
  return firestore
}

export interface AiUsageEvent {
  /** Which callable — the console splits cost by feature. */
  feature: "assistant" | "image"
  uid: string | null
  email: string | null
  model: string
  ok: boolean
  /** Wall-clock duration, so a slow model shows up as slow rather than as noise. */
  ms: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  /** How many images went *in* (photo transcription), not how many came out. */
  images?: number
  /** Set when `ok` is false — the HttpsError code, not the raw provider error. */
  errorCode?: string
}

/**
 * Records one AI call. Never throws, and is never awaited by the request path:
 * a telemetry write that fails — or a Firestore briefly unreachable — must not
 * turn into a failed recipe transcription for the user. The console showing one
 * call short is the cheaper failure by a wide margin.
 *
 * The whole body is guarded, not just the promise. A `.catch()` alone only
 * covers a *rejected* write; `db()` can throw **synchronously** before there is
 * any promise to attach to, and that is precisely how an earlier version of
 * this turned every image generation into an unhandled `INTERNAL`. If a
 * function must not be able to break its caller, the guard has to cover the
 * synchronous path too.
 */
export const recordAiUsage = (event: AiUsageEvent): void => {
  try {
    void db()
      .collection(AI_USAGE_COLLECTION)
      .add({ ...event, at: FieldValue.serverTimestamp() })
      .catch((error) => console.error("Could not record AI usage", error))
  } catch (error) {
    console.error("Could not record AI usage", error)
  }
}

/** Sums the usage across every iteration of a paused/continued turn. */
export const totalUsage = (
  usages: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }[]
) =>
  usages.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + (usage.input_tokens ?? 0),
      outputTokens: total.outputTokens + (usage.output_tokens ?? 0),
      cacheReadTokens: total.cacheReadTokens + (usage.cache_read_input_tokens ?? 0),
      cacheCreationTokens: total.cacheCreationTokens + (usage.cache_creation_input_tokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
  )
