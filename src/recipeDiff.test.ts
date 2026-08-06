import { describe, expect, it } from "vitest"

import { diffRecipe, type RecipeBaseline } from "./recipeDiff"

const SAVED: RecipeBaseline = {
  title: "Lasagna",
  ingredients: [
    { name: "Beef", amount: "1 lb" },
    { name: "Onion", amount: "1/2 cup", optional: true },
  ],
  directions: [
    { sectionTitle: "Sauce", steps: ["Brown the beef", "Add tomatoes"] },
    { sectionTitle: "Assembly", steps: ["Layer it up"] },
  ],
  tags: ["italian"],
  hasImage: true,
}

/** The saved recipe, with one thing about it different. */
const edited = (change: Partial<RecipeBaseline>): RecipeBaseline => ({ ...SAVED, ...change })

describe("diffRecipe", () => {
  it("finds nothing in an untouched recipe", () => {
    const changes = diffRecipe(SAVED, edited({}))

    expect(changes.count).toBe(0)
    expect(changes.ingredients).toEqual(["same", "same"])
    expect(changes.sections.map((s) => s.steps)).toEqual([["same", "same"], ["same"]])
  })

  it("treats an absent flag and a false one as the same ingredient", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        ingredients: [
          { name: "Beef", amount: "1 lb", optional: false, unique: false },
          { name: "Onion", amount: "1/2 cup", optional: true },
        ],
      })
    )

    // The editor writes both flags on every save; the wire format leaves them
    // off. Reporting that as a change would mark half the list on load.
    expect(changes.count).toBe(0)
  })

  it("marks an edited ingredient and a new one", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        ingredients: [
          { name: "Beef", amount: "2 lb" },
          { name: "Onion", amount: "1/2 cup", optional: true },
          { name: "Garlic", amount: "3 cloves" },
        ],
      })
    )

    expect(changes.ingredients).toEqual(["changed", "same", "added"])
    expect(changes.count).toBe(2)
  })

  it("counts a deleted ingredient, which has no row left to mark", () => {
    const changes = diffRecipe(SAVED, edited({ ingredients: [SAVED.ingredients[0]] }))

    expect(changes.ingredients).toEqual(["same"])
    expect(changes.ingredientsRemoved).toBe(1)
    expect(changes.count).toBe(1)
  })

  it("marks a retitled section without touching its steps", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        directions: [{ ...SAVED.directions[0], sectionTitle: "The sauce" }, SAVED.directions[1]],
      })
    )

    expect(changes.sections[0].titleChanged).toBe(true)
    expect(changes.sections[0].steps).toEqual(["same", "same"])
    expect(changes.count).toBe(1)
  })

  it("marks a whole new section as new, steps and all", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        directions: [...SAVED.directions, { sectionTitle: "Bake", steps: ["40 minutes"] }],
      })
    )

    expect(changes.sections[2]).toMatchObject({ added: true, steps: ["added"] })
    // The section itself, plus its step.
    expect(changes.count).toBe(2)
  })

  it("reports a reordered step as two changed steps", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        directions: [
          { sectionTitle: "Sauce", steps: ["Add tomatoes", "Brown the beef"] },
          SAVED.directions[1],
        ],
      })
    )

    // Rows are compared by position: the editor cannot tell a drag from a
    // retype, and claiming to would be worse than saying "these two lines are
    // not what you saved".
    expect(changes.sections[0].steps).toEqual(["changed", "changed"])
  })

  it("separates tags added from tags taken off", () => {
    const changes = diffRecipe(SAVED, edited({ tags: ["pasta", "dinner"] }))

    expect(changes.tagsAdded).toEqual(["pasta", "dinner"])
    expect(changes.tagsRemoved).toEqual(["italian"])
    expect(changes.count).toBe(3)
  })

  it("notices a photo arriving and a photo going", () => {
    expect(diffRecipe(edited({ hasImage: false }), SAVED).image).toBe(true)
    expect(diffRecipe(SAVED, edited({ hasImage: false })).image).toBe(true)
    expect(diffRecipe(SAVED, SAVED).image).toBe(false)
  })

  it("counts everything on the screen as new when nothing has been saved", () => {
    const changes = diffRecipe(null, SAVED)

    // 1 title + 1 image + 2 ingredients + 1 tag + 2 sections + 3 steps.
    expect(changes.count).toBe(10)
    expect(changes.ingredients).toEqual(["added", "added"])
    expect(changes.tagsRemoved).toEqual([])
  })

  it("finds nothing in an empty unsaved recipe", () => {
    // What the editor looks like on arrival — the save button stays disabled.
    const changes = diffRecipe(null, {
      title: "",
      ingredients: [],
      directions: [],
      tags: [],
      hasImage: false,
    })

    expect(changes.count).toBe(0)
  })
})
