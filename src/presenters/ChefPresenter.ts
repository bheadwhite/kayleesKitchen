import { Runner, Signal } from "@tcn/state/core"

import { askChef } from "@/ai/chef"
import type { ChefRequest, ChefResponse, ChefTurn } from "@/ai/types"
import {
  deleteRecipeVariant,
  onRecipeVariantsSnapshot,
  onRecipeYieldSnapshot,
  saveRecipeVariant,
} from "fire/services"
import { recipeFingerprint } from "@/recipeFingerprint"
import type { ChefFork, ChefVariant, Recipe, RecipeDraft, RecipeYield } from "@/types"

type Ask = (request: ChefRequest) => Promise<ChefResponse>

/**
 * Everything the chef keeps beside a recipe, injectable so tests never reach
 * Firestore. One object rather than four constructor arguments — they are
 * always supplied together and always by the same backend.
 */
export interface ChefStore {
  watchVariants: (
    recipeId: string,
    callback: (variants: ChefVariant[]) => void
  ) => () => void
  watchYield: (
    recipeId: string,
    callback: (recipeYield: RecipeYield | null) => void
  ) => () => void
  save: (recipeId: string, fork: ChefFork, email: string | null) => Promise<unknown>
  remove: (recipeId: string, variantId: string) => Promise<unknown>
}

const FIRESTORE_CHEF_STORE: ChefStore = {
  watchVariants: onRecipeVariantsSnapshot,
  watchYield: onRecipeYieldSnapshot,
  save: saveRecipeVariant,
  remove: deleteRecipeVariant,
}

const EMPTY: RecipeDraft = { title: "", ingredients: [], directions: [] }

/** What survives a reload. The recipe itself is re-read from Firestore. */
interface StoredSession {
  turns: ChefTurn[]
  fork: ChefFork | null
  baseServes: number | null
  /** Which saved copy is loaded, if the copy came from one. */
  savedAs: string | null
}

const storageKey = (recipeId: string) => `chef:${recipeId}`

/** A transcript is short text; anything near this is a bug, not a conversation. */
const MAX_STORED_BYTES = 200_000

/**
 * The recipe as the chef needs to see it — the three parts it reasons about,
 * with the editor's transient `editStep` stripped. A fork built from a section
 * carrying `editStep` would reopen an editor on the recipe page, where there
 * isn't one.
 */
const toDraft = (recipe: Recipe): RecipeDraft => ({
  title: recipe.title,
  ingredients: recipe.ingredients ?? [],
  directions: (recipe.directions ?? []).map(({ sectionTitle, steps }) => ({
    sectionTitle,
    steps,
  })),
})

/**
 * The conversation with the chef about one recipe, and the working copy it
 * hands back.
 *
 * The fork is **never written anywhere**. It replaces what the recipe page
 * renders for as long as you are cooking from it, and the filed recipe is
 * untouched underneath — which is what makes it safe to offer on somebody
 * else's recipe as readily as your own.
 *
 * It does survive a reload, though, through `sessionStorage`. An installed PWA
 * is resumed rather than cold-started and a phone locks itself mid-recipe; a
 * doubled ingredient list that evaporates while the oven is preheating is worse
 * than not having offered to double it.
 */
export class ChefPresenter {
  private readonly _turns = new Signal<ChefTurn[]>([])
  private readonly _fork = new Signal<ChefFork | null>(null)
  private readonly _baseServes = new Signal<number | null>(null)
  private readonly _variants = new Signal<ChefVariant[]>([])
  /** The stored yield, but only while it still describes the recipe in hand. */
  private readonly _yield = new Signal<RecipeYield | null>(null)
  /** The saved copy the current fork came from, or was just kept as. */
  private readonly _savedAs = new Signal<string | null>(null)
  private readonly _askRunner = new Runner<void>(undefined)
  private readonly _saveRunner = new Runner<void>(undefined)

