import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import TagManager from "./TagManager"
import type { Recipe, TagRecord } from "@/types"

const RECIPES: Recipe[] = [
  { id: "taco", title: "Taco Salad", ingredients: [], directions: [], tags: ["mexican", "salad"] },
  { id: "ench", title: "Enchiladas", ingredients: [], directions: [], tags: ["Mexican"] },
]

const REGISTRY: TagRecord[] = [
  { name: "mexican", color: "clay" },
  // In the registry, on no recipe — someone picked a colour ahead of using it.
  { name: "dessert", color: "rose" },
]

const setTagColor = vi.fn().mockResolvedValue(undefined)
const renameTag = vi.fn().mockResolvedValue(undefined)
const deleteTag = vi.fn().mockResolvedValue(undefined)

vi.mock("fire/services", () => ({
  onRecipesSnapshot: (callback: (recipes: Recipe[]) => void) => {
    callback(RECIPES)
    return () => {}
  },
  onTagsSnapshot: (callback: (tags: TagRecord[]) => void) => {
    callback(REGISTRY)
    return () => {}
  },
  setTagColor: (...args: unknown[]) => setTagColor(...args),
  renameTag: (...args: unknown[]) => renameTag(...args),
  deleteTag: (...args: unknown[]) => deleteTag(...args),
}))

describe("TagManager", () => {
  beforeEach(() => {
    setTagColor.mockClear()
    renameTag.mockClear()
    deleteTag.mockClear()
  })

  it("lists every tag in circulation, from recipes and the registry alike", () => {
    render(<TagManager />)

    // "salad" is on a recipe with no registry entry; "dessert" is the reverse.
    // Both are tags, and a manager that showed only one half would hide half
    // the vocabulary.
    expect(screen.getByRole("button", { name: "Rename tag: salad" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rename tag: dessert" })).toBeInTheDocument()
    expect(screen.getByText("3 tags")).toBeInTheDocument()
  })

  it("counts recipes per tag, whatever case they were written in", () => {
    render(<TagManager />)

    // "Mexican" and "mexican" are the same tag — normalised on the way in.
    expect(screen.getByText("2 recipes")).toBeInTheDocument()
    expect(screen.getAllByText("1 recipe")).toHaveLength(1)
    expect(screen.getByText("0 recipes")).toBeInTheDocument()
  })

  it("recolours a tag in one tap", async () => {
    const user = userEvent.setup()
    render(<TagManager />)

    await user.click(screen.getByRole("button", { name: "Sage for salad" }))

    expect(setTagColor).toHaveBeenCalledWith("salad", "sage")
  })

  it("renames a tag, normalising what was typed", async () => {
    const user = userEvent.setup()
    render(<TagManager />)

    await user.click(screen.getByRole("button", { name: "Rename tag: salad" }))
    const input = screen.getByLabelText("Rename tag: salad")
    await user.clear(input)
    await user.type(input, "  Side Salads {Enter}")

    // The colour rides along, so a renamed tag does not lose its place.
    expect(renameTag).toHaveBeenCalledWith("salad", "side salads", "steel")
  })

  it("does not rewrite every recipe when the name comes back unchanged", async () => {
    const user = userEvent.setup()
    render(<TagManager />)

    await user.click(screen.getByRole("button", { name: "Rename tag: salad" }))
    await user.click(screen.getByRole("button", { name: "Save tag name" }))

    expect(renameTag).not.toHaveBeenCalled()
  })

  it("says how many recipes a deletion reaches before doing it", async () => {
    const user = userEvent.setup()
    render(<TagManager />)

    await user.click(screen.getByRole("button", { name: "Delete tag: mexican" }))

    expect(
      screen.getByText(/removes "mexican" from 2 recipes/i)
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete tag" }))
    expect(deleteTag).toHaveBeenCalledWith("mexican")
  })
})
