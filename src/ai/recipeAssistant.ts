import { httpsCallable } from "firebase/functions"

import { functions } from "fire/firebase"
import type { AssistantImage, AssistantRequest, AssistantResponse, ImageMediaType } from "./types"

/**
 * Claude's per-image cap is generous, but the callable payload is not — keep a
 * single request comfortably under the Cloud Functions request limit.
 */
export const MAX_IMAGES = 8

/**
 * The longest edge Claude can actually use. Anything larger is downscaled to
 * this on Anthropic's side before the model ever sees it, so sending a 4032px
 * iPhone photo buys nothing and costs upload time on a phone's connection.
 *
 * 2576px is the high-resolution tier the models this app calls sit in; older
 * models capped at 1568px. Do not raise it without checking what the model in
 * `functions/src/index.ts` actually supports.
 */
const MAX_EDGE = 2576

/**
 * Re-encode quality. A recipe card is text on paper — the thing that has to
 * survive is legibility of small print, and 0.82 keeps that while cutting a
 * 3MB photo to a few hundred KB.
 */
const JPEG_QUALITY = 0.82

/** Refuse to even decode something this large — it is not a photo. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024

/**
 * Backstop on the *encoded* result, per image. Eight of these plus the
 * transcript has to fit the callable's request limit, and base64 inflates by
 * a third on top.
 */
const MAX_ENCODED_BYTES = 4 * 1024 * 1024

const SUPPORTED: ImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"]

/**
 * Anything the browser will decode is fair game, because the downscale step
 * re-encodes to JPEG regardless of what went in. That is what makes an iPhone
 * HEIC work: Safari decodes it natively, and Claude never sees the HEIC.
 */
export const isSupportedImage = (file: File): boolean => file.type.startsWith("image/")

const isAlreadySendable = (file: File) =>
  SUPPORTED.includes(file.type as ImageMediaType) && file.size <= MAX_ENCODED_BYTES

/** Strips the `data:` prefix — the API wants the payload alone. */
const payloadOf = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(",")
  if (comma === -1) throw new Error("Unreadable image data.")
  return dataUrl.slice(comma + 1)
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })

/**
 * `imageOrientation: "from-image"` is the load-bearing option: phone photos
 * carry their rotation in EXIF rather than in the pixels, and a canvas draw
 * that ignores it hands the model a sideways recipe card.
 */
const decode = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" })
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`Could not read ${file.name}.`))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const sizeOf = (source: ImageBitmap | HTMLImageElement) => ({
  width: "naturalWidth" in source ? source.naturalWidth : source.width,
  height: "naturalHeight" in source ? source.naturalHeight : source.height,
})

/**
 * Downscales to {@link MAX_EDGE} and re-encodes as JPEG.
 *
 * Photos are never rejected for being large — a modern phone camera produces
 * 3–5MB files as a matter of course, and telling someone their own photo is
 * "too big" when the fix is a resize the browser can do in a few milliseconds
 * is not a real limitation. It only refuses what it cannot decode.
 */
const shrink = async (file: File): Promise<AssistantImage> => {
  const source = await decode(file)
  const { width, height } = sizeOf(source)
  if (width === 0 || height === 0) throw new Error(`Could not read ${file.name}.`)

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const context = canvas.getContext("2d")
  if (context == null) throw new Error(`Could not read ${file.name}.`)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ("close" in source) source.close()

  const data = payloadOf(canvas.toDataURL("image/jpeg", JPEG_QUALITY))
  return { mediaType: "image/jpeg", data }
}

/**
 * Reads a File into the base64 shape the callable expects, shrinking it first
 * when that helps.
 */
export const toAssistantImage = async (file: File): Promise<AssistantImage> => {
  if (!isSupportedImage(file)) {
    throw new Error(`${file.name} is not an image.`)
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} is too large to read.`)
  }

  try {
    const shrunk = await shrink(file)
    // base64 is 4 bytes per 3 — the check is on what actually goes over the wire.
    if (shrunk.data.length * 0.75 <= MAX_ENCODED_BYTES) return shrunk
  } catch (error) {
    // A browser without canvas encoding (or a format it will not decode) is
    // still fine as long as the original is something Claude accepts as-is.
    if (!isAlreadySendable(file)) throw error
  }

  if (!isAlreadySendable(file)) {
    throw new Error(`${file.name} is too large to send, even resized.`)
  }
  return { mediaType: file.type as ImageMediaType, data: payloadOf(await readAsDataUrl(file)) }
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
