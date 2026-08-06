import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { RecipeDraft } from "@/types"

interface GenerateImageRequest {
  draft: RecipeDraft
}

interface GenerateImageResponse {
  mimeType: string
  data: string
}

/**
 * How long to wait for the callable.
 *
 * `httpsCallable` defaults to **70 seconds**, while the function is deployed
 * with `timeoutSeconds: 300`. Image generation plus a cold start clears 70s
 * often enough that the browser was abandoning calls the server went on to
 * finish — the user saw a failure, the project was billed for the image, and
 * nothing in the logs looked wrong. The two numbers have to agree.
 */
const CALL_TIMEOUT_MS = 300_000

/** Turns the callable's base64 payload into the same `File` a picker would give. */
export const toImageFile = (mimeType: string, base64: string, name: string): File => {
  let binary: string
  try {
    binary = atob(base64)
  } catch {
    // A truncated payload would otherwise surface as a raw DOMException string
    // in a toast, which tells the user nothing they can act on.
    throw new Error("The generated image came back damaged. Try again.")
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mimeType })
}

/**
 * Asks the `generateRecipeImage` Cloud Function for a photo of the dish.
 *
 * This is Google's image model via Vertex AI, not Claude — the Anthropic API has
 * no image generation. It authenticates with the function's own service account,
 * so there is no second API key anywhere in this project.
 */
export const generateRecipeImage = async (draft: RecipeDraft): Promise<File> => {
  const call = httpsCallable<GenerateImageRequest, GenerateImageResponse>(
    functions,
    "generateRecipeImage",
    { timeout: CALL_TIMEOUT_MS }
  )
  const { data } = await call({ draft })
  if (!data?.data) throw new Error("The image service returned nothing. Try again.")
  const extension = data.mimeType === "image/jpeg" ? "jpg" : "png"
  return toImageFile(data.mimeType, data.data, `generated-recipe.${extension}`)
}
