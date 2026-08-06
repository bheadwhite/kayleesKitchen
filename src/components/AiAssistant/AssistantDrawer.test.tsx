import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AssistantDrawer from "./AssistantDrawer"
import AiDraftProvider from "contexts/AiDraftProvider"
import RecipeProvider from "contexts/RecipeProvider"
import { AiDraftPresenter } from "presenters/AiDraftPresenter"
import { RecipePresenter } from "presenters/RecipePresenter"
import type { AssistantImage } from "@/ai/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const encodeImage = vi.fn(async (): Promise<AssistantImage> => ({
  mediaType: "image/png",
  data: "",
}))

const setup = () => {
  const recipe = new RecipePresenter()
  const assistant = new AiDraftPresenter(
    vi.fn().mockResolvedValue({ text: "Here you go.", draft: null }),
    encodeImage
  )

  render(
    <RecipeProvider presenter={recipe}>
      <AiDraftProvider presenter={assistant}>
        <AssistantDrawer />
      </AiDraftProvider>
    </RecipeProvider>
  )

  return { recipe, assistant }
}

/**
 * `aria-hidden` keeps the closed panel out of the accessibility tree entirely,
 * so a role query is exactly the right test for "is it there for the user".
 */
const openPanel = () => screen.queryByRole("dialog", { name: "Chef" })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x")
  URL.revokeObjectURL = vi.fn()
})

describe("AssistantDrawer", () => {
  it("starts closed, behind a launcher", () => {
    setup()

    expect(screen.getByRole("button", { name: "Open the chef" })).toBeVisible()
    expect(openPanel()).toBeNull()
  })

  it("opens and closes", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole("button", { name: "Open the chef" }))
    expect(openPanel()).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close chef" }))
    expect(openPanel()).toBeNull()
  })

  it("keeps a half-typed message while it is closed", async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole("button", { name: "Open the chef" }))
    await user.type(screen.getByLabelText("Message the chef"), "double everything")
    await user.click(screen.getByRole("button", { name: "Close chef" }))
    await user.click(screen.getByRole("button", { name: "Open the chef" }))

    // The panel is slid away rather than unmounted: closing it must not be a
    // way to lose what you were typing.
    expect(screen.getByLabelText("Message the chef")).toHaveValue(
      "double everything"
    )
  })

  it("says on the launcher when a draft is waiting to be applied", async () => {
    const user = userEvent.setup()
    setup()

    const launcher = screen.getByRole("button", { name: "Open the chef" })
    expect(launcher).not.toHaveTextContent("1")

    await user.click(launcher)
    await user.type(screen.getByLabelText("Message the chef"), "a chicken thing")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await user.click(screen.getByRole("button", { name: "Close chef" }))

    // Nothing else can report it with the panel shut.
    expect(await screen.findByRole("button", { name: "Open the chef" })).toBeVisible()
  })
})
