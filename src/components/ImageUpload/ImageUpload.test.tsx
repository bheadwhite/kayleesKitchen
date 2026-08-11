import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ImageUpload from "./ImageUpload"
import RecipeProvider from "contexts/RecipeProvider"
import { RecipePresenter } from "presenters/RecipePresenter"

vi.mock("fire/firebase", () => ({ functions: {}, storage: {} }))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

// The component only needs the signed-in user's email for the upload path.
vi.mock("contexts/AuthProvider", () => ({
  useSessionUser: () => ({ uid: "u1", email: "cook@example.test", displayName: "Cook" }),
}))

const generateRecipeImage = vi.fn()
vi.mock("@/ai/recipeImage", () => ({
  generateRecipeImage: (...args: unknown[]) => generateRecipeImage(...args),
}))

const forgetCachedImage = vi.fn().mockResolvedValue(true)
vi.mock("@/pwa", () => ({
  forgetCachedImage: (...args: unknown[]) => forgetCachedImage(...args),
}))

// jsdom implements neither, and the staged preview is built from them.
let blobs = 0
const createObjectURL = vi.fn(() => `blob:test/${(blobs += 1)}`)
const revokeObjectURL = vi.fn()
URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL

const setup = (seed?: (presenter: RecipePresenter) => void) => {
  const presenter = new RecipePresenter()
  seed?.(presenter)

  render(
    <RecipeProvider presenter={presenter}>
      <Form onSubmit={() => {}}>{() => <ImageUpload />}</Form>
    </RecipeProvider>
  )

  return presenter
}

describe("ImageUpload — generate", () => {
  // Call history only; `clearAllMocks` leaves the implementations set above in
  // place, so counting calls in one test cannot be thrown off by an earlier one.
  beforeEach(() => vi.clearAllMocks())

  it("is disabled with nothing to picture", () => {
    const presenter = setup()

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled()

    presenter.dispose()
  })

  it("enables once the recipe has a title", () => {
    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled()

    presenter.dispose()
  })

  it("enables on ingredients alone", () => {
    const presenter = setup((p) =>
      p.addIngredient({ name: "cabbage", amount: "1 head", optional: false, unique: false })
    )

    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled()

    presenter.dispose()
  })

  it("previews the generated image from the file, sending it nowhere", async () => {
    const user = userEvent.setup()
    const file = new File(["png"], "generated-recipe.png", { type: "image/png" })
    generateRecipeImage.mockResolvedValue(file)

    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    await user.click(screen.getByRole("button", { name: "Generate" }))

    expect(generateRecipeImage).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Won Ton Salad" })
    )
    // The picture is already here. Uploading it to a scratch path and fetching
    // the same megabytes back — through a worker that caches opaque failures as
    // readily as photos — is the hop that used to say "Preview didn't load".
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(file))
    expect(presenter.getImageUrl()).toMatch(/^blob:/)
    expect(presenter.getImageFile()).toBe(file)

    presenter.dispose()
  })

  it("can generate again once an image already exists", async () => {
    const user = userEvent.setup()
    const first = new File(["one"], "generated-recipe.png", { type: "image/png" })
    const second = new File(["two"], "generated-recipe.png", { type: "image/png" })
    generateRecipeImage.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    await user.click(screen.getByRole("button", { name: "Generate" }))
    await waitFor(() => expect(presenter.getImageUrl()).toMatch(/^blob:/))
    const staged = presenter.getImageUrl()

    // Only the <img>'s onLoad clears the spinner, and jsdom never fires it on
    // its own. "Delete image" appearing is that spinner having cleared.
    fireEvent.load(screen.getByAltText("recipe preview"))
    expect(await screen.findByRole("button", { name: "Delete image" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Regenerate" }))

    // A different URL every time, with no cache-buster needed to make it one —
    // which is what made "Generate" appear to work exactly once per session.
    await waitFor(() => expect(presenter.getImageFile()).toBe(second))
    expect(presenter.getImageUrl()).not.toBe(staged)
    // The picture it replaced is released rather than held until the reload.
    expect(revokeObjectURL).toHaveBeenCalledWith(staged)

    presenter.dispose()
  })

  it("clears the spinner when generation fails", async () => {
    const user = userEvent.setup()
    generateRecipeImage.mockRejectedValue(new Error("model unavailable"))

    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    await user.click(screen.getByRole("button", { name: "Generate" }))

    // Otherwise the editor is stuck showing a spinner with no way back.
    await waitFor(() => expect(presenter.getImageUrl()).toBeNull())
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled()
    )

    presenter.dispose()
  })

  it("does not let a slow generation overwrite a photo picked after it", async () => {
    const user = userEvent.setup()
    const generated = new File(["gen"], "generated-recipe.png", { type: "image/png" })
    let finishGenerating: (file: File) => void = () => {}
    generateRecipeImage.mockReturnValue(
      new Promise<File>((resolve) => {
        finishGenerating = resolve
      })
    )

    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    await user.click(screen.getByRole("button", { name: "Generate" }))
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled()

    // The file picker is never disabled while a generation runs, so this is
    // reachable by anyone who gets bored waiting.
    const picked = new File(["pick"], "picked.png", { type: "image/png" })
    const input = document.getElementById("icon-button-file") as HTMLInputElement
    fireEvent.change(input, { target: { files: [picked] } })
    await waitFor(() => expect(presenter.getImageFile()).toBe(picked))
    const pickedUrl = presenter.getImageUrl()

    finishGenerating(generated)
    // "Regenerate" because the picked photo is now in place.
    await waitFor(() => expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled())

    // The pick is newer, so it owns the editor — and `imageFile` matters as much
    // as the URL, because that is the one "Save recipe" uploads.
    expect(presenter.getImageUrl()).toBe(pickedUrl)
    expect(presenter.getImageFile()).toBe(picked)
    // Once, for the pick. The superseded generation is dropped before it can
    // stage anything — the two files are indistinguishable by value here, so
    // the count is what says which one landed.
    expect(createObjectURL).toHaveBeenCalledTimes(1)

    presenter.dispose()
  })
})

