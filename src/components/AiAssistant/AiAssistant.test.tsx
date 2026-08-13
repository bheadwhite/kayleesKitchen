import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AiAssistant from "./AiAssistant"
import AiDraftProvider from "contexts/AiDraftProvider"
import RecipeProvider from "contexts/RecipeProvider"
import { AiDraftPresenter } from "presenters/AiDraftPresenter"
import { RecipePresenter } from "presenters/RecipePresenter"
import type { AssistantImage, AssistantResponse } from "@/ai/types"
import type { EditorDraft } from "@/ai/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const DRAFT: EditorDraft = {
  title: "Won Ton Salad",
  ingredients: [
    { name: "cabbage", amount: "1 head", optional: false, unique: false },
    { name: "wonton strips", amount: "1 cup", optional: false, unique: true },
  ],
  directions: [
    { sectionTitle: "Salad", steps: ["Chop the cabbage.", "Toss."] },
    { sectionTitle: "Dressing", steps: ["Whisk."] },
  ],
  tags: ["salad"],
  serves: 4,
  servingSize: "1 bowl",
}

const encodeImage = vi.fn(async (): Promise<AssistantImage> => ({
  mediaType: "image/png",
  data: "",
}))

const setup = (response: AssistantResponse, tagLibrary: string[] = []) => {
  const recipe = new RecipePresenter()
  const ask = vi.fn().mockResolvedValue(response)
  const assistant = new AiDraftPresenter(ask, encodeImage)

  render(
    <RecipeProvider presenter={recipe}>
      <AiDraftProvider presenter={assistant}>
        <AiAssistant tagLibrary={tagLibrary} />
      </AiDraftProvider>
    </RecipeProvider>
  )

  return { recipe, assistant, ask }
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x")
  URL.revokeObjectURL = vi.fn()
})

