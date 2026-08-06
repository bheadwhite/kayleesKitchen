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

  describe("undo and redo", () => {
    it("takes back an ingredient, and puts it back again", () => {
      presenter.loadRecipe(recipe)
      presenter.addIngredient({ name: "Garlic", amount: "3 cloves" })

      presenter.undo()
      expect(presenter.getIngredients().map((i) => i.name)).toEqual(["Beef", "Onion"])

      presenter.redo()
      expect(presenter.getIngredients().map((i) => i.name)).toEqual(["Beef", "Onion", "Garlic"])
    })

    it("abandons the redo once a new edit branches off an undo", () => {
      presenter.loadRecipe(recipe)
      presenter.addIngredient({ name: "Garlic", amount: "3 cloves" })
      presenter.undo()

      presenter.addTag("italian")

      // There is no single future to return to any more — see UndoStack.
      expect(presenter.redo()).toBe(false)
      expect(presenter.getIngredients()).toHaveLength(2)
      expect(presenter.getTags()).toEqual(["italian"])
    })

    it("puts the title back with whatever else the step touched", () => {
      presenter.loadRecipe(recipe)
      // Typing does not record a step of its own, but it is carried in the next
      // one — so an applied draft can be undone as a whole.
      presenter.setTitle("Lasagne")
      presenter.loadRecipe(
        { ...recipe, title: "Vegan lasagna", ingredients: [{ name: "Lentils", amount: "2 cups" }] },
        { asSaved: false }
      )

      presenter.undo()

      expect(presenter.getTitle()).toBe("Lasagne")
      expect(presenter.getIngredients().map((i) => i.name)).toEqual(["Beef", "Onion"])
    })

    it("starts empty when a recipe is opened, so undo cannot reach the last one", () => {
      presenter.addIngredient({ name: "Stray", amount: "1" })
      presenter.loadRecipe(recipe)

      expect(presenter.undo()).toBe(false)
    })

    it("spends no step on a rejected duplicate tag", () => {
      presenter.addTag("salad")
      presenter.addTag("Salad")

      presenter.undo()

      // One press of Undo, one tag gone — not a press that appears to do
      // nothing because it took back a no-op.
      expect(presenter.getTags()).toEqual([])
    })

    it("does not reopen an editor that was open when the step was recorded", () => {
      presenter.loadRecipe(recipe)
      presenter.setEditIngredientIndex(1)
      presenter.updateIngredient({ name: "Shallot", amount: "1 cup" })

      presenter.undo()

      expect(presenter.getEditIngredientIndex()).toBeNull()
      expect(presenter.getDirections().every((s) => s.editStep == null)).toBe(true)
    })

    it("broadcasts what the buttons should be doing", () => {
      const seen: string[] = []
      // Subscriptions are WeakRef-backed — this must stay in a variable.
      const subscription = presenter.historyBroadcast.subscribe(({ canUndo, canRedo }) =>
        seen.push(`${canUndo ? "undo" : "-"}/${canRedo ? "redo" : "-"}`)
      )

      presenter.addTag("salad")
      presenter.undo()
      presenter.redo()

      expect(seen).toEqual(["undo/-", "-/redo", "undo/-"])
      subscription.unsubscribe()
    })
  })

  describe("the saved baseline", () => {
    it("starts empty, so an unsaved recipe has nothing to differ from", () => {
      expect(presenter.getBaseline()).toBeNull()
    })

    it("is whatever was just loaded", () => {
      presenter.loadRecipe(recipe)

      expect(presenter.getBaseline()).toMatchObject({
        title: "Lasagna",
        ingredients: recipe.ingredients,
        hasImage: false,
      })
    })

    it("does not move when the editor is edited", () => {
      presenter.loadRecipe(recipe)
      presenter.addIngredient({ name: "Garlic", amount: "3 cloves" })

      // The whole point: the baseline is what was saved, not what is on screen.
      expect(presenter.getBaseline()?.ingredients).toHaveLength(2)
    })

    it("catches up on save", () => {
      presenter.loadRecipe(recipe)
      presenter.addIngredient({ name: "Garlic", amount: "3 cloves" })
      presenter.markSaved("Lasagna", true)

      expect(presenter.getBaseline()).toMatchObject({ hasImage: true })
      expect(presenter.getBaseline()?.ingredients).toHaveLength(3)
    })

    it("keeps a copy, not a reference to the live list", () => {
      presenter.loadRecipe(recipe)
      presenter.markSaved("Lasagna", false)
      presenter.deleteIngredient(0)

      // A shared array would make every edit invisible to the diff.
      expect(presenter.getBaseline()?.ingredients).toHaveLength(2)
      expect(presenter.getIngredients()).toHaveLength(1)
    })

    it("stays put when an assistant draft is applied", () => {
      presenter.loadRecipe(recipe)
      presenter.loadRecipe(
        { ...recipe, ingredients: [{ name: "Beef", amount: "3 lb" }] },
        { asSaved: false }
      )

      // Re-basing here would report the assistant's rewrite as no change at
      // all — see the comment on `loadRecipe`.
      expect(presenter.getBaseline()?.ingredients[0].amount).toBe("1 lb")
      expect(presenter.getIngredients()[0].amount).toBe("3 lb")
    })

    it("is dropped by reset", () => {
      presenter.loadRecipe(recipe)
      presenter.reset()

      expect(presenter.getBaseline()).toBeNull()
    })
  })

  describe("tags", () => {
    it("normalises on the way in", () => {
      presenter.addTag("  Mexican  ")
      presenter.addTag("SLOW cooker")

      expect(presenter.getTags()).toEqual(["mexican", "slow cooker"])
    })

    it("ignores blanks and repeats, whatever their case", () => {
      presenter.addTag("salad")
      presenter.addTag("Salad")
      presenter.addTag("   ")

      expect(presenter.getTags()).toEqual(["salad"])
    })

    it("stops at the cap", () => {
      for (let i = 0; i < 20; i += 1) presenter.addTag(`tag-${i}`)
      expect(presenter.getTags()).toHaveLength(12)
    })

    it("removes one by name", () => {
      presenter.addTag("salad")
      presenter.addTag("mexican")
      presenter.removeTag("salad")

      expect(presenter.getTags()).toEqual(["mexican"])
    })

    it("normalises what a loaded recipe brings with it", () => {
      presenter.loadRecipe({ ...recipe, tags: ["Mexican", "mexican", " Salad "] })
      expect(presenter.getTags()).toEqual(["mexican", "salad"])
    })

    it("takes whatever a loaded recipe hands it, including nothing", () => {
      presenter.addTag("salad")
      presenter.loadRecipe(recipe)

      // `loadRecipe` replaces the editor wholesale — which is why the AI apply
      // path re-supplies the tags it is not proposing (see AiAssistant.onApply).
      expect(presenter.getTags()).toEqual([])
    })

    it("clears on reset", () => {
      presenter.addTag("salad")
      presenter.reset()
      expect(presenter.getTags()).toEqual([])
    })
  })

  describe("editing an ingredient", () => {
    beforeEach(() => presenter.loadRecipe(recipe))

    it("replaces the ingredient currently being edited", () => {
      presenter.setEditIngredientIndex(1)
      expect(presenter.getEditIngredient()).toMatchObject({ name: "Onion" })

      presenter.updateIngredient({ name: "Shallot", amount: "1 cup" })

      expect(presenter.getIngredients()[1]).toMatchObject({ name: "Shallot", amount: "1 cup" })
      expect(presenter.getEditIngredientIndex()).toBeNull()
    })

    it("edits the row that was opened, not the first one sharing its name", () => {
      presenter.addIngredient({ name: "Beef", amount: "1 lb, for the sauce" })
      presenter.setEditIngredientIndex(2)
      presenter.updateIngredient({ name: "Beef", amount: "2 lb" })

      // Regression: the target used to be looked up by name, which sent every
      // edit of a duplicate to whichever copy came first.
      expect(presenter.getIngredients().map((i) => i.amount)).toEqual([
        "1 lb",
        "1/2 cup",
        "2 lb",
      ])
    })

    it("ignores an index with no ingredient behind it", () => {
      presenter.setEditIngredientIndex(7)
      expect(presenter.getEditIngredientIndex()).toBeNull()
    })

    it("leaves the list alone when the edit target is gone", () => {
      presenter.setEditIngredientIndex(1)
      presenter.deleteIngredient(1)
      presenter.updateIngredient({ name: "Shallot", amount: "1 cup" })

      // Regression: findIndex returned -1 and splice(-1, 1, ...) overwrote the
      // last ingredient instead.
      expect(presenter.getIngredients().map((i) => i.name)).toEqual(["Beef"])
    })

    it("closes an open row when the list shifts under it", () => {
      presenter.setEditIngredientIndex(1)
      presenter.deleteIngredient(0)
      expect(presenter.getEditIngredientIndex()).toBeNull()
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

    it("moves a step to an arbitrary position (drag and drop)", () => {
      presenter.addNewStep(0, "Simmer")
      presenter.moveStep(0, 2, 0)

      expect(presenter.getDirections()[0].steps).toEqual([
        "Simmer",
        "Brown the beef",
        "Add tomatoes",
      ])
    })

    it("ignores a drag that lands out of range or goes nowhere", () => {
      presenter.moveStep(0, 0, 0)
      presenter.moveStep(0, 0, 5)
      presenter.moveStep(0, -1, 1)
      presenter.moveStep(9, 0, 1)

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
