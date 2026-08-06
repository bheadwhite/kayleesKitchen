import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import RecipeRating from "./RecipeRating"
import type { Recipe } from "@/types"

const getMyRating = vi.fn().mockResolvedValue(null)
const rateRecipe = vi.fn().mockResolvedValue(undefined)

vi.mock("fire/services", () => ({
  getMyRating: (...args: unknown[]) => getMyRating(...args),
  rateRecipe: (...args: unknown[]) => rateRecipe(...args),
}))

vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("contexts/AuthProvider", () => ({
  useSessionUser: () => ({
    uid: "u1",
    email: "reader@example.test",
    displayName: "Reader",
    photoURL: null,
  }),
}))

const RECIPE: Recipe = {
  id: "chili",
  title: "Chili",
  email: "cook@example.test",
  ingredients: [],
  directions: [],
  ratingSum: 9,
  ratingCount: 2,
}

beforeEach(() => {
  getMyRating.mockClear().mockResolvedValue(null)
  rateRecipe.mockClear().mockResolvedValue(undefined)
})

describe("RecipeRating", () => {
  it("shows the average without naming anyone", async () => {
    render(<RecipeRating recipe={RECIPE} />)

    expect(await screen.findByText("4.5 · 2 ratings")).toBeInTheDocument()
    // Nothing here can say who rated: the individual ratings are unreadable to
    // everyone but their author.
    expect(screen.queryByText(/cook@example/)).toBeNull()
  })

  it("leaves a rating", async () => {
    const user = userEvent.setup()
    render(<RecipeRating recipe={RECIPE} />)

    await user.click(screen.getByRole("button", { name: "4 stars" }))

    expect(rateRecipe).toHaveBeenCalledWith("chili", "u1", 4)
  })

  it("shows back what you gave it", async () => {
    getMyRating.mockResolvedValue(3)
    render(<RecipeRating recipe={RECIPE} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "3 stars" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )
    expect(screen.getByText("Yours")).toBeInTheDocument()
  })

  it("puts the stars back if the write fails", async () => {
    const user = userEvent.setup()
    rateRecipe.mockRejectedValue(new Error("offline"))
    getMyRating.mockResolvedValue(2)
    render(<RecipeRating recipe={RECIPE} />)

    await waitFor(() => expect(screen.getByText("Yours")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "5 stars" }))

    // The press lands immediately, so a failure has to walk it back.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2 stars" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    )
  })

  it("offers no stars on your own recipe", () => {
    render(<RecipeRating recipe={{ ...RECIPE, email: "reader@example.test" }} />)

    expect(screen.queryByRole("button", { name: "5 stars" })).toBeNull()
    // And does not go looking for a rating that cannot exist.
    expect(getMyRating).not.toHaveBeenCalled()
  })

  it("says so when nobody has rated it", () => {
    render(<RecipeRating recipe={{ ...RECIPE, ratingSum: 0, ratingCount: 0 }} />)

    expect(screen.getByText("Not rated yet")).toBeInTheDocument()
  })
})
