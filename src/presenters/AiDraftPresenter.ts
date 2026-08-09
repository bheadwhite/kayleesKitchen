import { Runner, Signal } from "@tcn/state/core"

import { askRecipeAssistant, MAX_IMAGES, toAssistantImage } from "@/ai/recipeAssistant"
import type { AssistantImage, AssistantRequest, AssistantResponse, AssistantTurn } from "@/ai/types"
import type { EditorDraft } from "@/ai/types"

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
   * `tagLibrary` is the household's vocabulary, sent so the chef reuses a tag
   * that exists instead of coining a near-duplicate. It is what the recipe list
   * filters on, and three spellings of "salad" make three filters that each find
   * a third of the recipes.
   */
  send(text: string, currentDraft: EditorDraft, tagLibrary: string[] = []) {
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
        const response = await this.ask({ turns, currentDraft, tagLibrary })
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

  /** Called once the view has handed the draft to the recipe editor. */
  clearProposedDraft() {
    this._proposedDraft.set(null)
  }

  reset() {
    this.clearPendingImages()
    this._turns.set([])
    this._proposedDraft.set(null)
  }

  dispose() {
    this.clearPendingImages()
    this._turns.dispose()
    this._pendingImages.dispose()
    this._proposedDraft.dispose()
    this._askRunner.dispose()
  }
}
