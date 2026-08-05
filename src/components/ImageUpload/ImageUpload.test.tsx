import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Form } from "react-final-form"
import { describe, expect, it, vi } from "vitest"

import ImageUpload from "./ImageUpload"
import RecipeProvider from "contexts/RecipeProvider"
import { RecipePresenter } from "presenters/RecipePresenter"

vi.mock("fire/firebase", () => ({ functions: {}, storage: {} }))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

// The component only needs the signed-in user's email for the upload path.
vi.mock("contexts/AuthProvider", () => ({
  useSessionUser: () => ({ uid: "u1", email: "cook@example.test", displayName: "Cook" }),
}))

const uploadRecipeEditorImage = vi.fn().mockResolvedValue("https://example.test/generated.png")
vi.mock("fire/services", () => ({
  uploadRecipeEditorImage: (...args: unknown[]) => uploadRecipeEditorImage(...args),
}))

const generateRecipeImage = vi.fn()
vi.mock("@/ai/recipeImage", () => ({
  generateRecipeImage: (...args: unknown[]) => generateRecipeImage(...args),
}))

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

  it("uploads the generated image down the same path as a picked file", async () => {
    const user = userEvent.setup()
    const file = new File(["png"], "generated-recipe.png", { type: "image/png" })
    generateRecipeImage.mockResolvedValue(file)

    const presenter = setup((p) => p.setTitle("Won Ton Salad"))

    await user.click(screen.getByRole("button", { name: "Generate" }))

    await waitFor(() =>
      expect(uploadRecipeEditorImage).toHaveBeenCalledWith(file, "cook@example.test")
    )
    expect(generateRecipeImage).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Won Ton Salad" })
    )
    await waitFor(() =>
      expect(presenter.getImageUrl()).toBe("https://example.test/generated.png")
    )

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
})
