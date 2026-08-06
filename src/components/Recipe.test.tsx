import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import Recipe from "./Recipe"
import type { Recipe as RecipeType } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("contexts/AuthProvider", () => ({
  useSessionUser: () => ({
    uid: "u1",
    email: "lauren@example.test",
    displayName: "Lauren",
    photoURL: null,
  }),
}))
vi.mock("fire/services", () => ({
  getMyRating: vi.fn().mockResolvedValue(null),
  rateRecipe: vi.fn().mockResolvedValue(undefined),
}))

const COOKIES: RecipeType = {
  id: "cookies",
  title: "Brown butter cookies",
  email: "lauren@example.test",
  ingredients: [{ name: "flour", amount: "2 cups" }],
  directions: [{ sectionTitle: "", steps: ["Cream the butter."] }],
}

describe("Recipe", () => {
  it("says nothing about servings until anyone has asked", () => {
    render(<Recipe recipe={COOKIES} />)

    // A recipe records no yield of its own. Printing a guess would be worse
    // than the blank.
    expect(screen.queryByText(/Serves/)).toBeNull()
  })

  it("shows the settled yield beside the other facts about the dish", () => {
    render(<Recipe recipe={COOKIES} serves={18} />)

    expect(screen.getByText(/Serves 18/)).toBeInTheDocument()
  })

  it("says what one serving is, which is what makes the count readable", () => {
    render(<Recipe recipe={COOKIES} serves={18} servingSize='2 cookies' />)

    // "Serves 18" says nothing about a batch of cookies on its own — one
    // cookie each, or three?
    expect(screen.getByText("2 cookies", { exact: false })).toBeInTheDocument()
  })
})
