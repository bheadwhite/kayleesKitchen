import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isSupportedImage, toAssistantImage } from "./recipeAssistant"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }))

/**
 * jsdom implements neither `createImageBitmap` nor canvas encoding, so both are
 * stubbed. The stubs record the size the canvas was set to, which is the thing
 * actually under test — that a 12-megapixel phone photo comes out at the edge
 * Claude can use rather than being refused.
 */
const drawnSizes: { width: number; height: number }[] = []
let encodedBytes = 90_000

const file = (name: string, type: string, size: number) => {
  const image = new File(["x"], name, { type })
  Object.defineProperty(image, "size", { value: size })
  return image
}

/** A base64 data URL whose payload decodes to roughly `bytes`. */
const dataUrl = (bytes: number) => `data:image/jpeg;base64,${"A".repeat(Math.ceil(bytes / 0.75))}`

beforeEach(() => {
  drawnSizes.length = 0
  encodedBytes = 90_000

  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4032, height: 3024, close() {} })))

  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") throw new Error(`unexpected createElement(${tag})`)
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => drawnSizes.push({ width: canvas.width, height: canvas.height }),
      }),
      toDataURL: () => dataUrl(encodedBytes),
    }
    return canvas as unknown as HTMLElement
  }) as typeof document.createElement)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("isSupportedImage", () => {
  it("accepts anything the browser might decode, including HEIC", () => {
    // iPhones shoot HEIC by default. It is never sent as HEIC — the resize step
    // re-encodes to JPEG — so gating the picker on Claude's formats would
    // reject photos that work perfectly well.
    expect(isSupportedImage(file("IMG_0001.HEIC", "image/heic", 2_000_000))).toBe(true)
    expect(isSupportedImage(file("card.jpg", "image/jpeg", 100))).toBe(true)
    expect(isSupportedImage(file("recipe.pdf", "application/pdf", 100))).toBe(false)
  })
})

describe("toAssistantImage", () => {
  it("resizes a phone photo instead of rejecting it", async () => {
    // 3MB, 4032x3024 — an ordinary iPhone photo, and exactly what the old 3MB
    // cap turned away.
    const image = await toAssistantImage(file("IMG_0002.jpg", "image/jpeg", 3 * 1024 * 1024))

    expect(image.mediaType).toBe("image/jpeg")
    expect(image.data.length).toBeGreaterThan(0)
    // Long edge lands on Claude's ceiling; the aspect ratio survives.
    expect(drawnSizes).toEqual([{ width: 2576, height: 1932 }])
  })

  it("does not upscale an image that is already small", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 800, height: 600, close() {} })))

    await toAssistantImage(file("small.png", "image/png", 40_000))

    expect(drawnSizes).toEqual([{ width: 800, height: 600 }])
  })

  it("converts a format Claude does not take into one it does", async () => {
    const image = await toAssistantImage(file("IMG_0003.HEIC", "image/heic", 2_400_000))
    expect(image.mediaType).toBe("image/jpeg")
  })

  it("falls back to the original bytes when the browser cannot encode", async () => {
    // Some browser without canvas encoding: a JPEG small enough to send as-is
    // should still go, rather than failing over a resize it did not need.
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("no decoder")
    }))

    const image = await toAssistantImage(file("card.jpg", "image/jpeg", 200_000))
    expect(image.mediaType).toBe("image/jpeg")
  })

  it("reports the file that could not be read, by name", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => {
      throw new Error("no decoder")
    }))

    // Not a format Claude accepts, and not encodable here — nothing to send.
    await expect(toAssistantImage(file("odd.heic", "image/heic", 200_000))).rejects.toThrow(
      "no decoder"
    )
  })

  it("rejects a file too large to be a photo at all", async () => {
    await expect(
      toAssistantImage(file("huge.jpg", "image/jpeg", 50 * 1024 * 1024))
    ).rejects.toThrow(/too large to read/)
  })

  it("rejects a non-image outright", async () => {
    await expect(toAssistantImage(file("recipe.pdf", "application/pdf", 1000))).rejects.toThrow(
      /not an image/
    )
  })
})
