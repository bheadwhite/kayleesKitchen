import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
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

/** <Recipes> reads `?open=` and `?cook=` off the URL, so it needs a router. */
const renderRecipes = (path = "/recipes") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Recipes />
    </MemoryRouter>
  )

describe("Recipes", () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear()
    setScrollY(0)
  })

  it("swaps the list for the recipe instead of appending below it", async () => {
    const user = userEvent.setup()
    renderRecipes()

    const list = screen.getByRole("list")
    expect(list).toBeVisible()

    await user.click(screen.getByText("Carbonara salad"))

    // The recipe is shown...
    expect(screen.getByRole("heading", { name: "Carbonara salad" })).toBeInTheDocument()
    expect(screen.getByText("Farfalle pasta")).toBeInTheDocument()
    // ...and the list is out of the way rather than sitting above it.
    expect(list.closest("div.hidden")).not.toBeNull()
  })

  it("goes back to the full list", async () => {
    const user = userEvent.setup()
    renderRecipes()

    await user.click(screen.getByText("Carbonara salad"))
    await user.click(screen.getByRole("button", { name: /all recipes/i }))

    expect(screen.queryByRole("heading", { name: "Carbonara salad" })).not.toBeInTheDocument()
    expect(screen.getByRole("list").closest("div.hidden")).toBeNull()
  })

  it("keeps the filter text when returning from a recipe", async () => {
    const user = userEvent.setup()
    renderRecipes()

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
    renderRecipes()

    setScrollY(420)
    await user.click(screen.getByText("Carbonara salad"))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 })

    // The recipe view scrolled the window back to 0; going back must not
    // restore *that* offset, but the list's.
    setScrollY(0)
    await user.click(screen.getByRole("button", { name: /all recipes/i }))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 420 })
  })

  it("opens the recipe named by ?open=, which <Profile> links to", async () => {
    renderRecipes("/recipes?open=won-ton")

    expect(await screen.findByRole("heading", { name: "Won Ton Salad" })).toBeInTheDocument()
  })

  it("does not reopen that recipe after you press back", async () => {
    const user = userEvent.setup()
    renderRecipes("/recipes?open=won-ton")

    await screen.findByRole("heading", { name: "Won Ton Salad" })
    await user.click(screen.getByRole("button", { name: /all recipes/i }))

    expect(screen.queryByRole("heading", { name: "Won Ton Salad" })).not.toBeInTheDocument()
  })

  it("pre-filters the list to the cook named by ?cook=", () => {
    renderRecipes("/recipes?cook=Lisa%20Tarver")

    expect(screen.getByLabelText("Filter recipes")).toHaveValue("Lisa Tarver")
    expect(screen.getByText("Won Ton Salad")).toBeInTheDocument()
    expect(screen.queryByText("Carbonara salad")).not.toBeInTheDocument()
  })
})
