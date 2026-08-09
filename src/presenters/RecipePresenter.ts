import { Signal } from "@tcn/state/core"

import { UndoStack } from "./UndoStack"
import type { RecipeBaseline } from "@/recipeDiff"
import type { DirectionSection, Ingredient, Recipe } from "@/types"

/**
 * One undo step: everything the editor owns that is worth taking back.
 *
 * The photo is not in here. Staging one uploads a file, so "undo" would have to
 * mean re-uploading or resurrecting a deleted object in Storage — a different
 * kind of operation with a different failure mode, and one the Delete/Regenerate
 * buttons already cover.
 */
interface EditorSnapshot {
  title: string
  /**
   * Carried like the title, and recorded like it too — which is to say never on
   * its own. Both are fields typed into character by character, and an undo
   * stack one keystroke deep is worse than none; being *in* the snapshot is
   * what makes undoing anything else put them back.
   */
  serves: number | null
  servingSize: string | null
  ingredients: Ingredient[]
  directions: DirectionSection[]
  tags: string[]
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

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

  private readonly _serves = new Signal<number | null>(null)
  private readonly _servingSize = new Signal<string | null>(null)
  private readonly _directions = new Signal<DirectionSection[]>([])
  private readonly _ingredients = new Signal<Ingredient[]>([])
  private readonly _tags = new Signal<string[]>([])
  private readonly _history = new UndoStack<EditorSnapshot>()
  private readonly _historyState = new Signal<HistoryState>({ canUndo: false, canRedo: false })
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

