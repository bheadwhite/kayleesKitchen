import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AiAssistant from "./AiAssistant"
import AiDraftProvider from "contexts/AiDraftProvider"
import RecipeProvider from "contexts/RecipeProvider"
import { AiDraftPresenter } from "presenters/AiDraftPresenter"
import { RecipePresenter } from "presenters/RecipePresenter"
import type { AssistantImage, AssistantResponse } from "@/ai/types"
import type { RecipeDraft } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const DRAFT: RecipeDraft = {
  title: "Won Ton Salad",
  ingredients: [
    { name: "cabbage", amount: "1 head", optional: false, unique: false },
    { name: "wonton strips", amount: "1 cup", optional: false, unique: true },
  ],
  directions: [
    { sectionTitle: "Salad", steps: ["Chop the cabbage.", "Toss."] },
    { sectionTitle: "Dressing", steps: ["Whisk."] },
  ],
}

const encodeImage = vi.fn(async (): Promise<AssistantImage> => ({
  mediaType: "image/png",
  data: "",
}))

const setup = (response: AssistantResponse) => {
  const recipe = new RecipePresenter()
  const assistant = new AiDraftPresenter(vi.fn().mockResolvedValue(response), encodeImage)

  render(
    <RecipeProvider presenter={recipe}>
      <AiDraftProvider presenter={assistant}>
        <AiAssistant />
      </AiDraftProvider>
    </RecipeProvider>
  )

  return { recipe, assistant }
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x")
  URL.revokeObjectURL = vi.fn()
})

describe("AiAssistant", () => {
  it("summarises a proposed draft without touching the editor", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the recipe assistant"), "type this up")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("Won Ton Salad")).toBeInTheDocument()
    expect(screen.getByText("2 sections, 3 steps")).toBeInTheDocument()

    // The whole point of review-then-apply: nothing has moved yet.
    expect(recipe.getTitle()).toBe("")
    expect(recipe.getIngredients()).toEqual([])

    assistant.dispose()
    recipe.dispose()
  })

  it("applies the draft to the editor on request", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the recipe assistant"), "go")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

    expect(recipe.getTitle()).toBe("Won Ton Salad")
    expect(recipe.getIngredients()).toHaveLength(2)
    expect(recipe.getDirections()).toHaveLength(2)
    // Applying consumes the proposal.
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("discards a draft without applying it", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the recipe assistant"), "go")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Discard" }))

    expect(recipe.getTitle()).toBe("")
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("keeps the recipe's existing id when applying", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Doubled.", draft: DRAFT })
    recipe.loadRecipe({ id: "abc123", title: "Old", ingredients: [], directions: [] })

    await user.type(screen.getByLabelText("Message the recipe assistant"), "double it")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

    // Losing the id would turn the next save into a brand-new recipe.
    expect(recipe.getId()).toBe("abc123")
    expect(recipe.getTitle()).toBe("Won Ton Salad")

    assistant.dispose()
    recipe.dispose()
  })

  it("offers nothing to apply on a conversational reply", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "About a week.", draft: null })

    await user.type(screen.getByLabelText("Message the recipe assistant"), "how long?")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("About a week.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("will not send an empty message", () => {
    const { recipe, assistant } = setup({ text: "", draft: null })

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()

    assistant.dispose()
    recipe.dispose()
  })
})
