import { describe, expect, it } from "vitest"

import { ingredientsFingerprint, recipeFingerprint } from "./recipeFingerprint"
import type { Recipe } from "@/types"

const CARBONARA: Recipe = {
  id: "carbonara",
  title: "Carbonara",
  ingredients: [
    { name: "farfalle", amount: "6oz" },
    { name: "pecorino", amount: "1 cup", unique: true },
  ],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta.", "Toss with the egg."] }],
  tags: ["pasta"],
  image: "https://example.test/a.png",
}

describe("recipeFingerprint", () => {
  it("is stable for the same recipe", () => {
    expect(recipeFingerprint(CARBONARA)).toBe(recipeFingerprint({ ...CARBONARA }))
  })

  it("moves when an amount changes", () => {
    expect(
      recipeFingerprint({
        ...CARBONARA,
        ingredients: [{ name: "farfalle", amount: "12oz" }, CARBONARA.ingredients[1]],
      })
    ).not.toBe(recipeFingerprint(CARBONARA))
  })

  it("moves when an ingredient is added or dropped", () => {
    expect(
      recipeFingerprint({ ...CARBONARA, ingredients: [CARBONARA.ingredients[0]] })
    ).not.toBe(recipeFingerprint(CARBONARA))
  })

  it("moves when a step changes", () => {
    expect(
      recipeFingerprint({
        ...CARBONARA,
        directions: [{ sectionTitle: "", steps: ["Boil the pasta.", "Toss with the yolk."] }],
      })
    ).not.toBe(recipeFingerprint(CARBONARA))
  })

  it("holds still for anything that cannot change how much it makes", () => {
    // Renaming a recipe, retagging it, or swapping its photo must not throw
    // away an estimate — that would mean paying for a model call to recover
    // from a typo fix.
    const cosmetic: Recipe = {
      ...CARBONARA,
      title: "Lauren's carbonara",
      tags: ["pasta", "weeknight"],
      image: "https://example.test/b.png",
      contributor: "Lauren",
      ratingSum: 12,
      ratingCount: 3,
    }
    expect(recipeFingerprint(cosmetic)).toBe(recipeFingerprint(CARBONARA))
  })

  it("holds still when only an ingredient's emphasis changes", () => {
    // `unique` decides how a line is *drawn*, not how much of it there is.
    const marked: Recipe = {
      ...CARBONARA,
      ingredients: [{ name: "farfalle", amount: "6oz", unique: true }, CARBONARA.ingredients[1]],
    }
    expect(recipeFingerprint(marked)).toBe(recipeFingerprint(CARBONARA))
  })

  it("copes with a recipe that has neither list yet", () => {
    expect(recipeFingerprint({})).toBe(recipeFingerprint({ ingredients: [], directions: [] }))
  })
})

describe("ingredientsFingerprint", () => {
  const rewritten: Recipe = {
    ...CARBONARA,
    directions: [{ sectionTitle: "", steps: ["Boil the pasta in well-salted water.", "Toss."] }],
  }

  it("holds still when only the method is rewritten", () => {
    // The whole reason it exists: a clearer instruction on how to fold the eggs
    // in does not change how much flour to buy, so it must not throw away a
    // scaling spec that is still perfectly correct.
    expect(ingredientsFingerprint(rewritten)).toBe(ingredientsFingerprint(CARBONARA))
  })

  it("is narrower than the full stamp, which does move on a rewrite", () => {
    expect(recipeFingerprint(rewritten)).not.toBe(recipeFingerprint(CARBONARA))
  })

  it("moves when an amount changes", () => {
    expect(
      ingredientsFingerprint({
        ...CARBONARA,
        ingredients: [{ name: "farfalle", amount: "12oz" }, CARBONARA.ingredients[1]],
      })
    ).not.toBe(ingredientsFingerprint(CARBONARA))
  })

  it("moves when a line is added or dropped", () => {
    expect(
      ingredientsFingerprint({ ...CARBONARA, ingredients: [CARBONARA.ingredients[0]] })
    ).not.toBe(ingredientsFingerprint(CARBONARA))
  })

  it("holds still for a retitle or a retag", () => {
    const renamed: Recipe = { ...CARBONARA, title: "Carbonara, properly", tags: ["dinner"] }
    expect(ingredientsFingerprint(renamed)).toBe(ingredientsFingerprint(CARBONARA))
  })
})