  get historyBroadcast() {
    return this._historyState.broadcast
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

  /* ------------------------------------------------------------- history */

  private _snapshot(): EditorSnapshot {
    return {
      title: this._title,
      serves: this._serves.get(),
      servingSize: this._servingSize.get(),
      ingredients: this._ingredients.get().map((ingredient) => ({ ...ingredient })),
      // `editStep` is deliberately dropped: which row happens to be open is not
      // an edit, and restoring it would reopen an editor nobody asked for.
      directions: this._directions.get().map(({ editStep: _editStep, ...section }) => ({
        ...section,
        steps: section.steps.slice(),
      })),
      tags: this._tags.get().slice(),
    }
  }

  /**
   * Every mutator calls this *first*, with the state it is about to replace.
   *
   * Typing in the title does not come through here — `setTitle` fires on every
   * keystroke, and an undo stack one character deep is useless. The title is
   * still carried *in* every snapshot, so undoing anything else (an applied
   * assistant draft, most of all) puts the title back with it, and a text input
   * has the browser's own undo while the cursor is in it.
   */
  private _record() {
    this._history.record(this._snapshot())
    this._publishHistory()
  }

  private _publishHistory() {
    this._historyState.set({
      canUndo: this._history.canUndo,
      canRedo: this._history.canRedo,
    })
  }

  private _restore(snapshot: EditorSnapshot) {
    this._title = snapshot.title
    this._serves.set(snapshot.serves)
    this._servingSize.set(snapshot.servingSize)
    this._ingredients.set(snapshot.ingredients)
    this._directions.set(snapshot.directions.map((section) => ({ ...section, editStep: null })))
    this._tags.set(snapshot.tags)
    // Both editors point at positions that may not exist in the restored list.
    this._editIngredientIndex.set(null)
    this._editSection.set(null)
    this._publishHistory()
  }

  undo() {
    const previous = this._history.undo(this._snapshot())
    if (previous === undefined) return false
    this._restore(previous)
    return true
  }

  redo() {
    const next = this._history.redo(this._snapshot())
    if (next === undefined) return false
    this._restore(next)
    return true
  }

  /* -------------------------------------------------------------- revert */

  /*
   * Putting one row back to what was saved, without touching the rest.
   *
   * All three go through `_record()` like any other edit, so a revert is itself
   * undoable — pressing it by accident on the wrong line must not be the one
   * action in this editor you cannot take back.
   *
   * A row the saved recipe does not have is *removed* rather than restored.
   * That is what reverting an addition means, and the alternative — refusing —
   * would leave the one kind of change an assistant makes most of with no way
   * back except the delete button beside it.
   */

  revertIngredient(index: number) {
    const baseline = this._baseline
    if (baseline == null) return
    const saved = baseline.ingredients[index]

    this._record()
    this._ingredients.transform((current) =>
      saved == null
        ? current.filter((_, i) => i !== index)
        : current.map((ingredient, i) => (i === index ? { ...saved } : ingredient))
    )
    this.clearEditIngredient()
  }

  revertStep(sectionIndex: number, stepIndex: number) {
    const baseline = this._baseline
    if (baseline == null) return
    const saved = baseline.directions[sectionIndex]?.steps[stepIndex]

    this._record()
    this._directions.transform((current) =>
      current.map((section, i) => {
        if (i !== sectionIndex) return section
        return {
          ...section,
          steps:
            saved == null
              ? section.steps.filter((_, s) => s !== stepIndex)
              : section.steps.map((step, s) => (s === stepIndex ? saved : step)),
          editStep: null,
        }
      })
    )
  }

  /** Only a *renamed* section: a new one has no saved title to go back to. */
  revertSectionTitle(sectionIndex: number) {
    const saved = this._baseline?.directions[sectionIndex]
    if (saved == null) return

    this._record()
    this._directions.transform((current) =>
      current.map((section, i) =>
        i === sectionIndex ? { ...section, sectionTitle: saved.sectionTitle } : section
      )
    )
    this._editSection.set(null)
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
      serves: this._serves.get(),
      servingSize: this._servingSize.get(),
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

  /* --------------------------------------------------------------- yield */

  get servesBroadcast() {
    return this._serves.broadcast
  }

  get servingSizeBroadcast() {
    return this._servingSize.broadcast
  }

  getServes() {
    return this._serves.get()
  }

  getServingSize() {
    return this._servingSize.get()
  }

  /**
   * How many the recipe feeds, as the recipe itself claims.
   *
   * Nothing is recorded on the undo stack, for the reason the title is not: it
   * is typed a digit at a time. Zero and anything unreadable clear it — the
   * absence of a figure is a real state, and "serves 0" is not.
   */
  setServes(serves: number | null) {
    const clean = serves == null || !Number.isFinite(serves) || serves <= 0
      ? null
      : Math.round(serves)
    this._serves.set(clean)
  }

  setServingSize(size: string | null) {
    const clean = (size ?? "").trim()
    this._servingSize.set(clean === "" ? null : clean)
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
    this._record()
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

    this._record()
    this._ingredients.transform((current) =>
      current.map((ingredient, i) =>
        i === index ? { name, amount, unique, optional } : ingredient
      )
    )
    this.clearEditIngredient()
  }

  deleteIngredient(index: number) {
    this._record()
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
    // Nothing is about to change, so nothing is worth an undo step: a rejected
    // duplicate that costs a press of Undo is a bug report waiting to happen.
    if (tag === "" || this._tags.get().includes(tag) || this._tags.get().length >= MAX_TAGS) {
      return
    }

    this._record()
    this._tags.transform((current) => [...current, tag])
  }

  removeTag(tag: string) {
    if (!this._tags.get().includes(tag)) return
    this._record()
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
    this._record()
    this._directions.transform((current) => [
      ...current,
      { sectionTitle, steps: [], editStep: null },
    ])
  }

  updateSectionTitle(sectionTitle: string) {
    const index = this._editSection.get()
    if (index == null) return

    this._record()
    this._directions.transform((current) =>
      current.map((section, i) => (i === index ? { ...section, sectionTitle } : section))
    )
    this._editSection.set(null)
  }

  deleteSection(sectionIndex: number) {
    this._record()
    this._directions.transform((current) =>
      current.filter((_, i) => i !== sectionIndex)
    )
  }

  addNewStep(sectionIndex: number, stepText: string) {
    this._record()
    this._directions.transform((current) =>
      current.map((section, i) =>
        i === sectionIndex ? { ...section, steps: [...section.steps, stepText] } : section
      )
    )
  }

  deleteStep(sectionIndex: number, indexOfStep: number) {
    this._record()
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
    this._record()
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

    this._record()
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
    // Opening a recipe is not an edit, so its history starts empty — undo must
    // not walk back into whatever was in the editor before. Applying a draft
    // *is* an edit, and one big enough to be the thing people most want to take
    // back, so it records a step like any other.
    if (asSaved) this._history.clear()
    else this._record()
    this._publishHistory()

    this._id = recipe.id ?? null
    this._title = recipe.title
    this.setServes(recipe.serves ?? null)
    this.setServingSize(recipe.servingSize ?? null)
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
    this._serves.set(null)
    this._servingSize.set(null)
    this._imageUrl.set(null)
    this._imageFile.set(null)
    this._directions.set([])
    this._ingredients.set([])
    this._tags.set([])
    this._editSection.set(null)
    this._editIngredientIndex.set(null)
    this._history.clear()
    this._publishHistory()
  }

  dispose() {
    this._serves.dispose()
    this._servingSize.dispose()
    this._imageFile.dispose()
    this._imageUrl.dispose()
    this._ingredients.dispose()
    this._directions.dispose()
    this._tags.dispose()
    this._editIngredientIndex.dispose()
    this._historyState.dispose()
    this._editSection.dispose()
    this._loadingRecipeImage.dispose()
  }
}
