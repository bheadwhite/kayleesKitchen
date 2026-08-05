import { beforeEach, describe, expect, it } from "vitest"

import { RecipePresenter } from "./RecipePresenter"
import type { Recipe } from "@/types"

const recipe: Recipe = {
  id: "abc123",
  title: "Lasagna",
  ingredients: [
    { name: "Beef", amount: "1 lb" },
    { name: "Onion", amount: "1/2 cup", optional: true },
  ],
  directions: [
    { sectionTitle: "Sauce", steps: ["Brown the beef", "Add tomatoes"] },
    { sectionTitle: "Assembly", steps: ["Layer it up"] },
  ],
}

describe("RecipePresenter", () => {
  let presenter: RecipePresenter

  beforeEach(() => {
    presenter = new RecipePresenter()
  })

  it("starts empty", () => {
    expect(presenter.getId()).toBeNull()
    expect(presenter.getTitle()).toBe("")
    expect(presenter.getIngredients()).toEqual([])
    expect(presenter.getDirections()).toEqual([])
  })

  it("broadcasts ingredient changes to subscribers", () => {
    const seen: number[] = []
    // Subscriptions are WeakRef-backed — this must stay in a variable.
    const subscription = presenter.ingredientsBroadcast.subscribe((next) =>
      seen.push(next.length)
    )

    presenter.addIngredient({ name: "Salt", amount: "1 tsp" })
    presenter.addIngredient({ name: "Pepper", amount: "to taste" })
    presenter.deleteIngredient(0)

    expect(seen).toEqual([1, 2, 1])
    expect(presenter.getIngredients()).toEqual([{ name: "Pepper", amount: "to taste" }])
    subscription.unsubscribe()
  })

  describe("loading an existing recipe", () => {
    beforeEach(() => presenter.loadRecipe(recipe))

    it("populates id, title, ingredients and directions", () => {
      expect(presenter.getId()).toBe("abc123")
      expect(presenter.getTitle()).toBe("Lasagna")
      expect(presenter.getIngredients()).toHaveLength(2)
      expect(presenter.getDirections()).toHaveLength(2)
    })

    it("clears the transient editStep flag on every section", () => {
      expect(presenter.getDirections().every((s) => s.editStep === null)).toBe(true)
    })

    it("does not mutate the source recipe", () => {
      presenter.addNewStep(0, "Simmer")
      expect(recipe.directions[0].steps).toHaveLength(2)
    })
  })

  describe("reset", () => {
    it("clears the id back to null so the next save creates a new recipe", () => {
      presenter.loadRecipe(recipe)
      presenter.reset()

      // Regression: the old controller set this to "" here, which is non-null
      // and sent the next submit down the "update existing recipe" path.
      expect(presenter.getId()).toBeNull()
      expect(presenter.getTitle()).toBe("")
      expect(presenter.getIngredients()).toEqual([])
      expect(presenter.getDirections()).toEqual([])
    })
  })

  describe("updateIngredient", () => {
    it("replaces the ingredient currently being edited", () => {
      presenter.loadRecipe(recipe)
      presenter.setEditIngredient(recipe.ingredients[1])
      presenter.updateIngredient({ name: "Shallot", amount: "1 cup" })

      expect(presenter.getIngredients()[1]).toMatchObject({ name: "Shallot", amount: "1 cup" })
      expect(presenter.getEditIngredient().name).toBe("")
    })

    it("leaves the list alone when the edit target is gone", () => {
      presenter.loadRecipe(recipe)
      presenter.setEditIngredient({ name: "Nonexistent", amount: "" })
      presenter.updateIngredient({ name: "Shallot", amount: "1 cup" })

      // Regression: findIndex returned -1 and splice(-1, 1, ...) overwrote the
      // last ingredient instead.
      expect(presenter.getIngredients().map((i) => i.name)).toEqual(["Beef", "Onion"])
    })
  })

  describe("steps", () => {
    beforeEach(() => presenter.loadRecipe(recipe))

    it("moves a step down and back up", () => {
      presenter.moveStepDownOne(0, 0)
      expect(presenter.getDirections()[0].steps).toEqual(["Add tomatoes", "Brown the beef"])

      presenter.moveStepUpOne(0, 1)
      expect(presenter.getDirections()[0].steps).toEqual(["Brown the beef", "Add tomatoes"])
    })

    it("ignores moves off either end", () => {
      presenter.moveStepUpOne(0, 0)
      presenter.moveStepDownOne(0, 1)
      expect(presenter.getDirections()[0].steps).toEqual(["Brown the beef", "Add tomatoes"])
    })

    it("updates the step under edit from form values", () => {
      presenter.setEditStep(0, 1)
      presenter.updateSectionStep(0, { "nextStep-0": "Add crushed tomatoes" })

      expect(presenter.getDirections()[0].steps[1]).toBe("Add crushed tomatoes")
      expect(presenter.getDirections()[0].editStep).toBeNull()
    })

    it("ignores a step update when nothing is being edited", () => {
      presenter.updateSectionStep(0, { "nextStep-0": "Nope" })
      expect(presenter.getDirections()[0].steps).toEqual(["Brown the beef", "Add tomatoes"])
    })
  })

  describe("sections", () => {
    it("renames only the section being edited and then exits edit mode", () => {
      presenter.loadRecipe(recipe)
      presenter.setEditSection(1)
      presenter.updateSectionTitle("Build")

      expect(presenter.getDirections().map((s) => s.sectionTitle)).toEqual(["Sauce", "Build"])
      expect(presenter.getEditSection()).toBeNull()
    })

    it("ignores a rename when no section is being edited", () => {
      presenter.loadRecipe(recipe)
      presenter.updateSectionTitle("Build")
      expect(presenter.getDirections().map((s) => s.sectionTitle)).toEqual([
        "Sauce",
        "Assembly",
      ])
    })

    it("deletes a section", () => {
      presenter.loadRecipe(recipe)
      presenter.deleteSection(0)
      expect(presenter.getDirections().map((s) => s.sectionTitle)).toEqual(["Assembly"])
    })
  })

  describe("images", () => {
    it("marks the image as loading when a file is attached", () => {
      const file = new File([""], "photo.png", { type: "image/png" })
      presenter.setImageFile(file)

      expect(presenter.getImageFile()).toBe(file)
      expect(presenter.loadingRecipeImageBroadcast.get()).toBe(true)
    })

    it("clears file, url and loading state together", () => {
      presenter.setImageFile(new File([""], "photo.png", { type: "image/png" }))
      presenter.setImageUrl("https://example.test/photo.png")
      presenter.removeImage()

      expect(presenter.getImageFile()).toBeNull()
      expect(presenter.getImageUrl()).toBeNull()
      expect(presenter.loadingRecipeImageBroadcast.get()).toBe(false)
    })
  })
})
