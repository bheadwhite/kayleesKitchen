import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ChefBanner from "./ChefBanner"
import ChefProvider from "contexts/ChefProvider"
import { ChefPresenter } from "presenters/ChefPresenter"
import type { ChefFork, Recipe } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("fire/services", () => ({
  onRecipeVariantsSnapshot: vi.fn(() => () => {}),
  onRecipeYieldSnapshot: vi.fn(() => () => {}),
  saveRecipeVariant: vi.fn().mockResolvedValue(undefined),
  deleteRecipeVariant: vi.fn().mockResolvedValue(undefined),
}))

const CARBONARA: Recipe = {
  id: "carbonara",
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "6oz" }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta."] }],
}

const DOUBLED: ChefFork = {
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "12oz", optional: false, unique: false }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta in a wide pot."] }],
  serves: 8,
  baseServes: 4,
  summary: "Doubled. Use a wider pot so it does not steam.",
  label: "Feeds 8",
}

const setup = async (showingOriginal = false) => {
  const chef = new ChefPresenter(
    vi.fn().mockResolvedValue({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
  )
  chef.openFor(CARBONARA)
  await chef.send("double it")

  const onToggleOriginal = vi.fn()
  const onOpenChef = vi.fn()
  render(
    <ChefProvider presenter={chef}>
      <ChefBanner
        showingOriginal={showingOriginal}
        onToggleOriginal={onToggleOriginal}
        onOpenChef={onOpenChef}
      />
    </ChefProvider>
  )
  return { chef, onToggleOriginal, onOpenChef }
}

beforeEach(() => {
  sessionStorage.clear()
})

describe("ChefBanner", () => {
  it("shows nothing until there is a copy to say something about", () => {
    const chef = new ChefPresenter(vi.fn())
    chef.openFor(CARBONARA)
    render(
      <ChefProvider presenter={chef}>
        <ChefBanner showingOriginal={false} onToggleOriginal={vi.fn()} onOpenChef={vi.fn()} />
      </ChefProvider>
    )

    expect(screen.queryByText("The chef's copy")).toBeNull()
  })

  it("names the copy, its yield, and the way back", async () => {
    await setup()

    // Twice by design — the card and the compact bar that replaces it on
    // scroll. The bar is hidden, so only the card's controls are reachable.
    expect(screen.getAllByText("The chef's copy")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Change how many this feeds" })).toHaveTextContent(
      "Feeds 8"
    )
    expect(screen.getByRole("button", { name: "Show original" })).toBeVisible()
    expect(screen.getByText(/Use a wider pot/)).toBeInTheDocument()
  })

  it("offers each control once while the compact bar is out of the way", async () => {
    await setup()

    // The bar is rendered but hidden — it has to be laid out for the scroll
    // measurement to read its position — and `visibility: hidden` is what keeps
    // its duplicate controls out of the accessibility tree and the tab order.
    expect(screen.getAllByRole("button", { name: "Change how many this feeds" })).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "Show original" })).toHaveLength(1)
  })

  it("reports the filed recipe's own yield while showing the original", async () => {
    await setup(true)

    expect(screen.getAllByText("The recipe as filed")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Change how many this feeds" })).toHaveTextContent(
      "Feeds 4"
    )
    expect(screen.getByRole("button", { name: "Back to the copy" })).toBeVisible()
  })

  it("keeps the summary when flipping to the original, so nothing below moves", async () => {
    await setup(true)

    // "Show original" is reachable from the compact bar halfway down the
    // recipe. Dropping four lines out of a card above you would shunt the step
    // you were reading up the screen.
    expect(screen.getByText(/Use a wider pot/)).toBeInTheDocument()
  })

  it("sends the yield to the panel that owns the stepper", async () => {
    const user = userEvent.setup()
    const { onOpenChef } = await setup()

    await user.click(screen.getByRole("button", { name: "Change how many this feeds" }))

    expect(onOpenChef).toHaveBeenCalled()
  })
})