  /** Which recipe this conversation is about. A different one starts over. */
  private recipeId: string | null = null
  /** The filed recipe, refreshed from the live snapshot on every `openFor`. */
  private recipe: RecipeDraft = EMPTY
  /** Live listeners over this recipe's saved copies and its settled yield. */
  private stopWatching: Array<() => void> = []
  /** The yield as stored, before the fingerprint check. */
  private storedYield: RecipeYield | null = null
  /** What the recipe document itself says it makes. Beats `storedYield`. */
  private authored: { serves: number | null; servingSize: string | null } = {
    serves: null,
    servingSize: null,
  }

  constructor(
    private readonly ask: Ask = askChef,
    private readonly store: ChefStore = FIRESTORE_CHEF_STORE
  ) {}

  get turnsBroadcast() {
    return this._turns.broadcast
  }

  get forkBroadcast() {
    return this._fork.broadcast
  }

  get baseServesBroadcast() {
    return this._baseServes.broadcast
  }

  get variantsBroadcast() {
    return this._variants.broadcast
  }

  get savedAsBroadcast() {
    return this._savedAs.broadcast
  }

  get yieldBroadcast() {
    return this._yield.broadcast
  }

  get askRunnerBroadcast() {
    return this._askRunner.stateBroadcast
  }

  get saveRunnerBroadcast() {
    return this._saveRunner.stateBroadcast
  }

  getTurns() {
    return this._turns.get()
  }

  getFork() {
    return this._fork.get()
  }

  getBaseServes() {
    return this._baseServes.get()
  }

  getVariants() {
    return this._variants.get()
  }

  getSavedAs() {
    return this._savedAs.get()
  }

  getYield() {
    return this._yield.get()
  }

  /** What the servings stepper should start on: the copy's yield, or the base. */
  getServes() {
    return this._fork.get()?.serves ?? this._baseServes.get()
  }

  /* ------------------------------------------------------------- the recipe */

  /**
   * Point the chef at a recipe.
   *
   * Safe to call on every render: the recipe body is refreshed each time (the
   * list is a live snapshot, and its owner may have edited it), but the
   * conversation is only thrown away when the *id* changes. Resetting on any
   * change would drop a conversation because someone fixed a typo in it.
   */
  openFor(recipe: Recipe) {
    const id = recipe.id ?? null
    this.recipe = toDraft(recipe)
    // What the recipe itself claims, which outranks any estimate — see
    // `Recipe.serves`. Kept off `this.recipe`, which is the body the chef is
    // sent and must stay a plain `RecipeDraft`.
    this.authored = {
      serves: recipe.serves ?? null,
      servingSize: recipe.servingSize ?? null,
    }

    if (id === this.recipeId) {
      // The recipe body may have moved under us — the list is a live snapshot.
      // Re-check the stored yield against it, so an estimate for a version that
      // has since been edited stops being offered as this one's.
      this.applyStoredYield()
      return
    }

    this.recipeId = id
    this.clear()
    this.stopWatching.forEach((stop) => stop())
    this.stopWatching = []
    this.storedYield = null

    if (id != null) {
      this.restore(id)
      // Held, not left to the garbage collector — a subscription nobody stores
      // is WeakRef-collected mid-session and silently stops firing.
      this.stopWatching = [
        this.store.watchVariants(id, (variants) => this._variants.set(variants)),
        this.store.watchYield(id, (stored) => {
          this.storedYield = stored
          this.applyStoredYield()
        }),
      ]
    }

    // Unconditional: a recipe that states its own yield needs no watcher and no
    // estimate, and the servings control should be live before any snapshot
    // lands — including for a recipe with no id to watch.
    this.applyStoredYield()
  }

