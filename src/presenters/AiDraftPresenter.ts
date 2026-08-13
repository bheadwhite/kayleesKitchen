import { Runner, Signal } from "@tcn/state/core"

import { askRecipeAssistant, MAX_IMAGES, toAssistantImage } from "@/ai/recipeAssistant"
import type { AssistantImage, AssistantRequest, AssistantResponse, AssistantTurn } from "@/ai/types"
import type { AskContext, EditorDraft } from "@/ai/types"
import { normaliseTag } from "presenters/RecipePresenter"

type Ask = (request: AssistantRequest) => Promise<AssistantResponse>
type EncodeImage = (file: File) => Promise<AssistantImage>

/** A pending attachment, before it has been sent. */
export interface PendingImage {
  id: string
  file: File
  /** Object URL for the thumbnail. Revoked when the attachment is dropped. */
  previewUrl: string
}

/**
 * Owns the recipe-assistant conversation: the transcript, the photos staged for
 * the next message, and the draft the assistant most recently proposed.
 *
 * The proposed draft is deliberately *not* pushed into `RecipePresenter` — the
 * view applies it on an explicit user action, so an unwanted suggestion can
 * never clobber what someone is midway through typing.
 */
export class AiDraftPresenter {
  private readonly _turns = new Signal<AssistantTurn[]>([])
  private readonly _pendingImages = new Signal<PendingImage[]>([])
  private readonly _proposedDraft = new Signal<EditorDraft | null>(null)
  private readonly _rejected = new Signal<string[]>([])
  private readonly _categories = new Signal<string[]>([])
  private readonly _askRunner = new Runner<void>(undefined)
  private nextImageId = 0

  constructor(
    private readonly ask: Ask = askRecipeAssistant,
    private readonly encodeImage: EncodeImage = toAssistantImage
  ) {}

  get turnsBroadcast() {
    return this._turns.broadcast
  }

  get pendingImagesBroadcast() {
    return this._pendingImages.broadcast
  }

  get proposedDraftBroadcast() {
    return this._proposedDraft.broadcast
  }

  get rejectedBroadcast() {
    return this._rejected.broadcast
  }

  get categoriesBroadcast() {
    return this._categories.broadcast
  }

  get askRunnerBroadcast() {
    return this._askRunner.stateBroadcast
  }

  getTurns() {
    return this._turns.get()
  }

  getProposedDraft() {
    return this._proposedDraft.get()
  }

  getPendingImages() {
    return this._pendingImages.get()
  }

  getRejected() {
    return this._rejected.get()
  }

  getCategories() {
    return this._categories.get()
  }

  /* ------------------------------------------------------------ categories */

  /**
   * Picks a category to work inside, or drops one already picked.
   *
   * **Categories are the household's own tags**, not a second vocabulary. They
   * are what the recipe list filters on, so a suggestion asked for inside them
   * comes back wearing labels that already mean something here — and picking
   * from chips rather than typing is what stops "mexican", "Mexican" and
   * "mexican food" being three baselines.
   *
   * They hold until they are changed, which is what makes them a baseline
   * rather than one message's wording: the chef is sent them on every turn, so
   * a follow-up gets the same footing the first ask had.
   */
  toggleCategory(name: string) {
    const category = normaliseTag(name)
    if (category === "") return
    this._categories.transform((current) =>
      current.includes(category)
        ? current.filter((one) => one !== category)
        : [...current, category]
    )
  }

  clearCategories() {
    this._categories.set([])
  }

  /* ------------------------------------------------------------ attachments */

  /** Photos already sent. They ride along on every later turn, so they count. */
  private countSentImages() {
    return this._turns
      .get()
      .reduce((total, turn) => total + (turn.role === "user" ? turn.images.length : 0), 0)
  }

