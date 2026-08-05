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

/** Turns the callable's base64 payload into the same `File` a picker would give. */
export const toImageFile = (mimeType: string, base64: string, name: string): File => {
  const binary = atob(base64)
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
    "generateRecipeImage"
  )
  const { data } = await call({ draft })
  const extension = data.mimeType === "image/jpeg" ? "jpg" : "png"
  return toImageFile(data.mimeType, data.data, `generated-recipe.${extension}`)
}