  /**
   * Takes the settled yield if it is still this recipe's.
   *
   * The fingerprint comparison is what "until someone changes the recipe" means
   * — the estimate is only served while the ingredients and method it was read
   * off are the ones on screen. Verified here as well as in the callable,
   * because the client is the one that skips the call entirely, and a number it
   * takes on trust is a number that can be wrong for as long as nobody asks.
   *
   * It only *fills* a blank. A figure already in hand this session came from the
   * model just now — possibly a correction the cook made — and outranks
   * anything stored.
   */
  private applyStoredYield() {
    const stored = this.storedYield
    const current =
      stored != null && stored.fingerprint === recipeFingerprint(this.recipe) ? stored : null

    this._yield.set(current)

    // **The recipe's own figure first.** A recipe that says what it makes needs
    // no estimate and no model call: the servings control is live the moment
    // the page opens, and "Scale to 8" counts from what a person wrote rather
    // than from what a model guessed. The estimate stays the fallback for the
    // recipes — most of them — that say nothing.
    const base = this.authored.serves ?? current?.baseServes ?? null
    if (base != null && this._baseServes.get() == null) this._baseServes.set(base)
  }

  /* --------------------------------------------------------------- asking */

  /**
   * Sends `text`, with the filed recipe and the current working copy alongside
   * it. Both go every time: the chef scales from what is filed so repeated
   * adjustments do not compound, but a follow-up like "make that dairy-free
   * too" has to land on the copy already on screen.
   */
  send(text: string) {
    const trimmed = text.trim()
    if (trimmed === "") return Promise.resolve()

    return this._askRunner.execute(async () => {
      const turns: ChefTurn[] = [...this._turns.get(), { role: "user", text: trimmed }]

      // Show the question immediately; the runner drives the pending state.
      this._turns.set(turns)

      try {
        const response = await this.ask({
          turns,
          recipe: this.recipe,
          fork: this._fork.get(),
          recipeId: this.recipeId,
          // Outranks the cached estimate the callable reads for itself, so the
          // chip on the page and the chef in the drawer cannot disagree.
          authored: this.authored,
        })
        this._turns.transform((current) => [
          ...current,
          { role: "assistant", text: response.text },
        ])
        if (response.fork) {
          this._fork.set(response.fork)
          // A copy the chef just made is not one anyone kept — the "save this
          // version" offer has to come back for it.
          this._savedAs.set(null)
        }
        // The latest reading wins rather than the first: the cook is allowed to
        // say "it feeds three in this house", and every later scale has to be
        // computed from the number they corrected it to.
        if (response.baseServes != null) this._baseServes.set(response.baseServes)
        this.persist()
      } catch (error) {
        // Drop the optimistic turn so a retry does not ask it twice.
        this._turns.transform((current) => current.slice(0, -1))
        throw error
      }
    })
  }

  /**
   * "Make it feed eight." Phrased as a message rather than sent as a number,
   * because it *is* one — it belongs in the transcript beside the answer, and
   * the reply explaining what would not scale cleanly has to have something to
   * be a reply to.
   */
  scaleTo(serves: number) {
    const wanted = Math.round(serves)
    if (!Number.isFinite(wanted) || wanted < 1) return Promise.resolve()
    return this.send(`Give me a version that feeds ${wanted}.`)
  }

  /**
   * Twice the filed recipe — the scale people actually ask for, in one tap.
   *
   * **Always twice what is filed, never twice the copy on screen.** Tapping it
   * with a doubled copy already loaded gives you that same doubled copy, not
   * four times the recipe; "double it" names a relationship to the real recipe,
   * and compounding would make pressing the same button twice mean two
   * different things.
   *
   * With the yield known this is an ordinary scale and goes through the same
   * path, so the transcript reads no differently. Without it, the request still
   * stands on its own — doubling is the one scaling instruction that does not
   * need to know what the recipe makes first, which is why the button is
   * offered before the yield has been worked out at all.
   */
  double() {
    const base = this._baseServes.get()
    return base == null ? this.send("Double the recipe.") : this.scaleTo(base * 2)
  }

  /** The one question whose answer the servings control cannot work without. */
  askYield() {
    return this.send("How many people does this feed?")
  }

  /* ---------------------------------------------------------- saved copies */

