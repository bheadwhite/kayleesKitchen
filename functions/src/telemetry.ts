import { getApps, initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

/**
 * Where AI calls are recorded for the admin console.
 *
 * This is written **server-side on purpose**: token counts only exist on the
 * Anthropic response, which never reaches the browser, and a client-reported
 * usage number is a number the client can make up. The console reads this
 * collection; nothing writes to it except these functions.
 */
export const AI_USAGE_COLLECTION = "aiUsage"

/** The admin SDK is shared with anything else that needs it, and only ever initialised once. */
const db = () => {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
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
 * Records one AI call. Deliberately never throws and is never awaited by the
 * request path: a telemetry write that fails, or a Firestore that is briefly
 * unreachable, must not turn into a failed recipe transcription for the user.
 * The console showing one call short is the cheaper failure by a wide margin.
 */
export const recordAiUsage = (event: AiUsageEvent): void => {
  void db()
    .collection(AI_USAGE_COLLECTION)
    .add({ ...event, at: FieldValue.serverTimestamp() })
    .catch((error) => console.error("Could not record AI usage", error))
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
