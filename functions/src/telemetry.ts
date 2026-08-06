import { FieldValue } from "firebase-admin/firestore"

import { db } from "./db.js"

/**
 * Where AI calls are recorded for the admin console.
 *
 * This is written **server-side on purpose**: token counts only exist on the
 * Anthropic response, which never reaches the browser, and a client-reported
 * usage number is a number the client can make up. The console reads this
 * collection; nothing writes to it except these functions.
 */
export const AI_USAGE_COLLECTION = "aiUsage"

/**
 * One document per calendar day, holding the same numbers summed.
 *
 * **The raw feed cannot answer "what did this cost me last month".** It is
 * capped at 200 events and read newest-first, on purpose — an unbounded
 * listener on a collection that grows with every AI call would eventually pull
 * the whole history onto a phone. So a month of traffic does not fall off the
 * end of the console by accident; it falls off by design, and no amount of
 * raising the cap fixes that without reintroducing the problem the cap exists
 * for.
 *
 * A rollup is the same trick `ratingSum` / `ratingCount` already play on a
 * recipe: keep the sum, so reading it is arithmetic rather than a re-read of
 * every event ever recorded. Thirty documents is a month. The raw feed keeps
 * doing what it is good at — "what just broke, and what did the provider say".
 *
 * **Tokens are stored; dollars are not.** Prices change, get introductory
 * discounts, and get mis-transcribed, and a cost frozen into the record at
 * write time is wrong forever with nothing to recompute it from. Tokens are
 * facts about what happened; a price is an interpretation applied at read time,
 * which means correcting the table corrects every day already recorded. Same
 * reasoning as the yield fingerprint: the reader verifies, so it cannot quietly
 * serve something stale.
 *
 * **The day is UTC**, deliberately. `src/calendar.ts` is emphatic that a
 * planned dinner is a wall-calendar day and must be local — but that is a
 * statement about *the cook's* day, and this function has no idea what
 * timezone the household is in. A stated convention beats a guess, and an
 * evening split across two rows washes out of any weekly or monthly total,
 * which is the only thing this is read for.
 */
export const AI_USAGE_DAILY_COLLECTION = "aiUsageDaily"

/** `YYYY-MM-DD` in UTC — see the note above on why UTC. */
const utcDay = (at: Date) => at.toISOString().slice(0, 10)

export interface AiUsageEvent {
  /** Which callable — the console splits cost by feature. */
  feature: "assistant" | "chef" | "image" | "shopping" | "scaling"
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
  /**
   * How many calls to the provider this one request took. Image generation
   * retries transient failures, and a feature that quietly needs three swings
   * every time reads as healthy without this — same successes, same latency
   * bucket, three times the spend.
   */
  attempts?: number
  /** Set when `ok` is false — the HttpsError code, not the raw provider error. */
  errorCode?: string
  /** The provider's HTTP status, when the failure came back as one. */
  errorStatus?: number
  /**
   * What the provider actually said, truncated.
   *
   * `errorCode` alone cannot tell two failures apart that need opposite
   * responses: a malformed tool schema and an overloaded model are both
   * `internal`, and the console showed a bare "internal" for each. The real
   * message went to `console.error`, which means the only way to read it was
   * `gcloud functions logs read` — so a feature that had **never once
   * succeeded** looked, from the console, exactly like a feature nobody had
   * used much. That is the failure this field exists to prevent.
   *
   * Safe to keep because `firestore.rules` limits reading `aiUsage` to the
   * admin, and because it is the *provider's* message rather than the request:
   * prompt and recipe content are never copied in here.
   */
  errorMessage?: string
}

/**
 * Provider messages can run long — a schema rejection quotes the offending
 * subschema — and the console holds 200 events on a phone. Enough to name the
 * cause, not enough to become the page.
 */
const MAX_ERROR_MESSAGE = 300

export const describeError = (
  error: unknown
): { errorStatus?: number; errorMessage?: string } => {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined
  const message = error instanceof Error ? error.message : String(error ?? "")
  return {
    ...(typeof status === "number" ? { errorStatus: status } : {}),
    ...(message ? { errorMessage: message.slice(0, MAX_ERROR_MESSAGE) } : {}),
  }
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

  // The rollup is a **separate, independently guarded write**, not a second
  // statement inside the block above. They record the same call but answer
  // different questions, and one failing must not take the other with it: the
  // raw event is how you find out what just broke, the rollup is how you find
  // out what the month cost. Losing both because one threw is the worst of the
  // three outcomes.
  try {
    const day = utcDay(new Date())
    const n = FieldValue.increment(1)
    const add = (value?: number) => FieldValue.increment(value ?? 0)
    // Built as a nested literal rather than dot-notation field paths, because a
    // model id may contain dots — `gemini-2.5-flash-image` would otherwise be
    // read as four levels of nesting. As an object key it is just a key.
    const bucket = {
      calls: n,
      ok: FieldValue.increment(event.ok ? 1 : 0),
      failed: FieldValue.increment(event.ok ? 0 : 1),
      ms: add(event.ms),
      inputTokens: add(event.inputTokens),
      outputTokens: add(event.outputTokens),
      cacheReadTokens: add(event.cacheReadTokens),
      cacheCreationTokens: add(event.cacheCreationTokens),
      images: add(event.images),
      attempts: add(event.attempts ?? 1),
    }
    void db()
      .collection(AI_USAGE_DAILY_COLLECTION)
      .doc(day)
      // `set` with merge rather than `update`: the first call of the day has no
      // document to update, and an increment against a missing document is an
      // error rather than a start from zero.
      .set(
        {
          date: day,
          ...bucket,
          // The model is nested **inside** the feature as well as recorded at
          // the top level, and that is not redundancy — it is the only shape
          // that survives the decision this data exists to inform. Cost needs a
          // rate, a rate belongs to a model, and the moment one callable runs a
          // cheaper model than another, a feature bucket that does not know
          // which model produced its tokens can only be priced by assuming they
          // all share one. That assumption is true today and is exactly what
          // would be about to stop being true.
          features: { [event.feature]: { ...bucket, models: { [event.model]: bucket } } },
          models: { [event.model]: bucket },
        },
        { merge: true }
      )
      .catch((error) => console.error("Could not roll up AI usage", error))
  } catch (error) {
    console.error("Could not roll up AI usage", error)
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
