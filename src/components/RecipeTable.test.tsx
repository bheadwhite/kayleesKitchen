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

/**
 * The rows in order, as text. Each row is one <li>, and the title leads it —
 * `expect(rows()[0]).toContain(...)` survives things being added to a row, which
 * a positional walk into its markup has twice failed to.
 */
const rows = () => screen.getAllByRole("listitem").map((row) => row.textContent ?? "")

describe("RecipeTable", () => {
  it("lists recipes alphabetically", () => {
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} />)

    const [first, second, third] = rows()
    expect(first).toContain("Banana Bread")
    expect(second).toContain("Chili")
    expect(third).toContain("Waffles")
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
    await user.tab() // A–Z
    await user.tab() // Top rated
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

  describe("tags", () => {
    const TAGGED = [
      recipe("Taco Salad", { tags: ["mexican", "salad"] }),
      recipe("Enchiladas", { tags: ["mexican"] }),
      recipe("Porridge"),
    ]

    it("filters to one tag and back", async () => {
      const user = userEvent.setup()
      render(<RecipeTable recipes={TAGGED} onSelect={vi.fn()} />)

      await user.click(screen.getByRole("button", { name: "Filter by tag: salad" }))

      expect(screen.getByText("Taco Salad")).toBeInTheDocument()
      expect(screen.queryByText("Enchiladas")).not.toBeInTheDocument()
      expect(screen.getByText("1 of 3")).toBeInTheDocument()

      // Pressing the active tag again is how you get everything back.
      await user.click(screen.getByRole("button", { name: "Clear tag filter: salad" }))
      expect(screen.getByText("Enchiladas")).toBeInTheDocument()
    })

    it("offers each tag once, whatever it is on", () => {
      render(<RecipeTable recipes={TAGGED} onSelect={vi.fn()} />)

      expect(screen.getAllByRole("button", { name: "Filter by tag: mexican" })).toHaveLength(1)
    })

    it("draws chips in the colour the registry gives them", () => {
      render(
        <RecipeTable recipes={TAGGED} onSelect={vi.fn()} tagColors={{ salad: "sage" }} />
      )

      // sage's fill, from src/tagColors.ts — on the row chip, not the filter.
      const rowChip = screen
        .getAllByText("salad")
        .find((chip) => chip.tagName === "SPAN")
      expect(rowChip).toHaveStyle({ backgroundColor: "#edf3ea" })
    })

    it("narrows within the chosen tag when both filters are on", async () => {
      const user = userEvent.setup()
      render(<RecipeTable recipes={TAGGED} onSelect={vi.fn()} />)

      await user.click(screen.getByRole("button", { name: "Filter by tag: mexican" }))
      await user.type(screen.getByLabelText("Filter recipes"), "taco")

      expect(screen.getByText("Taco Salad")).toBeInTheDocument()
      expect(screen.queryByText("Enchiladas")).not.toBeInTheDocument()
    })

    it("explains an empty tag on its own", async () => {
      const user = userEvent.setup()
      render(
        <RecipeTable recipes={TAGGED} onSelect={vi.fn()} initialFilter='porridge' />
      )

      await user.click(screen.getByRole("button", { name: "Filter by tag: mexican" }))

      expect(screen.getByText('No recipes match "porridge" in "mexican".')).toBeInTheDocument()
    })

    it("searches tags from the box as well", async () => {
      const user = userEvent.setup()
      render(<RecipeTable recipes={TAGGED} onSelect={vi.fn()} />)

      await user.type(screen.getByLabelText("Filter recipes"), "mexican")

      expect(screen.getByText("Enchiladas")).toBeInTheDocument()
      expect(screen.queryByText("Porridge")).not.toBeInTheDocument()
    })
  })

  describe("ratings", () => {
    const RATED = [
      recipe("Alright", { ratingSum: 6, ratingCount: 2 }), // 3.0
      recipe("Excellent", { ratingSum: 15, ratingCount: 3 }), // 5.0
      recipe("Also excellent", { ratingSum: 5, ratingCount: 1 }), // 5.0
      recipe("Unrated"),
    ]

    it("shows an average only where somebody has rated", () => {
      render(<RecipeTable recipes={RATED} onSelect={vi.fn()} />)

      expect(screen.getByText("5.0 (3)")).toBeInTheDocument()
      expect(screen.getByText("3.0 (2)")).toBeInTheDocument()
      // Five empty stars on every row is noise that says nothing.
      expect(screen.queryByText(/\(0\)/)).toBeNull()
    })

    it("sorts by rating, most-rated first among equals, unrated last", async () => {
      const user = userEvent.setup()
      render(<RecipeTable recipes={RATED} onSelect={vi.fn()} />)

      await user.click(screen.getByRole("button", { name: "Top rated" }))

      const [first, second, third, fourth] = rows()
      // Both are 5.0; this one has three people saying so rather than one.
      expect(first).toContain("Excellent")
      expect(second).toContain("Also excellent")
      expect(third).toContain("Alright")
      // Nobody has said it is bad — only that nobody has said anything.
      expect(fourth).toContain("Unrated")
    })

    it("goes back to alphabetical", async () => {
      const user = userEvent.setup()
      render(<RecipeTable recipes={RATED} onSelect={vi.fn()} />)

      await user.click(screen.getByRole("button", { name: "Top rated" }))
      await user.click(screen.getByRole("button", { name: "A–Z" }))

      expect(rows()[0]).toContain("Alright")
    })
  })

  it("marks recipes added in the last week as new", () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    render(
      <RecipeTable
        recipes={[
          recipe("Fresh", { createdAt: daysAgo(2) }),
          recipe("Stale", { createdAt: daysAgo(8) }),
          // Everything written before the field existed, plus the moment
          // between a local save and the server timestamp.
          recipe("Undated", { createdAt: null }),
        ]}
        onSelect={vi.fn()}
      />
    )

    const badges = screen.getAllByText("New")
    expect(badges).toHaveLength(1)
    expect(badges[0].closest("button")).toHaveTextContent("Fresh")
  })

  it("can arrive pre-filtered to one cook", () => {
    render(<RecipeTable recipes={RECIPES} onSelect={vi.fn()} initialFilter='Alice' />)

    expect(screen.getByLabelText("Filter recipes")).toHaveValue("Alice")
    expect(screen.getByText("Banana Bread")).toBeInTheDocument()
    expect(screen.queryByText("Chili")).not.toBeInTheDocument()
  })
})
