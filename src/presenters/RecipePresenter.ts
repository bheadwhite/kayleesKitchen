import { Signal } from "@tcn/state/core"

import type { DirectionSection, Ingredient, Recipe } from "@/types"

const EMPTY_INGREDIENT: Ingredient = {
  name: "",
  amount: "",
  optional: false,
  unique: false,
}

/**
 * Owns everything the recipe editor manipulates. A direct port of the old
 * `RecipeController`, with `StatefulSubject` swapped for `Signal` and
 * `onXChange(cb)` replaced by public `.broadcast` getters.
 */
export class RecipePresenter {
  private _id: string | null = null
  private _title = ""

  private readonly _directions = new Signal<DirectionSection[]>([])
  private readonly _ingredients = new Signal<Ingredient[]>([])
  private readonly _imageUrl = new Signal<string | null>(null)
  private readonly _imageFile = new Signal<File | null>(null)
  private readonly _editIngredient = new Signal<Ingredient>(EMPTY_INGREDIENT)
  private readonly _editSection = new Signal<number | null>(null)
  private readonly _loadingRecipeImage = new Signal(false)

  get directionsBroadcast() {
    return this._directions.broadcast
  }

  get ingredientsBroadcast() {
    return this._ingredients.broadcast
  }

  get imageUrlBroadcast() {
    return this._imageUrl.broadcast
  }

  get editIngredientBroadcast() {
    return this._editIngredient.broadcast
  }

  get editSectionBroadcast() {
    return this._editSection.broadcast
  }

  get loadingRecipeImageBroadcast() {
    return this._loadingRecipeImage.broadcast
  }

  /* ------------------------------------------------------------- scalars */

  getId() {
    return this._id
  }

  getTitle() {
    return this._title
  }

  setTitle(title: string) {
    this._title = title
  }

  /* -------------------------------------------------------------- images */

  getImageUrl() {
    return this._imageUrl.get()
  }

  getImageFile() {
    return this._imageFile.get()
  }

  setImageFile(file: File | null) {
    this._loadingRecipeImage.set(file != null)
    this._imageFile.set(file)
  }

  setImageUrl(url: string | null) {
    this._imageUrl.set(url)
  }

  setRecipeImageIsLoading(isLoading: boolean) {
    this._loadingRecipeImage.set(isLoading)
  }

  removeImage() {
    this._imageFile.set(null)
    this._imageUrl.set(null)
    this._loadingRecipeImage.set(false)
  }

  /* --------------------------------------------------------- ingredients */

  getIngredients() {
    return this._ingredients.get()
  }

  getEditIngredient() {
    return this._editIngredient.get()
  }

  setEditIngredient(ingredient: Ingredient) {
    this._editIngredient.set(ingredient)
  }

  resetEditIngredient() {
    this._editIngredient.set(EMPTY_INGREDIENT)
  }

  addIngredient({ name, amount, unique, optional }: Ingredient) {
    this._ingredients.transform((current) => [
      ...current,
      { name, amount, unique, optional },
    ])
  }

  updateIngredient({ name, amount, unique, optional }: Ingredient) {
    const target = this._editIngredient.get().name
    const index = this._ingredients.get().findIndex((i) => i.name === target)

    // Guard against -1: the old controller's `splice(-1, 1, ...)` silently
    // overwrote the last ingredient when the edit target had gone away.
    if (index === -1) {
      this.resetEditIngredient()
      return
    }

    this._ingredients.transform((current) =>
      current.map((ingredient, i) =>
        i === index ? { name, amount, unique, optional } : ingredient
      )
    )
    this.resetEditIngredient()
  }

  deleteIngredient(index: number) {
    this._ingredients.transform((current) => current.filter((_, i) => i !== index))
  }

  /* ---------------------------------------------------------- directions */

  getDirections() {
    return this._directions.get()
  }

  getEditSection() {
    return this._editSection.get()
  }

  setEditSection(index: number | null) {
    this._editSection.set(index)
  }

  addNewSection(sectionTitle: string) {
    this._directions.transform((current) => [
      ...current,
      { sectionTitle, steps: [], editStep: null },
    ])
  }