  /**
   * Stages photos for the next message. Returns the names of any files that
   * were rejected so the view can say which — silently dropping them looks
   * like the picker failed.
   *
   * The budget is `MAX_IMAGES` for the whole conversation, not per message,
   * because photos stay attached to their turn and are re-sent with every
   * later one. Counting only the pending batch let someone attach eight, send,
   * and attach eight more — and the callable, which counts across all turns,
   * then rejected the request *after* the upload.
   */
  attachImages(files: File[]): string[] {
    const rejected: string[] = []
    const room = MAX_IMAGES - this.countSentImages() - this._pendingImages.get().length

    const accepted = files.slice(0, Math.max(room, 0)).map((file) => ({
      id: `img-${this.nextImageId++}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    files.slice(Math.max(room, 0)).forEach((file) => rejected.push(file.name))
    if (accepted.length > 0) {
      this._pendingImages.transform((current) => [...current, ...accepted])
    }

    return rejected
  }

  removeImage(id: string) {
    const target = this._pendingImages.get().find((image) => image.id === id)
    if (target) URL.revokeObjectURL(target.previewUrl)
    this._pendingImages.transform((current) => current.filter((image) => image.id !== id))
  }

  private clearPendingImages() {
    this._pendingImages.get().forEach((image) => URL.revokeObjectURL(image.previewUrl))
    this._pendingImages.set([])
  }

  /* ------------------------------------------------------------------- ask */

  /**
   * Sends `text` plus any staged photos. `currentDraft` is what the editor holds
   * right now — tags included — so the assistant revises the real state rather
   * than its own recollection of it.
   *
   * `context` is what the editor already holds listeners for: the household's
   * tag vocabulary, sent so the chef reuses a tag that exists instead of coining
   * a near-duplicate, and every title in the recipe box, sent so an idea it
   * comes up with is one the household does not already have.
   */
  send(text: string, currentDraft: EditorDraft, context: AskContext = {}) {
    const trimmed = text.trim()
    const pending = this._pendingImages.get()
    if (trimmed === "" && pending.length === 0) return Promise.resolve()

    return this._askRunner.execute(async () => {
      const images = await Promise.all(pending.map(({ file }) => this.encodeImage(file)))
      const turn: AssistantTurn = { role: "user", text: trimmed, images }
      const turns = [...this._turns.get(), turn]

      // Show the user's turn immediately; the runner drives the pending state.
      this._turns.set(turns)
      this.clearPendingImages()

      try {
        const response = await this.ask({
          turns,
          currentDraft,
          tagLibrary: context.tagLibrary ?? [],
          recipeTitles: context.recipeTitles ?? [],
          // The baseline holds across the conversation, so it rides on every
          // turn rather than only the one that picked it.
          categories: this._categories.get(),
          // Carried on every turn, not just the one that rejects something: a
          // follow-up like "make it lighter" is still a request the turned-down
          // ideas are out of bounds for.
          rejected: this._rejected.get(),
        })
        this._turns.transform((current) => [
          ...current,
          { role: "assistant", text: response.text },
        ])
        if (response.draft) this._proposedDraft.set(response.draft)
      } catch (error) {
        // Drop the optimistic turn so a retry does not send it twice.
        this._turns.transform((current) => current.slice(0, -1))
        throw error
      }
    })
  }

  /**
   * "Not this one — something else."
   *
   * Turns the proposal down and asks for another idea in one press. The title
   * is remembered and rides along on every later request, because **the chef
   * cannot see its own past drafts**: a proposal reaches the model as a tool
   * call, and the transcript sent back carries only the sentences it wrote
   * beside it. Without a list, "something else" is answered by a model whose
   * only record of what it already offered is its own prose.
   *
   * Only ideas turned down this way are remembered — never every draft. A chef
   * barred from re-proposing a title it has used could not revise a recipe at
   * all, which is most of what it does here.
   *
   * The dish is named in the message as well as kept on the list. The list is
   * the constraint the prompt points at; the message is what makes the
   * transcript honest, so somebody scrolling back can see what they turned down
   * rather than a row of identical "something else"s.
   */
  rejectDraft(currentDraft: EditorDraft, context: AskContext = {}) {
    const draft = this._proposedDraft.get()
    if (draft == null) return Promise.resolve()

    const title = draft.title.trim()
    const known = title === "" || this._rejected.get().includes(title)
    if (!known) this._rejected.transform((current) => [...current, title])
    this._proposedDraft.set(null)

    return this.send(
      title === ""
        ? "Not that one — suggest something else."
        : `Not "${title}" — suggest something else.`,
      currentDraft,
      context
    ).catch((error) => {
      // A call that failed did not reject anything. Put the draft back — it may
      // still be the one they want to apply, and losing it to a dropped
      // connection would be the expensive half of a free action.
      this._proposedDraft.set(draft)
      if (!known) this._rejected.transform((current) => current.filter((t) => t !== title))
      throw error
    })
  }

  /** Called once the view has handed the draft to the recipe editor. */
  clearProposedDraft() {
    this._proposedDraft.set(null)
  }

  reset() {
    this.clearPendingImages()
    this._turns.set([])
    this._proposedDraft.set(null)
    this._rejected.set([])
    this._categories.set([])
  }

  dispose() {
    this.clearPendingImages()
    this._turns.dispose()
    this._pendingImages.dispose()
    this._proposedDraft.dispose()
    this._rejected.dispose()
    this._categories.dispose()
    this._askRunner.dispose()
  }
}
