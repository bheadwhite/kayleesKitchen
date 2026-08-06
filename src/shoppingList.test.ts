import { describe, expect, it } from "vitest"

import {
  bySection,
  consolidateVerbatim,
  mergePlan,
  sectionKey,
  type ProposedItem,
} from "./shoppingList"
import type { ShoppingItem } from "@/types"

const item = (partial: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem => ({
  amount: "",
  section: "other",
  from: [],
  checked: false,
  sort: 0,
  addedAt: null,
  ...partial,
})

const PANCAKES = {
  title: "Pancakes",
  ingredients: [
    { name: "Butter", amount: "1 cup" },
    { name: "flour", amount: "2 cups" },
  ],
}

const COOKIES = {
  title: "Cookies",
  ingredients: [
    { name: "butter ", amount: "2 tbsp" },
    { name: "vanilla", amount: "1 tsp", optional: true },
  ],
}

describe("sectionKey", () => {
  it("takes a section it knows", () => {
    expect(sectionKey("Produce")).toBe("produce")
  })

  it("drops anything else into other rather than losing it", () => {
    expect(sectionKey("international foods")).toBe("other")
    expect(sectionKey("")).toBe("other")
  })
})

describe("consolidateVerbatim", () => {
  it("groups the same ingredient across recipes, amounts as written", () => {
    const [butter] = consolidateVerbatim([PANCAKES, COOKIES])

    expect(butter.name).toBe("butter")
    expect(butter.amount).toBe("1 cup + 2 tbsp")
    expect(butter.from).toEqual(["Pancakes", "Cookies"])
  })

  it("never guesses a section", () => {
    expect(consolidateVerbatim([PANCAKES]).every((row) => row.section === "other")).toBe(true)
  })

  it("marks an optional ingredient rather than dropping it", () => {
    const vanilla = consolidateVerbatim([COOKIES]).find((row) => row.name === "vanilla")
    expect(vanilla?.amount).toBe("1 tsp (optional)")
  })

  it("credits a recipe once when it lists an ingredient twice", () => {
    const [flour] = consolidateVerbatim([
      {
        title: "Bread",
        ingredients: [
          { name: "flour", amount: "500g" },
          { name: "flour", amount: "a little, for dusting" },
        ],
      },
    ])

    expect(flour.from).toEqual(["Bread"])
    expect(flour.amount).toBe("500g + a little, for dusting")
  })

  it("folds into an unticked row already on the list", () => {
    const [butter] = consolidateVerbatim(
      [COOKIES],
      [item({ id: "b", name: "butter", amount: "1 cup", section: "dairy", from: ["Pancakes"] })]
    )

    expect(butter.mergesWith).toBe("b")
    expect(butter.amount).toBe("1 cup + 2 tbsp")
    // The section it was already filed under survives — nothing here could work
    // one out, and "other" would demote a row someone has already placed.
    expect(butter.section).toBe("dairy")
    expect(butter.from).toEqual(["Pancakes", "Cookies"])
  })

  it("leaves a ticked row alone", () => {
    const [butter] = consolidateVerbatim(
      [COOKIES],
      [item({ id: "b", name: "butter", amount: "1 cup", checked: true })]
    )

    expect(butter.mergesWith).toBeNull()
    expect(butter.amount).toBe("2 tbsp")
  })

  it("skips a nameless ingredient", () => {
    expect(consolidateVerbatim([{ title: "X", ingredients: [{ name: " ", amount: "1" }] }])).toEqual(
      []
    )
  })
})

describe("mergePlan", () => {
  const proposed = (partial: Partial<ProposedItem> & { name: string }): ProposedItem => ({
    amount: "",
    section: "other",
    from: [],
    ...partial,
  })

  it("updates a row it merges into and adds the rest", () => {
    const { updates, additions } = mergePlan(
      [item({ id: "b", name: "butter", amount: "1 cup", section: "dairy" })],
      [
        proposed({ name: "butter", amount: "1 cup + 2 tbsp", section: "dairy", mergesWith: "b" }),
        proposed({ name: "vanilla", amount: "1 tsp", section: "pantry" }),
      ]
    )

    expect(updates).toEqual([{ id: "b", amount: "1 cup + 2 tbsp", from: [] }])
    expect(additions).toHaveLength(1)
    expect(additions[0]).toMatchObject({ name: "vanilla", section: "pantry", checked: false })
  })

  it("merges on the name when the model forgets the id", () => {
    const { updates } = mergePlan(
      [item({ id: "b", name: "Butter" })],
      [proposed({ name: "butter", amount: "2 tbsp" })]
    )

    expect(updates).toEqual([{ id: "b", amount: "2 tbsp", from: [] }])
  })

  it("takes mergesWith over the name, for a synonym", () => {
    const { updates, additions } = mergePlan(
      [item({ id: "g", name: "green onions" })],
      [proposed({ name: "scallions", amount: "1 bunch", mergesWith: "g" })]
    )

    expect(updates).toEqual([{ id: "g", amount: "1 bunch", from: [] }])
    expect(additions).toEqual([])
  })

  it("will not merge into a ticked row — that one is already bought", () => {
    const { updates, additions } = mergePlan(
      [item({ id: "b", name: "butter", amount: "1 cup", checked: true })],
      [proposed({ name: "butter", amount: "2 tbsp", section: "dairy", mergesWith: "b" })]
    )

    expect(updates).toEqual([])
    expect(additions).toHaveLength(1)
    expect(additions[0]).toMatchObject({ name: "butter", amount: "2 tbsp", checked: false })
  })

  it("makes a row of its own when the target has gone", () => {
    const { updates, additions } = mergePlan(
      [],
      [proposed({ name: "butter", amount: "2 tbsp", mergesWith: "long-deleted" })]
    )

    expect(updates).toEqual([])
    expect(additions).toHaveLength(1)
  })

  it("lets two proposals claim one row only once", () => {
    const { updates, additions } = mergePlan(
      [item({ id: "b", name: "butter" })],
      [
        proposed({ name: "butter", amount: "1 cup", mergesWith: "b" }),
        proposed({ name: "salted butter", amount: "2 tbsp", mergesWith: "b" }),
      ]
    )

    expect(updates).toHaveLength(1)
    expect(additions).toHaveLength(1)
    expect(additions[0].name).toBe("salted butter")
  })

  it("folds a name proposed twice into one addition", () => {
    const { additions } = mergePlan(
      [],
      [
        proposed({ name: "butter", amount: "1 cup", from: ["Pancakes"] }),
        proposed({ name: "Butter", amount: "2 tbsp", from: ["Cookies"] }),
      ]
    )

    expect(additions).toHaveLength(1)
    expect(additions[0].amount).toBe("1 cup + 2 tbsp")
    expect(additions[0].from).toEqual(["Pancakes", "Cookies"])
  })

  it("sorts additions after what the section already holds", () => {
    const { additions } = mergePlan(
      [item({ id: "a", name: "apples", section: "produce", sort: 4 })],
      [
        proposed({ name: "pears", section: "produce" }),
        proposed({ name: "plums", section: "produce" }),
      ]
    )

    expect(additions.map((row) => row.sort)).toEqual([5, 6])
  })

  it("files an invented section under other", () => {
    const { additions } = mergePlan([], [proposed({ name: "kimchi", section: "fermented" })])
    expect(additions[0].section).toBe("other")
  })
})

describe("bySection", () => {
  it("walks the shop in order, not alphabetically, and drops empty aisles", () => {
    const sections = bySection([
      item({ id: "1", name: "flour", section: "pantry" }),
      item({ id: "2", name: "apples", section: "produce" }),
    ])

    expect(sections.map((section) => section.key)).toEqual(["produce", "pantry"])
  })

  it("settles ticked rows to the bottom of their section", () => {
    const [produce] = bySection([
      item({ id: "1", name: "apples", section: "produce", sort: 1, checked: true }),
      item({ id: "2", name: "pears", section: "produce", sort: 2 }),
    ])

    expect(produce.items.map((row) => row.name)).toEqual(["pears", "apples"])
  })
})