  updateSectionTitle(sectionTitle: string) {
    const index = this._editSection.get()
    if (index == null) return

    this._directions.transform((current) =>
      current.map((section, i) => (i === index ? { ...section, sectionTitle } : section))
    )
    this._editSection.set(null)
  }

  deleteSection(sectionIndex: number) {
    this._directions.transform((current) =>
      current.filter((_, i) => i !== sectionIndex)
    )
  }

  addNewStep(sectionIndex: number, stepText: string) {
    this._directions.transform((current) =>
      current.map((section, i) =>
        i === sectionIndex ? { ...section, steps: [...section.steps, stepText] } : section
      )
    )
  }

  deleteStep(sectionIndex: number, indexOfStep: number) {
    this._directions.transform((current) =>
      current.map((section, i) =>
        i === sectionIndex
          ? { ...section, steps: section.steps.filter((_, s) => s !== indexOfStep) }
          : section
      )
    )
  }

  /** Drag-and-drop reordering. Out-of-range indices are ignored. */
  moveStep(sectionIndex: number, from: number, to: number) {
    const section = this._directions.get()[sectionIndex]
    if (section == null || from === to) return
    if (from < 0 || from >= section.steps.length) return
    if (to < 0 || to >= section.steps.length) return
    this._moveStep(sectionIndex, from, to)
  }

  moveStepUpOne(sectionIndex: number, indexOfStep: number) {
    if (indexOfStep === 0) return
    this._moveStep(sectionIndex, indexOfStep, indexOfStep - 1)
  }

  moveStepDownOne(sectionIndex: number, indexOfStep: number) {
    const section = this._directions.get()[sectionIndex]
    if (section == null || indexOfStep === section.steps.length - 1) return
    this._moveStep(sectionIndex, indexOfStep, indexOfStep + 1)
  }

  private _moveStep(sectionIndex: number, from: number, to: number) {
    this._directions.transform((current) =>
      current.map((section, i) => {
        if (i !== sectionIndex) return section
        const steps = section.steps.slice()
        const [moved] = steps.splice(from, 1)
        steps.splice(to, 0, moved)
        return { ...section, steps }
      })
    )
  }

  setEditStep(sectionIndex: number, stepIndex: number) {
    this._setEditStep(sectionIndex, stepIndex)
  }

  clearEditStep(sectionIndex: number) {
    this._setEditStep(sectionIndex, null)
  }

  private _setEditStep(sectionIndex: number, editStep: number | null) {
    this._directions.transform((current) =>
      current.map((section, i) => (i === sectionIndex ? { ...section, editStep } : section))
    )
  }

  /** `values` is the react-final-form state; the step field is `nextStep-{i}`. */
  updateSectionStep(sectionIndex: number, values: Record<string, unknown>) {
    const section = this._directions.get()[sectionIndex]
    if (section == null || section.editStep == null) return

    const stepIndex = section.editStep
    const nextText = String(values[`nextStep-${sectionIndex}`] ?? "")

    this._directions.transform((current) =>
      current.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              steps: s.steps.map((step, si) => (si === stepIndex ? nextText : step)),
              editStep: null,
            }
          : s
      )
    )
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Loads an existing recipe into the editor. */
  loadRecipe(recipe: Recipe) {
    this._id = recipe.id ?? null
    this._title = recipe.title
    this._directions.set(
      (recipe.directions ?? []).map((section) => ({ ...section, editStep: null }))
    )
    this._ingredients.set((recipe.ingredients ?? []).slice())
  }

  /** Clears the editor back to a blank recipe. */
  reset() {
    // The old `generateNewRecipe` set this to `""`, which is non-null and sent
    // the next submit down the "update existing recipe" path with an empty id.
    this._id = null
    this._title = ""
    this._imageUrl.set(null)
    this._imageFile.set(null)
    this._directions.set([])
    this._ingredients.set([])
    this._editSection.set(null)
    this._editIngredient.set(EMPTY_INGREDIENT)
  }

  dispose() {
    this._imageFile.dispose()
    this._imageUrl.dispose()
    this._ingredients.dispose()
    this._directions.dispose()
    this._editIngredient.dispose()
    this._editSection.dispose()
    this._loadingRecipeImage.dispose()
  }
}
