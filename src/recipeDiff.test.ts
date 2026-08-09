import { describe, expect, it } from "vitest"

import { describeChanges, diffRecipe, summariseChanges, type RecipeBaseline } from "./recipeDiff"

/** Rows carry the replaced text too; most assertions only care about the kind. */
const kinds = (rows: Array<{ kind: string }>) => rows.map((row) => row.kind)

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
  serves: null,
  servingSize: null,
  hasImage: true,
}

/** The saved recipe, with one thing about it different. */
const edited = (change: Partial<RecipeBaseline>): RecipeBaseline => ({ ...SAVED, ...change })

describe("diffRecipe", () => {
  it("finds nothing in an untouched recipe", () => {
    const changes = diffRecipe(SAVED, edited({}))

    expect(changes.count).toBe(0)
    expect(kinds(changes.ingredients)).toEqual(["same", "same"])
    expect(changes.sections.map((s) => kinds(s.steps))).toEqual([["same", "same"], ["same"]])
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

    expect(kinds(changes.ingredients)).toEqual(["changed", "same", "added"])
    // The row it replaces rides along, for the press-and-hold peek.
    expect(changes.ingredients[0].before).toBe("Beef — 1 lb")
    expect(changes.count).toBe(2)
  })

  it("counts a deleted ingredient, which has no row left to mark", () => {
    const changes = diffRecipe(SAVED, edited({ ingredients: [SAVED.ingredients[0]] }))

    expect(kinds(changes.ingredients)).toEqual(["same"])
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
    expect(kinds(changes.sections[0].steps)).toEqual(["same", "same"])
    expect(changes.sections[0].titleBefore).toBe("Sauce")
    expect(changes.count).toBe(1)
  })

  it("marks a whole new section as new, steps and all", () => {
    const changes = diffRecipe(
      SAVED,
      edited({
        directions: [...SAVED.directions, { sectionTitle: "Bake", steps: ["40 minutes"] }],
      })
    )

    expect(changes.sections[2]).toMatchObject({ added: true, steps: [{ kind: "added" }] })
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
    expect(kinds(changes.sections[0].steps)).toEqual(["changed", "changed"])
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
    expect(kinds(changes.ingredients)).toEqual(["added", "added"])
    expect(changes.tagsRemoved).toEqual([])
  })

  it("finds nothing in an empty unsaved recipe", () => {
    // What the editor looks like on arrival — the save button stays disabled.
    const changes = diffRecipe(null, {
      title: "",
      ingredients: [],
      directions: [],
      tags: [],
      serves: null,
      servingSize: null,
      hasImage: false,
    })

    expect(changes.count).toBe(0)
  })
})

describe("summariseChanges", () => {
  const summary = (change: Partial<RecipeBaseline>) =>
    summariseChanges(diffRecipe(SAVED, edited(change)))

  it("says nothing about an untouched recipe", () => {
    // The assistant's panel reads an empty list as "nothing would change".
    expect(summary({})).toEqual([])
  })

  it("counts each kind of ingredient change separately", () => {
    expect(
      summary({
        ingredients: [
          { name: "Beef", amount: "2 lb" }, // changed
          { name: "Garlic", amount: "3 cloves" }, // sits where Onion was
          { name: "Basil", amount: "1 bunch" }, // past the end
        ],
      })
      // Positional, as everywhere else: replacing the second ingredient reads
      // as a change to it, not as one removal and one addition.
    ).toEqual(["Ingredients: 2 changed, 1 new"])
  })

  it("adds up steps across every section", () => {
    expect(
      summary({
        directions: [
          { sectionTitle: "Sauce", steps: ["Brown the beef"] },
          { sectionTitle: "Assembly", steps: ["Layer it up", "Bake"] },
        ],
      })
    ).toEqual(["Steps: 1 new, 1 removed"])
  })

  it("reports a new section and its steps", () => {
    expect(
      summary({
        directions: [...SAVED.directions, { sectionTitle: "Bake", steps: ["40 minutes"] }],
      })
    ).toEqual(["Steps: 1 new", "Sections: 1 new"])
  })

  it("leads with the title, since that is what the draft is called", () => {
    expect(summary({ title: "Vegan lasagna" })[0]).toBe("A different title")
  })

  it("leaves out the counts that are zero", () => {
    // "Tags: 1 added, 0 removed" reads as though something was removed.
    expect(summary({ tags: ["italian", "pasta"] })).toEqual(["Tags: 1 added"])
  })
})

describe("describeChanges", () => {
  const lines = (change: Partial<RecipeBaseline>) => describeChanges(SAVED, edited(change))

  it("carries both texts, so a panel can show one replacing the other", () => {
    expect(
      lines({ ingredients: [{ name: "Beef", amount: "2 lb" }, SAVED.ingredients[1]] })
    ).toEqual([
      { kind: "changed", where: "ingredient", before: "Beef — 1 lb", after: "Beef — 2 lb" },
    ])
  })

  it("keeps the optional flag in the text it shows", () => {
    expect(lines({ ingredients: [SAVED.ingredients[0]] })).toEqual([
      { kind: "removed", where: "ingredient", before: "Onion — 1/2 cup (optional)" },
    ])
  })

  it("names a new section and lists its steps", () => {
    expect(
      lines({ directions: [...SAVED.directions, { sectionTitle: "Bake", steps: ["40 min"] }] })
    ).toEqual([
      { kind: "added", where: "section", after: "Bake" },
      { kind: "added", where: "step", after: "40 min" },
    ])
  })

  it("does not list the steps of a section that is gone with it", () => {
    // The section line says it; twenty step lines under it say nothing more.
    expect(lines({ directions: [SAVED.directions[0]] })).toEqual([
      { kind: "removed", where: "section", before: "Assembly" },
    ])
  })

  it("gives an untitled section a name rather than an empty line", () => {
    expect(lines({ directions: [{ sectionTitle: "", steps: SAVED.directions[0].steps }] })).toEqual(
      [
        { kind: "changed", where: "section", before: "Sauce", after: "Untitled section" },
        { kind: "removed", where: "section", before: "Assembly" },
      ]
    )
  })

  it("finds nothing in an untouched recipe", () => {
    expect(lines({})).toEqual([])
  })
})

describe("how much it makes", () => {
  const base = {
    title: "Chilli",
    ingredients: [],
    directions: [],
    tags: [],
    serves: 4,
    servingSize: "1 bowl",
    hasImage: false,
  }

  it("counts a changed count and a changed serving size as one change", () => {
    const changes = diffRecipe(base, { ...base, serves: 8, servingSize: "2 bowls" })

    // One fact read two ways. Two flags would report "Serves: changed. Serving
    // size: changed" about a single edit.
    expect(changes.makes).toBe(true)
    expect(changes.count).toBe(1)
  })

  it("says nothing when neither moved", () => {
    expect(diffRecipe(base, { ...base }).makes).toBe(false)
  })

  it("counts a yield that has been filled in for the first time", () => {
    const changes = diffRecipe({ ...base, serves: null, servingSize: null }, base)
    expect(changes.makes).toBe(true)
    expect(summariseChanges(changes)).toContain("How much it makes")
  })

  it("describes both sides so the peek can show what it said before", () => {
    const [line] = describeChanges({ ...base, serves: null, servingSize: null }, base)

    expect(line).toMatchObject({ where: "makes", before: "not said" })
    expect(line.after).toBe("serves 4 · 1 bowl")
  })
})
