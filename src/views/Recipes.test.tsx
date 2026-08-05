import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import Recipes from "./Recipes"
import type { Recipe } from "@/types"

const RECIPES: Recipe[] = [
  {
    id: "carbonara",
    title: "Carbonara salad",
    contributor: "Lauren Tarver",
    ingredients: [{ name: "Farfalle pasta", amount: "6oz" }],
    directions: [{ sectionTitle: "", steps: ["Mix it all together"] }],
  },
  {
    id: "won-ton",
    title: "Won Ton Salad",
    contributor: "Lisa Tarver",
    ingredients: [],
    directions: [],
  },
]

vi.mock("fire/services", () => ({
  onRecipesSnapshot: (callback: (recipes: Recipe[]) => void) => {
    callback(RECIPES)
    return () => {}
  },
}))

/** jsdom never scrolls, so drive `scrollY` by hand. */
const setScrollY = (value: number) =>
  Object.defineProperty(window, "scrollY", { value, configurable: true })

describe("Recipes", () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear()
    setScrollY(0)
  })

  it("swaps the list for the recipe instead of appending below it", async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    const table = screen.getByRole("table")
    expect(table).toBeVisible()

    await user.click(screen.getByText("Carbonara salad"))

    // The recipe is shown...
    expect(screen.getByRole("heading", { name: "Carbonara salad" })).toBeInTheDocument()
    expect(screen.getByText("Farfalle pasta")).toBeInTheDocument()
    // ...and the list is out of the way rather than sitting above it.
    expect(table.closest("div.hidden")).not.toBeNull()
  })

  it("goes back to the full list", async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    await user.click(screen.getByText("Carbonara salad"))
    await user.click(screen.getByRole("button", { name: /all recipes/i }))

    expect(screen.queryByRole("heading", { name: "Carbonara salad" })).not.toBeInTheDocument()
    expect(screen.getByRole("table").closest("div.hidden")).toBeNull()
  })

  it("keeps the filter text when returning from a recipe", async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    const filter = screen.getByLabelText("Filter recipes")
    await user.type(filter, "carbonara")
    expect(screen.queryByText("Won Ton Salad")).not.toBeInTheDocument()

    await user.click(screen.getByText("Carbonara salad"))
    await user.click(screen.getByRole("button", { name: /all recipes/i }))

    expect(screen.getByLabelText("Filter recipes")).toHaveValue("carbonara")
    expect(screen.queryByText("Won Ton Salad")).not.toBeInTheDocument()
  })

  it("opens a recipe at the top and returns to where the list was scrolled", async () => {
    const user = userEvent.setup()
    render(<Recipes />)

    setScrollY(420)
    await user.click(screen.getByText("Carbonara salad"))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 })

    // The recipe view scrolled the window back to 0; going back must not
    // restore *that* offset, but the list's.
    setScrollY(0)
    await user.click(screen.getByRole("button", { name: /all recipes/i }))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 420 })
  })
})
