import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { AssistantImage, AssistantRequest, AssistantResponse, ImageMediaType } from "./types"

const SUPPORTED: ImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"]

/**
 * Claude's per-image cap is generous, but the callable payload is not — keep a
 * single request comfortably under the Cloud Functions request limit.
 */
export const MAX_IMAGES = 8
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const isSupportedImage = (file: File): boolean =>
  SUPPORTED.includes(file.type as ImageMediaType)

/**
 * Reads a File into the base64 shape the callable expects. `FileReader` hands
 * back a `data:` URL; the API wants the payload alone.
 */
export const toAssistantImage = (file: File): Promise<AssistantImage> => {
  if (!isSupportedImage(file)) {
    return Promise.reject(new Error(`${file.name} is not a JPEG, PNG, GIF, or WebP.`))
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error(`${file.name} is larger than 3MB.`))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(",")
      if (comma === -1) {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      resolve({ mediaType: file.type as ImageMediaType, data: result.slice(comma + 1) })
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Calls the `recipeAssistant` Cloud Function. The Anthropic key lives there and
 * never reaches the browser; the callable rejects unauthenticated requests.
 */
export const askRecipeAssistant = async (
  request: AssistantRequest
): Promise<AssistantResponse> => {
  const call = httpsCallable<AssistantRequest, AssistantResponse>(functions, "recipeAssistant")
  const { data } = await call(request)
  return data
}
