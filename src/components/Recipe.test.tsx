import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

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

/** Where the page starts and where the bar begins — the readable area. */
const TOP_EDGE = 56
const BAR_TOP = 700

const at = (top: number, bottom: number) => ({ ...new DOMRect(), top, bottom }) as DOMRect

/**
 * jsdom has no layout, so every rect is zero. This puts the two markers at the
 * edges of the readable area and the ingredient list wherever the test wants it,
 * which is the whole of what the bar measures.
 */
const scrollTo = (listBottom: number) => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element
  ) {
    const className = typeof this.className === "string" ? this.className : ""
    if (className.includes("--ingredients-bar-h))]")) return at(BAR_TOP, BAR_TOP)
    if (className.includes("top-[calc(var(--chrome-top)")) return at(TOP_EDGE, TOP_EDGE)
    if (this.querySelector("button[aria-pressed]") != null) return at(0, listBottom)
    return at(0, 0)
  })
  fireEvent.scroll(window)
}

/** The list all but gone: one row still at the top edge, method below it. */
const scrollPastTheList = () => scrollTo(TOP_EDGE + 34)

afterEach(() => {
  vi.restoreAllMocks()
})

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

  describe("the ingredients bar", () => {
    const BAR = { name: /ingredients/i }

    it("stays out of the way while the list is on screen", () => {
      render(<Recipe recipe={COOKIES} />)

      // A handle for reaching something you are already looking at is a control
      // that does nothing, and it costs a permanent strip of a phone to draw.
      expect(screen.queryByRole("button", BAR)).toBeNull()
    })

    it("offers the list once it has scrolled away", () => {
      render(<Recipe recipe={COOKIES} />)
      scrollPastTheList()

      expect(screen.getByRole("button", BAR)).toHaveAttribute("aria-expanded", "false")
    })

    it("does not wait for the last row to clear the top of the screen", () => {
      render(<Recipe recipe={COOKIES} />)

      // The method fills the screen and one ingredient line is still peeking out
      // over the top edge. Insisting the list be gone *entirely* left no
      // bar at precisely the moment somebody wants one.
      scrollTo(TOP_EDGE + 34)
      expect(screen.queryByRole("button", BAR)).not.toBeNull()

      // ...but with the list still holding most of the screen, it is what you
      // are reading, and a handle for reaching it does nothing.
      scrollTo(BAR_TOP - 100)
      expect(screen.queryByRole("button", BAR)).toBeNull()
    })

    it("says nothing on a recipe with no method to read it against", () => {
      render(<Recipe recipe={{ ...COOKIES, directions: [] }} />)
      scrollPastTheList()

      expect(screen.queryByRole("button", BAR)).toBeNull()
    })

    it("brings the amounts up over the steps, and drops them again", () => {
      render(<Recipe recipe={COOKIES} />)
      scrollPastTheList()

      // Closed, the panel is out of the accessibility tree, so the only row
      // reachable is the one in the flow of the page.
      expect(screen.getAllByRole("button", { name: /flour/ })).toHaveLength(1)

      fireEvent.click(screen.getByRole("button", BAR))
      expect(screen.getAllByRole("button", { name: /flour/ })).toHaveLength(2)

      fireEvent.click(screen.getByRole("button", BAR))
      expect(screen.getAllByRole("button", { name: /flour/ })).toHaveLength(1)
    })

    it("ticks the same list from either end", () => {
      render(<Recipe recipe={COOKIES} />)
      scrollPastTheList()
      fireEvent.click(screen.getByRole("button", BAR))

      const [inFlow, inBar] = screen.getAllByRole("button", { name: /flour/ })
      fireEvent.click(inBar)

      // Two views of one list. Ticking the flour off in the bar and finding it
      // untouched on scrolling back up would be a second list, not the same one
      // seen from further down the method.
      expect(inFlow).toHaveAttribute("aria-pressed", "true")
      expect(inBar).toHaveAttribute("aria-pressed", "true")
    })

    it("puts the panel away when the list itself comes back", () => {
      render(<Recipe recipe={COOKIES} />)
      scrollPastTheList()
      fireEvent.click(screen.getByRole("button", BAR))
      expect(screen.getAllByRole("button", { name: /flour/ })).toHaveLength(2)

      // Scrolling back to the list answers the question the panel was opened to
      // answer — and leaving it up would cover the list with a copy of itself.
      vi.restoreAllMocks()
      fireEvent.scroll(window)

      expect(screen.queryByRole("button", BAR)).toBeNull()
      expect(screen.getAllByRole("button", { name: /flour/ })).toHaveLength(1)
    })
  })
})
