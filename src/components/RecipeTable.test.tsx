import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import RecipeTable from "./RecipeTable"
import type { Recipe } from "@/types"

const recipe = (title: string, extra: Partial<Recipe> = {}): Recipe => ({
  id: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  ingredients: [],
  directions: [],
  ...extra,
})

const RECIPES = [
  recipe("Chili", { contributor: "Bob" }),
  recipe("Banana Bread", { contributor: "Alice" }),
  recipe("Waffles"),
]

describe("RecipeTable", () => {
  it("lists recipes alphabetically", () => {
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} />)

    // Each row is one button; its first line is the title.
    const titles = screen
      .getAllByRole("button")
      .map((row) => row.firstElementChild?.nextElementSibling?.firstElementChild?.textContent)
    expect(titles).toEqual(["Banana Bread", "Chili", "Waffles"])
  })

  it("filters on title", async () => {
    const user = userEvent.setup()
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} />)

    await user.type(screen.getByLabelText("Filter recipes"), "banana")

    expect(screen.getByText("Banana Bread")).toBeInTheDocument()
    expect(screen.queryByText("Chili")).not.toBeInTheDocument()
    expect(screen.getByText("1 of 3")).toBeInTheDocument()
  })

  it("filters on contributor", async () => {
    const user = userEvent.setup()
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} />)

    await user.type(screen.getByLabelText("Filter recipes"), "alice")

    expect(screen.getByText("Banana Bread")).toBeInTheDocument()
    expect(screen.queryByText("Waffles")).not.toBeInTheDocument()
  })

  it("explains an empty filter result", async () => {
    const user = userEvent.setup()
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} />)

    await user.type(screen.getByLabelText("Filter recipes"), "zzz")

    expect(screen.getByText('No recipes match "zzz".')).toBeInTheDocument()
  })

  it("explains an empty recipe list", () => {
    render(<RecipeTable recipes={[]} onSelect={vi.fn()} />)
    expect(screen.getByText("No recipes yet.")).toBeInTheDocument()
  })

  it("selects a recipe on click", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<RecipeTable recipes={RECIPES} onSelect={onSelect} />)

    await user.click(screen.getByText("Chili"))

    expect(onSelect).toHaveBeenCalledWith(RECIPES[0])
  })

  it("selects a recipe with the keyboard", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<RecipeTable recipes={RECIPES} onSelect={onSelect} />)

    await user.tab() // filter input
    await user.tab() // first row
    await user.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith(RECIPES[1])
  })

  it("marks the selected row as current", () => {
    render(<RecipeTable recipes={RECIPES} selectedId='chili' onSelect={vi.fn()} />)

    const selected = screen
      .getAllByRole("button")
      .filter((row) => row.hasAttribute("aria-current"))
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent("Chili")
  })

  it("can arrive pre-filtered to one cook", () => {
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} initialFilter='Alice' />)

    expect(screen.getByLabelText("Filter recipes")).toHaveValue("Alice")
    expect(screen.getByText("Banana Bread")).toBeInTheDocument()
    expect(screen.queryByText("Chili")).not.toBeInTheDocument()
  })
})
