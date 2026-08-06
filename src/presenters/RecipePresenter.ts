import { Signal } from "@tcn/state/core"

import type { RecipeBaseline } from "@/recipeDiff"
import type { DirectionSection, Ingredient, Recipe } from "@/types"

const EMPTY_INGREDIENT: Ingredient = {
  name: "",
  amount: "",
  optional: false,
  unique: false,
}

/** Enough to describe a dish; past this a tag list stops narrowing anything. */
const MAX_TAGS = 12

/** Lowercase, trimmed, and single-spaced — see `addTag`. */
export const normaliseTag = (raw: string) => raw.trim().replace(/\s+/g, " ").toLowerCase()

/**
 * Owns everything the recipe editor manipulates. A direct port of the old
 * `RecipeController`, with `StatefulSubject` swapped for `Signal` and
 * `onXChange(cb)` replaced by public `.broadcast` getters.
 */
export class RecipePresenter {
  private _id: string | null = null
  private _title = ""
  /**
   * What the recipe looked like when it was last loaded or saved. Null for an
   * unsaved recipe — there is nothing to be different from yet.
   *
   * Not a Signal: it changes only on load and on save, both of which already
   * move something the editor is subscribed to.
   */
  private _baseline: RecipeBaseline | null = null

  private readonly _directions = new Signal<DirectionSection[]>([])
  private readonly _ingredients = new Signal<Ingredient[]>([])
  private readonly _tags = new Signal<string[]>([])
  private readonly _imageUrl = new Signal<string | null>(null)
  private readonly _imageFile = new Signal<File | null>(null)
  // The row being edited in place, by position. An earlier version held a copy
  // of the ingredient and looked it up again by name on save, which edited the
  // wrong row whenever a recipe listed the same name twice.
  private readonly _editIngredientIndex = new Signal<number | null>(null)
  private readonly _editSection = new Signal<number | null>(null)
  private readonly _loadingRecipeImage = new Signal(false)

  get directionsBroadcast() {
    return this._directions.broadcast
  }

  get ingredientsBroadcast() {
    return this._ingredients.broadcast
  }

  get tagsBroadcast() {
    return this._tags.broadcast
  }

  get imageUrlBroadcast() {
    return this._imageUrl.broadcast
  }

  get editIngredientIndexBroadcast() {
    return this._editIngredientIndex.broadcast
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

  getBaseline() {
    return this._baseline
  }

  /**
   * Called after a successful save: what is on the screen becomes the new
   * "unchanged". Takes the title because the form owns that field — the
   * presenter's copy is written on every keystroke but is not what was
   * submitted.
   */
  markSaved(title: string, hasImage: boolean) {
    this._title = title
    this._baseline = {
      title,
      ingredients: this._ingredients.get().map((ingredient) => ({ ...ingredient })),
      directions: this._directions.get().map((section) => ({
        ...section,
        steps: section.steps.slice(),
      })),
      tags: this._tags.get().slice(),
      hasImage,
    }
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

  getEditIngredientIndex() {
    return this._editIngredientIndex.get()
  }

  /** The ingredient being edited, or a blank one when no row is open. */
  getEditIngredient(): Ingredient {
    const index = this._editIngredientIndex.get()
    if (index == null) return EMPTY_INGREDIENT
    return this._ingredients.get()[index] ?? EMPTY_INGREDIENT
  }

  /** Opens a row for editing. An index with no ingredient behind it closes it. */
  setEditIngredientIndex(index: number | null) {
    const exists = index != null && this._ingredients.get()[index] != null
    this._editIngredientIndex.set(exists ? index : null)
  }

  clearEditIngredient() {
    this._editIngredientIndex.set(null)
  }

  addIngredient({ name, amount, unique, optional }: Ingredient) {
    this._ingredients.transform((current) => [
      ...current,
      { name, amount, unique, optional },
    ])
  }

  updateIngredient({ name, amount, unique, optional }: Ingredient) {
    const index = this._editIngredientIndex.get()

    // Guard against a stale target: the old controller's `splice(-1, 1, ...)`
    // silently overwrote the last ingredient when the edit target had gone away.
    if (index == null || this._ingredients.get()[index] == null) {
      this.clearEditIngredient()
      return
    }

    this._ingredients.transform((current) =>
      current.map((ingredient, i) =>
        i === index ? { name, amount, unique, optional } : ingredient
      )
    )
    this.clearEditIngredient()
  }

  deleteIngredient(index: number) {
    this._ingredients.transform((current) => current.filter((_, i) => i !== index))
    // Every row below the deleted one shifts up, so an open editor would be
    // pointing at the wrong ingredient. Close it rather than re-aim it.
    this.clearEditIngredient()
  }

  /* ----------------------------------------------------------------- tags */

  getTags() {
    return this._tags.get()
  }

  /**
   * Normalised on the way in, never on the way out: "  Mexican " and "mexican"
   * are the same label, and a list that holds both filters as two. The cap is
   * there because a recipe wearing forty labels is not filterable by any of
   * them — it is a second copy of the ingredient list.
   */
  addTag(raw: string) {
    const tag = normaliseTag(raw)
    if (tag === "") return

    this._tags.transform((current) =>
      current.includes(tag) || current.length >= MAX_TAGS ? current : [...current, tag]
    )
  }

  removeTag(tag: string) {
    this._tags.transform((current) => current.filter((t) => t !== tag))
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

  /**
   * Loads a recipe into the editor.
   *
   * `asSaved` is what separates the two callers. Opening a stored recipe means
   * what arrives *is* the saved version, so it becomes the baseline and nothing
   * reads as changed. Applying an assistant draft is the opposite: the draft is
   * a pile of unsaved edits, and re-basing on it would hide precisely the
   * changes someone would want to look over before pressing Update.
   */
  loadRecipe(recipe: Recipe, { asSaved = true }: { asSaved?: boolean } = {}) {
    this._id = recipe.id ?? null
    this._title = recipe.title
    this._directions.set(
      (recipe.directions ?? []).map((section) => ({ ...section, editStep: null }))
    )
    this._ingredients.set((recipe.ingredients ?? []).slice())
    // Normalised on load too: tags written before the rule existed, or by hand
    // in the console, should not filter differently from ones typed today.
    this._tags.set(
      Array.from(new Set((recipe.tags ?? []).map(normaliseTag).filter(Boolean))).slice(
        0,
        MAX_TAGS
      )
    )
    // A row left open would now be pointing into a different recipe's list.
    this._editIngredientIndex.set(null)
    this._editSection.set(null)
    // `image` is a stored URL on the recipe; the editor's own preview URL is a
    // different string for the same file, so only its presence is remembered —
    // see `RecipeBaseline`.
    if (asSaved) this.markSaved(recipe.title, Boolean(recipe.image))
  }

  /** Clears the editor back to a blank recipe. */
  reset() {
    // The old `generateNewRecipe` set this to `""`, which is non-null and sent
    // the next submit down the "update existing recipe" path with an empty id.
    this._id = null
    this._title = ""
    this._baseline = null
    this._imageUrl.set(null)
    this._imageFile.set(null)
    this._directions.set([])
    this._ingredients.set([])
    this._tags.set([])
    this._editSection.set(null)
    this._editIngredientIndex.set(null)
  }

  dispose() {
    this._imageFile.dispose()
    this._imageUrl.dispose()
    this._ingredients.dispose()
    this._directions.dispose()
    this._tags.dispose()
    this._editIngredientIndex.dispose()
    this._editSection.dispose()
    this._loadingRecipeImage.dispose()
  }
}