  /**
   * Keeps the copy on screen.
   *
   * This is the one thing here that reaches Firestore, and the reason it earns
   * that: "double it" is a question a household asks of the same recipe every
   * year, and the chef's answer does not change between askings. Keeping it
   * turns the second ask into a read.
   *
   * Named by the chef rather than by a dialog, so keeping one is a single tap —
   * a copy you have to stop and title is a copy you do not bother keeping, and
   * an untitled pile of them is no better than not having kept any.
   */
  saveFork(email: string | null) {
    const fork = this._fork.get()
    const recipeId = this.recipeId
    if (fork == null || recipeId == null) return Promise.resolve()

    return this._saveRunner.execute(async () => {
      await this.store.save(recipeId, fork, email)
      // Optimistic: the listener will bring back the real id a moment later,
      // and until then the offer to save must not still be on screen. Anything
      // non-null reads as "kept" to the view.
      this._savedAs.set(this._savedAs.get() ?? "pending")
      this.persist()
    })
  }

  /**
   * Loads a copy someone kept. **No model call** — that is the whole point of
   * having kept it. The yield comes along, so the servings stepper is usable
   * straight away rather than asking the chef what the recipe makes all over
   * again.
   */
  useVariant(variant: ChefVariant) {
    const { id, email: _email, savedAt: _savedAt, ...fork } = variant
    this._fork.set(fork)
    this._savedAs.set(id)
    this._baseServes.set(variant.baseServes)
    this.persist()
  }

  /** Forgets a kept copy. Clears the screen too if that is the one loaded. */
  forgetVariant(variantId: string) {
    const recipeId = this.recipeId
    if (recipeId == null) return Promise.resolve()
    if (this._savedAs.get() === variantId) this.discardFork()
    return this.store.remove(recipeId, variantId)
  }

  /* --------------------------------------------------------------- the fork */

  /** Back to the recipe as filed. The conversation stays — only the copy goes. */
  discardFork() {
    this._fork.set(null)
    this._savedAs.set(null)
    this.persist()
  }

  private clear() {
    this._turns.set([])
    this._fork.set(null)
    this._baseServes.set(null)
    this._savedAs.set(null)
    this._yield.set(null)
    // Not `_variants` — `openFor` re-subscribes, and blanking the row first
    // makes the saved copies flicker out and back on every recipe you open.
  }

  /** Throws the whole conversation away, copy included. */
  reset() {
    this.clear()
    if (this.recipeId != null) {
      try {
        sessionStorage.removeItem(storageKey(this.recipeId))
      } catch {
        // Same reasoning as `persist` — losing the copy is not worth an error.
      }
    }
  }

  /* ------------------------------------------------------------ persistence */

  private persist() {
    if (this.recipeId == null) return
    const stored: StoredSession = {
      turns: this._turns.get(),
      fork: this._fork.get(),
      baseServes: this._baseServes.get(),
      savedAs: this._savedAs.get(),
    }
    try {
      const json = JSON.stringify(stored)
      if (json.length > MAX_STORED_BYTES) return
      sessionStorage.setItem(storageKey(this.recipeId), json)
    } catch {
      // Storage can be full, or disabled outright (Safari private browsing).
      // Keeping the copy across a reload is a convenience; failing to save it
      // must not fail the answer the cook is currently reading.
    }
  }

  private restore(recipeId: string) {
    try {
      const raw = sessionStorage.getItem(storageKey(recipeId))
      if (raw == null) return
      const stored = JSON.parse(raw) as StoredSession
      if (!Array.isArray(stored?.turns)) return
      this._turns.set(stored.turns)
      // `label` is newer than the first stored sessions; a copy restored
      // without one would render a nameless chip.
      this._fork.set(
        stored.fork == null
          ? null
          : { ...stored.fork, label: stored.fork.label || `Feeds ${stored.fork.serves}` }
      )
      this._baseServes.set(stored.baseServes ?? null)
      this._savedAs.set(stored.savedAs ?? null)
    } catch {
      // Unreadable or from an older shape — start the conversation over rather
      // than render half of one.
    }
  }

  dispose() {
    this.stopWatching.forEach((stop) => stop())
    this.stopWatching = []
    this._turns.dispose()
    this._fork.dispose()
    this._baseServes.dispose()
    this._variants.dispose()
    this._yield.dispose()
    this._savedAs.dispose()
    this._askRunner.dispose()
    this._saveRunner.dispose()
  }
}
