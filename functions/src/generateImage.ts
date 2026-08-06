import { GoogleAuth } from "google-auth-library"
import { HttpsError, onCall } from "firebase-functions/v2/https"

import { recordAiUsage } from "./telemetry.js"

import type { GenerateImageRequest, GenerateImageResponse, RecipeDraft } from "./types.js"

/**
 * Google's image model, reached through Vertex AI in this same project.
 *
 * Note this is *not* Claude — the Anthropic API has no image generation, so the
 * recipe assistant and this share nothing but the recipe they read from.
 *
 * Imagen's publisher models are not available to this project (its
 * `imagen-*-generate-*` ids 404), so this uses the Gemini image model, which is
 * reachable and returns inline PNG data from `:generateContent`.
 */
const MODEL = "gemini-2.5-flash-image"
const LOCATION = "us-central1"

/**
 * Image generation fails transiently far more often than text does: Vertex
 * returns 429 when the project's image quota is momentarily spent and 503 when
 * the model is overloaded, and the model itself sometimes answers a perfectly
 * ordinary prompt with prose instead of a picture.
 *
 * None of those are the user's problem, and gaxios will not help — its retry
 * config excludes POST, so *every* call here is one-shot unless we say
 * otherwise. Three tries with a widening gap turns most of them into a slightly
 * slower success instead of a toast.
 */
const ATTEMPTS = 3
const BACKOFF_MS = 1500

/** HTTP statuses worth a second try; anything else is our bug, not a blip. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

/**
 * Finish reasons meaning a filter refused, on the way in or on the way out.
 * Retrying an identical prompt past one of these just spends quota to be told
 * no again, so they end the attempt loop immediately.
 */
const BLOCKED_REASONS = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_PROHIBITED_CONTENT",
  "RECITATION",
  "IMAGE_RECITATION",
  "BLOCKLIST",
  "SPII",
])

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Enough of the recipe to photograph, without burning tokens on every step. */
const buildPrompt = (draft: RecipeDraft): string => {
  const named = draft.ingredients
    .map((ingredient) => String(ingredient?.name ?? "").trim())
    .filter(Boolean)
    .slice(0, 12)

  const lines = [
    "Generate a single appetizing food photograph of the finished dish described below.",
    "",
    `Dish: ${draft.title.trim() || "a home-cooked meal"}`,
  ]
  if (named.length > 0) lines.push(`Made with: ${named.join(", ")}`)

  lines.push(
    "",
    "Style: natural daylight, shallow depth of field, plated on a simple table as it",
    "would look cooked at home — appetising but not glossy studio advertising.",
    "Show only the finished dish. No text, no captions, no watermarks, no logos,",
    "no hands, no recipe cards, and no collage or multiple panels."
  )

  return lines.join("\n")
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  /** Prompt-side refusal — set when the request never reached generation. */
  promptFeedback?: { blockReason?: string }
}

/** What one call to Vertex produced, already classified. */
type Attempt =
  | { kind: "image"; mimeType: string; data: string }
  /** Worth another go — a blip, or a turn that came back as prose. */
  | { kind: "retry"; errorCode: string; detail: string }
  /** A refusal or a bad request; trying again would change nothing. */
  | { kind: "fatal"; errorCode: string; detail: string; message: string }

/** The HTTP status hiding on a gaxios error, wherever this version put it. */
const statusOf = (error: unknown): number | undefined => {
  const candidate = error as { status?: number; response?: { status?: number } }
  return candidate?.status ?? candidate?.response?.status
}

const isDraft = (value: unknown): value is RecipeDraft => {
  if (value == null || typeof value !== "object") return false
  const draft = value as Partial<RecipeDraft>
  return typeof draft.title === "string" && Array.isArray(draft.ingredients)
}

