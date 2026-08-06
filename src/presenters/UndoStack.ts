/**
 * Linear undo/redo over whole snapshots.
 *
 * Snapshots rather than commands because a recipe is small — a few dozen short
 * strings — and every mutation on `RecipePresenter` would otherwise need an
 * inverse written and kept correct. The memory this costs is not measurable
 * next to one photo.
 *
 * The rule worth stating: **recording an edit throws the redo stack away.**
 * After an undo there are two possible futures — the one you undid and the one
 * you just started typing — and nothing can reconcile them. The branch you
 * abandoned is unreachable, and pretending otherwise means a redo that puts
 * back a version of the recipe nobody was looking at.
 */
export class UndoStack<T> {
  private past: T[] = []
  private future: T[] = []

  /**
   * @param limit How many steps back to keep. Old entries fall off the bottom:
   *   an editor session left open for an afternoon should not grow without end,
   *   and nobody undoes two hundred steps.
   */
  constructor(private readonly limit = 50) {}

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }

  get depth() {
    return { undo: this.past.length, redo: this.future.length }
  }

  /** Call *before* mutating, with the state as it is about to stop being. */
  record(state: T) {
    this.past.push(state)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  /** Returns the state to restore, or undefined when there is nothing to undo. */
  undo(current: T): T | undefined {
    const previous = this.past.pop()
    if (previous === undefined) return undefined
    this.future.push(current)
    return previous
  }

  redo(current: T): T | undefined {
    const next = this.future.pop()
    if (next === undefined) return undefined
    this.past.push(current)
    return next
  }

  clear() {
    this.past = []
    this.future = []
  }
}