describe("AiAssistant", () => {
  it("summarises a proposed draft without touching the editor", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the chef"), "type this up")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("Won Ton Salad")).toBeInTheDocument()
    // Against an empty editor everything in the draft is new — and the summary
    // counts what would *change*, not what the draft happens to contain.
    expect(screen.getByText("A different title")).toBeInTheDocument()
    expect(screen.getByText("Ingredients: 2 new")).toBeInTheDocument()
    expect(screen.getByText("Steps: 3 new")).toBeInTheDocument()
    expect(screen.getByText("Sections: 2 new")).toBeInTheDocument()

    // The whole point of review-then-apply: nothing has moved yet.
    expect(recipe.getTitle()).toBe("")
    expect(recipe.getIngredients()).toEqual([])

    assistant.dispose()
    recipe.dispose()
  })

  it("applies the draft to the editor on request", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the chef"), "go")
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

  it("summarises a draft as the difference from the recipe already in the editor", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Doubled the dressing.", draft: DRAFT })
    recipe.loadRecipe({
      id: "abc123",
      title: "Won Ton Salad",
      ingredients: [
        { name: "cabbage", amount: "1 head" },
        { name: "wonton strips", amount: "1/2 cup" },
      ],
      directions: [
        { sectionTitle: "Salad", steps: ["Chop the cabbage.", "Toss."] },
        { sectionTitle: "Dressing", steps: ["Whisk."] },
      ],
    })

    await user.type(screen.getByLabelText("Message the chef"), "double the strips")
    await user.click(screen.getByRole("button", { name: "Send" }))

    // Only the one amount actually moved. A count of the draft's contents would
    // have reported "2 ingredients" either way.
    expect(await screen.findByText("Ingredients: 1 changed")).toBeInTheDocument()
    expect(screen.queryByText("A different title")).toBeNull()
    expect(screen.queryByText(/Steps:/)).toBeNull()

    assistant.dispose()
    recipe.dispose()
  })

  it("says when a draft would change nothing", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Already how you have it.", draft: DRAFT })
    recipe.loadRecipe({ id: "abc123", ...DRAFT, serves: DRAFT.serves ?? undefined, servingSize: DRAFT.servingSize ?? undefined })

    await user.type(screen.getByLabelText("Message the chef"), "tidy it up")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("Nothing in the editor would change.")).toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("tells the drawer to get out of the way once a draft is applied", async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn()
    const recipe = new RecipePresenter()
    const assistant = new AiDraftPresenter(
      vi.fn().mockResolvedValue({ text: "Here's a draft.", draft: DRAFT }),
      encodeImage
    )

    render(
      <RecipeProvider presenter={recipe}>
        <AiDraftProvider presenter={assistant}>
          <AiAssistant onApplied={onApplied} />
        </AiDraftProvider>
      </RecipeProvider>
    )

    await user.type(screen.getByLabelText("Message the chef"), "go")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

    // The reason to apply is to look at what it did, and the marked-up editor
    // is behind the panel.
    expect(onApplied).toHaveBeenCalled()

    assistant.dispose()
    recipe.dispose()
  })

  it("discards a draft without applying it", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Here's a draft.", draft: DRAFT })

    await user.type(screen.getByLabelText("Message the chef"), "go")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Discard" }))

    expect(recipe.getTitle()).toBe("")
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  /**
   * "No, not this — something else." The proposal never enters the transcript
   * as a recipe, so turning one down has to leave a record of the dish or the
   * chef will cheerfully offer it again two turns later.
   */
  it("turns an idea down and asks the chef for a different one", async () => {
    const user = userEvent.setup()
    const recipe = new RecipePresenter()
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "Here's a draft.", draft: DRAFT })
      .mockResolvedValueOnce({ text: "A chowder, then.", draft: null })
    const assistant = new AiDraftPresenter(ask, encodeImage)

    render(
      <RecipeProvider presenter={recipe}>
        <AiDraftProvider presenter={assistant}>
          <AiAssistant recipeTitles={["Beef Stew"]} />
        </AiDraftProvider>
      </RecipeProvider>
    )

    await user.type(screen.getByLabelText("Message the chef"), "something for tonight")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(await screen.findByRole("button", { name: "Something else" }))

    // Nothing reached the editor, and the refused proposal is off the screen.
    expect(recipe.getTitle()).toBe("")
    expect(screen.queryByRole("button", { name: "Apply to editor" })).not.toBeInTheDocument()

    // Both things the chef has to avoid: the dish just refused, and the box.
    expect(ask.mock.calls[1][0].rejected).toEqual(["Won Ton Salad"])
    expect(ask.mock.calls[1][0].recipeTitles).toEqual(["Beef Stew"])

    // And the cook can see the constraint now shaping every later suggestion.
    expect(await screen.findByText(/Turned down: Won Ton Salad/)).toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("asks inside the categories picked from the household's tags", async () => {
    const user = userEvent.setup()
    const recipe = new RecipePresenter()
    const ask = vi.fn().mockResolvedValue({ text: "Here's a draft.", draft: DRAFT })
    const assistant = new AiDraftPresenter(ask, encodeImage)

    render(
      <RecipeProvider presenter={recipe}>
        <AiDraftProvider presenter={assistant}>
          <AiAssistant tagLibrary={["mexican", "weeknight"]} />
        </AiDraftProvider>
      </RecipeProvider>
    )

    await user.click(screen.getByRole("button", { name: "Ask for mexican" }))
    await user.type(screen.getByLabelText("Message the chef"), "give me an idea")
    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(ask.mock.calls[0][0].categories).toEqual(["mexican"])
    // A picked chip is the way back off it, so the baseline is never a state
    // you can get into and not out of.
    expect(
      await screen.findByRole("button", { name: "Stop asking for mexican" })
    ).toBeInTheDocument()

    assistant.dispose()
    recipe.dispose()
  })

  it("keeps the recipe's existing id when applying", async () => {
    const user = userEvent.setup()
    const { recipe, assistant } = setup({ text: "Doubled.", draft: DRAFT })
    recipe.loadRecipe({ id: "abc123", title: "Old", ingredients: [], directions: [] })

    await user.type(screen.getByLabelText("Message the chef"), "double it")
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

    await user.type(screen.getByLabelText("Message the chef"), "how long?")
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

  /**
   * Tagging is the change most likely to be accepted without being read — it is
   * two words at the bottom of a draft that is mostly ingredients — so it has to
   * be visible in the summary and impossible to lose by accident.
   */
  describe("tags", () => {
    const send = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText("Message the chef"), "tidy this up")
      await user.click(screen.getByRole("button", { name: "Send" }))
    }

    it("shows the chef what the recipe already carries, and the household's list", async () => {
      const user = userEvent.setup()
      const { recipe, assistant, ask } = setup({ text: "Done.", draft: DRAFT }, [
        "salad",
        "weeknight",
      ])
      recipe.addTag("lunch")

      await send(user)

      expect(ask.mock.calls[0][0].currentDraft.tags).toEqual(["lunch"])
      // The vocabulary, so it reuses a tag rather than coining a near-duplicate.
      expect(ask.mock.calls[0][0].tagLibrary).toEqual(["salad", "weeknight"])

      assistant.dispose()
      recipe.dispose()
    })

    it("counts a proposed tag in the summary", async () => {
      const user = userEvent.setup()
      const { recipe, assistant } = setup({ text: "Tagged it.", draft: DRAFT })
      recipe.loadRecipe({ id: "abc123", ...DRAFT, tags: [], serves: DRAFT.serves ?? undefined, servingSize: DRAFT.servingSize ?? undefined })

      await send(user)

      expect(await screen.findByText("Tags: 1 added")).toBeInTheDocument()

      assistant.dispose()
      recipe.dispose()
    })

    it("applies the tags the chef proposed", async () => {
      const user = userEvent.setup()
      const { recipe, assistant } = setup({ text: "Tagged it.", draft: DRAFT })

      await send(user)
      await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

      expect(recipe.getTags()).toEqual(["salad"])

      assistant.dispose()
      recipe.dispose()
    })

    it("never strips the recipe's tags for a draft that carries none", async () => {
      const user = userEvent.setup()
      // `propose_recipe` is strict, so this should not happen — but applying is
      // wholesale, and losing somebody's tags to a missing field is not a
      // failure worth being exposed to.
      const { tags: _dropped, ...untagged } = DRAFT
      const { recipe, assistant } = setup({
        text: "Done.",
        draft: untagged as typeof DRAFT,
      })
      recipe.addTag("lunch")

      await send(user)
      await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

      expect(recipe.getTags()).toEqual(["lunch"])

      assistant.dispose()
      recipe.dispose()
    })
  })

  /**
   * The yield is what the shopping list scales from and the servings control
   * counts from, so a wrong one is expensive — which is why the chef may answer
   * null, and why what is already in the editor is sent to it.
   */
  describe("how much it makes", () => {
    const send = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText("Message the chef"), "type this up")
      await user.click(screen.getByRole("button", { name: "Send" }))
    }

    it("shows the chef what the editor already claims", async () => {
      const user = userEvent.setup()
      const { recipe, assistant, ask } = setup({ text: "Done.", draft: DRAFT })
      recipe.setServes(6)
      recipe.setServingSize("1 bowl")

      await send(user)

      expect(ask.mock.calls[0][0].currentDraft).toMatchObject({
        serves: 6,
        servingSize: "1 bowl",
      })

      assistant.dispose()
      recipe.dispose()
    })

    it("counts a changed yield in the summary", async () => {
      const user = userEvent.setup()
      const { recipe, assistant } = setup({ text: "Read it off.", draft: DRAFT })
      recipe.loadRecipe({ id: "abc123", ...DRAFT, serves: undefined, servingSize: undefined })

      await send(user)

      expect(await screen.findByText("How much it makes")).toBeInTheDocument()

      assistant.dispose()
      recipe.dispose()
    })

    it("applies what the chef read off the recipe", async () => {
      const user = userEvent.setup()
      const { recipe, assistant } = setup({ text: "Read it off.", draft: DRAFT })

      await send(user)
      await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

      expect(recipe.getServes()).toBe(4)
      expect(recipe.getServingSize()).toBe("1 bowl")

      assistant.dispose()
      recipe.dispose()
    })

    it("keeps what the editor had when the chef will not say", async () => {
      const user = userEvent.setup()
      // Null is a real answer: a recipe giving no way to tell should come back
      // empty rather than with an invented number.
      const { recipe, assistant } = setup({
        text: "Could not tell.",
        draft: { ...DRAFT, serves: null, servingSize: null },
      })
      recipe.setServes(6)

      await send(user)
      await user.click(await screen.findByRole("button", { name: "Apply to editor" }))

      expect(recipe.getServes()).toBe(6)

      assistant.dispose()
      recipe.dispose()
    })
  })
})