const attemptGeneration = async (
  url: string,
  client: Awaited<ReturnType<GoogleAuth["getClient"]>>,
  prompt: string
): Promise<Attempt> => {
  let body: GeminiResponse
  try {
    const response = await client.request<GeminiResponse>({
      url,
      method: "POST",
      data: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          // Load-bearing. Without it the modality is left to the endpoint's
          // default, and the model is free to answer a "draw me dinner" prompt
          // with a paragraph *about* dinner — which is precisely the "no image
          // returned, try again" the user kept hitting. This model does not
          // accept image-only output, so TEXT rides along and is discarded.
          responseModalities: ["TEXT", "IMAGE"],
          // The editor frames photos at 16/10 and crops with `object-cover`.
          // The model's default is square, so a third of every generated image
          // was being thrown away — and never the same third twice.
          imageConfig: { aspectRatio: "16:9" },
        },
      },
    })
    body = response.data
  } catch (error) {
    const status = statusOf(error)
    const detail = `HTTP ${status ?? "?"}`
    if (status != null && !RETRYABLE_STATUS.has(status)) {
      console.error("Vertex image generation rejected the request", status, error)
      return {
        kind: "fatal",
        errorCode: "internal",
        detail,
        message: "Could not generate an image just now.",
      }
    }
    console.warn("Vertex image generation failed, may retry", detail, error)
    return {
      kind: "retry",
      errorCode: status === 429 ? "resource-exhausted" : "internal",
      detail,
    }
  }

  // A prompt-side block never reaches the model, so there are no candidates to
  // inspect — this has to be read before the parts.
  const blockedPrompt = body.promptFeedback?.blockReason
  if (blockedPrompt) {
    return {
      kind: "fatal",
      errorCode: "failed-precondition",
      detail: `prompt ${blockedPrompt}`,
      message: "This recipe's wording tripped the image filter. Try renaming the dish.",
    }
  }

  const candidate = body.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const image = parts.find((part) => part.inlineData != null)?.inlineData

  if (image?.data) {
    return { kind: "image", mimeType: image.mimeType || "image/png", data: image.data }
  }

  const finishReason = candidate?.finishReason ?? "none"
  if (BLOCKED_REASONS.has(finishReason)) {
    return {
      kind: "fatal",
      errorCode: "failed-precondition",
      detail: finishReason,
      message: "The image filter declined this dish. Try renaming it or editing the ingredients.",
    }
  }

  // Everything left is a turn that simply did not draw: prose instead of a
  // picture, or an image truncated by the token cap. Both come good on a retry
  // often enough to be worth one.
  const spoken = parts.find((part) => part.text)?.text
  console.warn("No image part returned", { finishReason, text: spoken?.slice(0, 300) })
  return { kind: "retry", errorCode: "no-image", detail: finishReason }
}

export const generateRecipeImage = onCall<
  GenerateImageRequest,
  Promise<GenerateImageResponse>
>({ timeoutSeconds: 300, memory: "512MiB", cors: true }, async (request) => {
  if (request.auth == null) {
    throw new HttpsError("unauthenticated", "Sign in to generate a recipe image.")
  }

  const startedAt = Date.now()
  // Vertex does not report tokens for image generation, so a call is the unit
  // here — the console shows counts and latency rather than fabricating a
  // token number the provider never gave us. `attempts` is the point of the
  // whole record: a feature that "works but sometimes doesn't" looks identical
  // to a healthy one until you can see how often it needed a second swing.
  //
  // Declared before the first validation throw, so *every* rejection lands in
  // the console. Bailing out before this existed is how a run of malformed
  // drafts could look like no traffic at all.
  const record = (ok: boolean, attempts: number, errorCode?: string) =>
    recordAiUsage({
      feature: "image",
      uid: request.auth?.uid ?? null,
      email: request.auth?.token.email ?? null,
      model: MODEL,
      ok,
      ms: Date.now() - startedAt,
      attempts,
      ...(errorCode ? { errorCode } : {}),
    })

  const draft = request.data?.draft
  if (!isDraft(draft)) {
    record(false, 0, "invalid-argument")
    throw new HttpsError("invalid-argument", "A recipe draft is required.")
  }
  // Without either, the prompt is "photograph a home-cooked meal" — a stock
  // photo of nothing in particular, which is worse than no image.
  if (!draft.title.trim() && draft.ingredients.length === 0) {
    record(false, 0, "failed-precondition")
    throw new HttpsError(
      "failed-precondition",
      "Add a title or some ingredients first so there is something to picture."
    )
  }

  // Inside the guarded section: resolving credentials can fail on its own, and
  // when it did, it surfaced as a bare 500 with nothing in the usage console —
  // the one failure the console most needed to show.
  let url: string
  let client: Awaited<ReturnType<GoogleAuth["getClient"]>>
  try {
    const projectId = await auth.getProjectId()
    client = await auth.getClient()
    url =
      `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
      `/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`
  } catch (error) {
    console.error("Could not authenticate to Vertex", error)
    record(false, 0, "unauthenticated-service")
    throw new HttpsError("internal", "Could not reach the image service.")
  }

  const prompt = buildPrompt(draft)
  let last: Attempt = { kind: "retry", errorCode: "no-image", detail: "not attempted" }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    last = await attemptGeneration(url, client, prompt)

    if (last.kind === "image") {
      record(true, attempt)
      return { mimeType: last.mimeType, data: last.data }
    }
    if (last.kind === "fatal") {
      record(false, attempt, last.errorCode)
      throw new HttpsError(
        last.errorCode === "failed-precondition" ? "failed-precondition" : "internal",
        last.message
      )
    }
    // Linear, not exponential: the client is a person watching a spinner, and
    // the callable's own deadline is the real ceiling.
    if (attempt < ATTEMPTS) await sleep(BACKOFF_MS * attempt)
  }

  console.error("Image generation exhausted retries", last)
  record(false, ATTEMPTS, last.errorCode)
  throw new HttpsError(
    last.errorCode === "resource-exhausted" ? "resource-exhausted" : "internal",
    last.errorCode === "resource-exhausted"
      ? "The image service is busy right now — try again in a minute."
      : "Could not get an image after a few tries. Try again, or tweak the title."
  )
})
