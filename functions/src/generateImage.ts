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

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
})

/** Enough of the recipe to photograph, without burning tokens on every step. */
const buildPrompt = (draft: RecipeDraft): string => {
  const named = draft.ingredients
    .map((ingredient) => ingredient.name.trim())
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

export const generateRecipeImage = onCall<
  GenerateImageRequest,
  Promise<GenerateImageResponse>
>({ timeoutSeconds: 300, memory: "512MiB", cors: true }, async (request) => {
  if (request.auth == null) {
    throw new HttpsError("unauthenticated", "Sign in to generate a recipe image.")
  }

  const draft = request.data?.draft
  if (draft == null) {
    throw new HttpsError("invalid-argument", "draft is required.")
  }
  // Without either, the prompt is "photograph a home-cooked meal" — a stock
  // photo of nothing in particular, which is worse than no image.
  if (!draft.title.trim() && draft.ingredients.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Add a title or some ingredients first so there is something to picture."
    )
  }

  const startedAt = Date.now()
  // Vertex does not report tokens for image generation, so a call is the unit
  // here — the console shows counts and latency rather than fabricating a
  // token number the provider never gave us.
  const record = (ok: boolean, errorCode?: string) =>
    recordAiUsage({
      feature: "image",
      uid: request.auth?.uid ?? null,
      email: request.auth?.token.email ?? null,
      model: MODEL,
      ok,
      ms: Date.now() - startedAt,
      ...(errorCode ? { errorCode } : {}),
    })

  const projectId = await auth.getProjectId()
  const clientAuth = await auth.getClient()
  const url =
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`

  let parts: GeminiPart[]
  try {
    const response = await clientAuth.request<{
      candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
    }>({
      url,
      method: "POST",
      data: {
        contents: [{ role: "user", parts: [{ text: buildPrompt(draft) }] }],
      },
    })
    parts = response.data.candidates?.[0]?.content?.parts ?? []
  } catch (error) {
    console.error("Vertex image generation failed", error)
    record(false, "internal")
    throw new HttpsError("internal", "Could not generate an image just now.")
  }

  const image = parts.find((part) => part.inlineData != null)?.inlineData
  if (image == null) {
    // The model answers in text when it declines — surface that, not a crash.
    const text = parts.find((part) => part.text)?.text
    console.warn("No image part returned", text)
    record(false, "no-image")
    throw new HttpsError("internal", "The model did not return an image. Try again.")
  }

  record(true)
  return { mimeType: image.mimeType, data: image.data }
})