/**
 * The last hop, and the one that used to fail in silence: the callable
 * succeeded, the upload succeeded, and then the picture either would not decode
 * or never resolved at all — and the editor showed an empty plate with no
 * message, or a spinner that never stopped.
 */
describe("ImageUpload — the preview itself", () => {
  const STAGED = "https://example.test/staged.png?staged=1"

  beforeEach(() => vi.clearAllMocks())

  const withImage = () =>
    setup((p) => {
      p.setImageUrl(STAGED)
      p.setRecipeImageIsLoading(true)
    })

  const preview = () => screen.getByAltText("recipe preview")

  it("evicts the cached copy and asks again when it will not decode", async () => {
    const presenter = withImage()

    fireEvent.error(preview())

    // A cached *opaque* 403 is indistinguishable from a picture to the worker,
    // so the page is the only thing that can tell it the copy is no good.
    expect(forgetCachedImage).toHaveBeenCalledWith(STAGED)
    await waitFor(() =>
      expect(preview()).toHaveAttribute("src", expect.stringContaining("retry=1"))
    )
    // The staged URL itself is untouched — an update writes that string.
    expect(presenter.getImageUrl()).toBe(STAGED)

    presenter.dispose()
  })

  it("says so, and keeps the photo, once the retry fails too", async () => {
    const file = new File(["png"], "generated-recipe.png", { type: "image/png" })
    const presenter = withImage()
    presenter.setImageFile(file)

    fireEvent.error(preview())
    await waitFor(() => expect(preview()).toHaveAttribute("src", expect.stringContaining("retry")))
    fireEvent.error(preview())

    expect(await screen.findByText(/preview didn't load/i)).toBeInTheDocument()
    expect(screen.getByText(/saving keeps it/i)).toBeInTheDocument()
    // Both of these used to go: the spinner stayed up, or the URL was nulled and
    // an update wrote `image: null` over a picture that was fine.
    expect(presenter.getImageUrl()).toBe(STAGED)
    expect(presenter.getImageFile()).toBe(file)
    expect(screen.queryByAltText("recipe preview")).not.toBeInTheDocument()

    presenter.dispose()
  })

  it("gives up on a request that never resolves either way", () => {
    vi.useFakeTimers()
    try {
      const presenter = withImage()

      // Only `onLoad` clears the spinner, so without a deadline a stalled
      // fetch spins until the editor is abandoned.
      act(() => {
        vi.advanceTimersByTime(31_000)
      })
      expect(preview()).toHaveAttribute("src", expect.stringContaining("retry=1"))

      act(() => {
        vi.advanceTimersByTime(31_000)
      })
      expect(screen.getByText(/preview didn't load/i)).toBeInTheDocument()

      presenter.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not retry a staged photo, which is not fetched from anywhere", async () => {
    const file = new File(["png"], "generated-recipe.png", { type: "image/png" })
    const presenter = setup((p) => {
      p.setImageUrl("blob:test/staged")
      p.setRecipeImageIsLoading(true)
    })
    presenter.setImageFile(file)

    fireEvent.error(preview())

    // There is no cached copy to evict and nothing to ask again — a query
    // parameter on a blob URL names nothing, so the "retry" would be a second
    // guaranteed failure. It says so once and keeps the photo.
    expect(forgetCachedImage).not.toHaveBeenCalled()
    expect(await screen.findByText(/preview didn't load/i)).toBeInTheDocument()
    expect(presenter.getImageFile()).toBe(file)

    presenter.dispose()
  })

  it("stops the spinner and says nothing at all when it does load", async () => {
    const presenter = withImage()

    fireEvent.load(preview())

    expect(await screen.findByRole("button", { name: "Delete image" })).toBeInTheDocument()
    expect(screen.queryByText(/preview didn't load/i)).not.toBeInTheDocument()

    presenter.dispose()
  })
})
