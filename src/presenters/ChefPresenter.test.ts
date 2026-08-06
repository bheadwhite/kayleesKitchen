import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChefPresenter } from "./ChefPresenter"
import { recipeFingerprint } from "@/recipeFingerprint"
import type { ChefRequest, ChefResponse } from "@/ai/types"
import type { ChefStore } from "./ChefPresenter"
import type { ChefFork, ChefVariant, Recipe, RecipeYield } from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("fire/services", () => ({
  onRecipeVariantsSnapshot: vi.fn(() => () => {}),
  onRecipeYieldSnapshot: vi.fn(() => () => {}),
  saveRecipeVariant: vi.fn().mockResolvedValue(undefined),
  deleteRecipeVariant: vi.fn().mockResolvedValue(undefined),
}))

const CARBONARA: Recipe = {
  id: "carbonara",
  title: "Carbonara",
  email: "lauren@example.test",
  ingredients: [{ name: "farfalle", amount: "6oz" }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta."] }],
}

const CHILLI: Recipe = {
  id: "chilli",
  title: "Chilli",
  email: "lisa@example.test",
  ingredients: [{ name: "beans", amount: "1 tin" }],
  directions: [{ sectionTitle: "", steps: ["Simmer."] }],
}

const DOUBLED: ChefFork = {
  title: "Carbonara",
  ingredients: [{ name: "farfalle", amount: "12oz", optional: false, unique: false }],
  directions: [{ sectionTitle: "", steps: ["Boil the pasta in a wide pot."] }],
  serves: 8,
  baseServes: 4,
  summary: "Doubled. Use a wider pot so it does not steam.",
  label: "Feeds 8",
}

const KEPT: ChefVariant = {
  ...DOUBLED,
  id: "v1",
  email: "lauren@example.test",
  savedAt: new Date("2026-01-01"),
}

/** A store whose contents the test drives by hand. */
const store = () => {
  let emitVariants: (variants: ChefVariant[]) => void = () => {}
  let emitYield: (recipeYield: RecipeYield | null) => void = () => {}
  const stopped = vi.fn()
  const api: ChefStore & {
    emit: (v: ChefVariant[]) => void
    emitYield: (y: RecipeYield | null) => void
    stopped: typeof stopped
  } = {
    watchVariants: vi.fn((_id: string, callback: (v: ChefVariant[]) => void) => {
      emitVariants = callback
      return stopped
    }),
    watchYield: vi.fn((_id: string, callback: (y: RecipeYield | null) => void) => {
      emitYield = callback
      return stopped
    }),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    emit: (variants) => emitVariants(variants),
    emitYield: (recipeYield) => emitYield(recipeYield),
    stopped,
  }
  return api
}

const build = (
  ask: (request: ChefRequest) => Promise<ChefResponse>,
  chefStore: ChefStore = store()
) => new ChefPresenter(ask, chefStore)

const answer = (response: Partial<ChefResponse>) =>
  vi.fn().mockResolvedValue({ text: "…", fork: null, baseServes: null, ...response })

beforeEach(() => {
  sessionStorage.clear()
})

describe("ChefPresenter", () => {
  it("records both turns, the working copy, and the yield it scaled from", async () => {
    const ask = answer({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.send("double it")

    expect(presenter.getTurns()).toEqual([
      { role: "user", text: "double it" },
      { role: "assistant", text: "Doubled it." },
    ])
    expect(presenter.getFork()).toEqual(DOUBLED)
    expect(presenter.getBaseServes()).toBe(4)
  })

  it("sends the filed recipe and the copy on screen together", async () => {
    const ask = answer({ fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.send("double it")
    await presenter.send("and make it dairy-free")

    // The second turn still carries the recipe as filed — that is what every
    // scale is computed from — *and* the copy, so a follow-up lands on what the
    // cook is actually looking at rather than on the original.
    const second = ask.mock.calls[1][0] as ChefRequest
    expect(second.recipe.ingredients).toEqual([{ name: "farfalle", amount: "6oz" }])
    expect(second.fork).toEqual(DOUBLED)
  })

  it("takes the yield the chef most recently gave, so a correction sticks", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Three it is.", fork: null, baseServes: 3 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.send("how many does this feed?")
    expect(presenter.getBaseServes()).toBe(4)

    // "It feeds three in this house" — every later scale has to work from the
    // number they corrected it to, not the one the chef guessed first.
    await presenter.send("it only feeds three of us")
    expect(presenter.getBaseServes()).toBe(3)
  })

  it("strips the editor's transient state out of the recipe it sends", async () => {
    const ask = answer({})
    const presenter = build(ask)
    presenter.openFor({
      ...CARBONARA,
      directions: [{ sectionTitle: "", steps: ["Boil."], editStep: 0 }],
    })

    await presenter.send("how long does this keep?")

    // `editStep` says which row an editor has open. Sent along, it would come
    // back on a fork and reopen an editor on a page that has none.
    expect((ask.mock.calls[0][0] as ChefRequest).recipe.directions).toEqual([
      { sectionTitle: "", steps: ["Boil."] },
    ])
  })

  it("asks for a whole number of people and phrases it as a question", async () => {
    const ask = answer({ fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.scaleTo(8)

    // It belongs in the transcript as something asked, because the reply
    // explaining what would not scale cleanly has to be a reply to something.
    expect(presenter.getTurns()[0]).toEqual({
      role: "user",
      text: "Give me a version that feeds 8.",
    })
  })

  it("refuses a nonsense number of people without spending a call", async () => {
    const ask = answer({})
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.scaleTo(0)

    expect(ask).not.toHaveBeenCalled()
  })

  it("drops the question again when the call fails, so a retry asks it once", async () => {
    const presenter = build(vi.fn().mockRejectedValue(new Error("network")))
    presenter.openFor(CARBONARA)

    await expect(presenter.send("double it")).rejects.toThrow("network")
    expect(presenter.getTurns()).toEqual([])
  })

  it("keeps the conversation while the recipe underneath is edited", async () => {
    const presenter = build(answer({ fork: DOUBLED, baseServes: 4 }))
    presenter.openFor(CARBONARA)
    await presenter.send("double it")

    // The list is a live snapshot: its owner fixing a typo must not throw away
    // the conversation someone else is cooking from.
    presenter.openFor({ ...CARBONARA, title: "Carbonara (Lauren's)" })

    expect(presenter.getFork()).toEqual(DOUBLED)
    expect(presenter.getTurns()).toHaveLength(2)
  })

  it("starts over when a different recipe is opened", async () => {
    const presenter = build(answer({ fork: DOUBLED, baseServes: 4 }))
    presenter.openFor(CARBONARA)
    await presenter.send("double it")

    presenter.openFor(CHILLI)

    expect(presenter.getFork()).toBeNull()
    expect(presenter.getBaseServes()).toBeNull()
    expect(presenter.getTurns()).toEqual([])
  })

  it("drops the copy but keeps the conversation on discard", async () => {
    const presenter = build(answer({ fork: DOUBLED, baseServes: 4 }))
    presenter.openFor(CARBONARA)
    await presenter.send("double it")

    presenter.discardFork()

    expect(presenter.getFork()).toBeNull()
    // The yield is what the chef read off the recipe, not part of the copy —
    // throwing the copy away must not mean asking "how many" all over again.
    expect(presenter.getBaseServes()).toBe(4)
    expect(presenter.getTurns()).toHaveLength(2)
  })

  it("survives a reload, because a phone locks itself mid-recipe", async () => {
    const first = build(answer({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 }))
    first.openFor(CARBONARA)
    await first.send("double it")

    // A fresh presenter is what a reload produces.
    const second = build(answer({}))
    second.openFor(CARBONARA)

    expect(second.getFork()).toEqual(DOUBLED)
    expect(second.getBaseServes()).toBe(4)
    expect(second.getTurns()).toHaveLength(2)
  })

  it("does not hand one recipe's copy to another", async () => {
    const first = build(answer({ fork: DOUBLED, baseServes: 4 }))
    first.openFor(CARBONARA)
    await first.send("double it")

    const second = build(answer({}))
    second.openFor(CHILLI)

    expect(second.getFork()).toBeNull()
  })

  it("seeds the servings control from the copy, falling back to the recipe", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Doubled it.", fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    // Nothing to count from until the chef has read a yield off the recipe.
    expect(presenter.getServes()).toBeNull()

    await presenter.send("how many does this feed?")
    expect(presenter.getServes()).toBe(4)

    // Once there is a copy, the stepper reads *its* yield — that is what is on
    // the plate.
    await presenter.scaleTo(8)
    expect(presenter.getServes()).toBe(8)
  })

  /* -------------------------------------------------------- saved copies */

  it("watches the open recipe's saved copies, and stops when you leave it", () => {
    const variants = store()
    const presenter = build(answer({}), variants)

    presenter.openFor(CARBONARA)
    expect(variants.watchVariants).toHaveBeenCalledWith("carbonara", expect.any(Function))

    variants.emit([KEPT])
    expect(presenter.getVariants()).toEqual([KEPT])

    // Held, not left to the garbage collector — an unstored subscription in
    // this library is collected mid-session and silently stops firing.
    presenter.openFor(CHILLI)
    expect(variants.stopped).toHaveBeenCalled()
    expect(variants.watchVariants).toHaveBeenLastCalledWith("chilli", expect.any(Function))
  })

  it("keeps the copy on screen under the name the chef gave it", async () => {
    const variants = store()
    const presenter = build(answer({ fork: DOUBLED, baseServes: 4 }), variants)
    presenter.openFor(CARBONARA)
    await presenter.send("double it")

    expect(presenter.getSavedAs()).toBeNull()

    await presenter.saveFork("lauren@example.test")

    expect(variants.save).toHaveBeenCalledWith("carbonara", DOUBLED, "lauren@example.test")
    // Optimistic, so the offer to keep it does not sit there a second time
    // while the listener catches up.
    expect(presenter.getSavedAs()).not.toBeNull()
  })

  it("loads a kept copy without asking the chef anything", () => {
    const variants = store()
    const ask = answer({})
    const presenter = build(ask, variants)
    presenter.openFor(CARBONARA)
    variants.emit([KEPT])

    presenter.useVariant(KEPT)

    // The whole point: the second time you want this, it costs a read.
    expect(ask).not.toHaveBeenCalled()
    expect(presenter.getFork()).toEqual(DOUBLED)
    expect(presenter.getSavedAs()).toBe("v1")
    // The yield comes with it, so the stepper is usable straight away rather
    // than asking the chef what the recipe makes all over again.
    expect(presenter.getBaseServes()).toBe(4)
    expect(presenter.getServes()).toBe(8)
  })

  it("offers to keep a fresh copy even when a kept one was loaded first", async () => {
    const variants = store()
    const presenter = build(answer({ fork: DOUBLED, baseServes: 4 }), variants)
    presenter.openFor(CARBONARA)
    presenter.useVariant(KEPT)
    expect(presenter.getSavedAs()).toBe("v1")

    await presenter.send("now make it dairy-free")

    // What the chef just handed back is nobody's saved copy yet.
    expect(presenter.getSavedAs()).toBeNull()
  })

  it("clears the screen when the copy it is showing is forgotten", async () => {
    const variants = store()
    const presenter = build(answer({}), variants)
    presenter.openFor(CARBONARA)
    presenter.useVariant(KEPT)

    await presenter.forgetVariant("v1")

    expect(variants.remove).toHaveBeenCalledWith("carbonara", "v1")
    expect(presenter.getFork()).toBeNull()
    expect(presenter.getSavedAs()).toBeNull()
  })

  it("leaves the screen alone when some other copy is forgotten", async () => {
    const variants = store()
    const presenter = build(answer({}), variants)
    presenter.openFor(CARBONARA)
    presenter.useVariant(KEPT)

    await presenter.forgetVariant("v2")

    expect(presenter.getFork()).toEqual(DOUBLED)
  })

  it("remembers across a reload which kept copy is loaded", () => {
    const first = build(answer({}), store())
    first.openFor(CARBONARA)
    first.useVariant(KEPT)

    const second = build(answer({}), store())
    second.openFor(CARBONARA)

    // Otherwise a reload offers to keep a copy that is already kept, and a
    // second press files a duplicate.
    expect(second.getSavedAs()).toBe("v1")
  })

  /* --------------------------------------------------- the settled yield */

  it("takes the stored yield, so nobody pays to ask a second time", () => {
    const chefStore = store()
    const ask = answer({})
    const presenter = build(ask, chefStore)
    presenter.openFor(CARBONARA)

    chefStore.emitYield({
      baseServes: 4,
      basis: "A pound of pasta and two eggs.",
      fingerprint: recipeFingerprint(CARBONARA),
    })

    // The servings control is live with no call at all — which is the whole
    // point of having stored it.
    expect(ask).not.toHaveBeenCalled()
    expect(presenter.getBaseServes()).toBe(4)
    expect(presenter.getYield()?.basis).toBe("A pound of pasta and two eggs.")
  })

  it("ignores a yield worked out from a recipe that has since changed", () => {
    const chefStore = store()
    const presenter = build(answer({}), chefStore)
    presenter.openFor(CARBONARA)

    chefStore.emitYield({
      baseServes: 4,
      basis: "A pound of pasta.",
      fingerprint: recipeFingerprint({ ingredients: [{ name: "farfalle", amount: "12oz" }] }),
    })

    // "Until someone changes the recipe it was based on" — enforced by
    // comparing the stamp, so a stale figure is never shown rather than being
    // swept up later by something that might not run.
    expect(presenter.getBaseServes()).toBeNull()
    expect(presenter.getYield()).toBeNull()
  })

  it("drops a stored yield the moment the recipe under it is edited", () => {
    const chefStore = store()
    const presenter = build(answer({}), chefStore)
    presenter.openFor(CARBONARA)
    chefStore.emitYield({
      baseServes: 4,
      basis: "A pound of pasta.",
      fingerprint: recipeFingerprint(CARBONARA),
    })
    expect(presenter.getYield()).not.toBeNull()

    // The list is a live snapshot: the owner doubling the pasta lands here
    // without the recipe being reopened.
    presenter.openFor({ ...CARBONARA, ingredients: [{ name: "farfalle", amount: "12oz" }] })

    expect(presenter.getYield()).toBeNull()
  })

  it("does not let a stored figure overwrite one settled in this conversation", async () => {
    const chefStore = store()
    const presenter = build(answer({ baseServes: 3 }), chefStore)
    presenter.openFor(CARBONARA)

    // "It only feeds three in this house."
    await presenter.send("it only feeds three of us")
    expect(presenter.getBaseServes()).toBe(3)

    chefStore.emitYield({
      baseServes: 4,
      basis: "A pound of pasta.",
      fingerprint: recipeFingerprint(CARBONARA),
    })

    expect(presenter.getBaseServes()).toBe(3)
  })

  it("tells the callable which recipe to look the yield up under", async () => {
    const ask = answer({})
    const presenter = build(ask, store())
    presenter.openFor(CARBONARA)

    await presenter.send("how many does this feed?")

    expect((ask.mock.calls[0][0] as ChefRequest).recipeId).toBe("carbonara")
  })

  /* ---------------------------------------------------------- doubling */

  it("doubles in one tap once the yield is known", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Doubled.", fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)
    await presenter.send("how many does this feed?")

    await presenter.double()

    // The ordinary scale path, so the transcript reads no differently.
    expect(presenter.getTurns()[2]).toEqual({
      role: "user",
      text: "Give me a version that feeds 8.",
    })
  })

  it("doubles without needing the yield worked out first", async () => {
    const ask = answer({ fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)

    await presenter.double()

    // "Twice the recipe" is a complete instruction on its own — making it wait
    // behind the yield question would be a model call to enable a model call.
    expect(ask).toHaveBeenCalledTimes(1)
    expect(presenter.getTurns()[0]).toEqual({ role: "user", text: "Double the recipe." })
  })

  it("doubles the filed recipe, never the copy already on screen", async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ text: "About four.", fork: null, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Doubled.", fork: DOUBLED, baseServes: 4 })
      .mockResolvedValueOnce({ text: "Still doubled.", fork: DOUBLED, baseServes: 4 })
    const presenter = build(ask)
    presenter.openFor(CARBONARA)
    await presenter.send("how many does this feed?")
    await presenter.double()

    await presenter.double()

    // Not sixteen. "Double it" names a relationship to the real recipe, and
    // compounding would make one button mean two different things.
    expect(presenter.getTurns()[4]).toEqual({
      role: "user",
      text: "Give me a version that feeds 8.",
    })
  })

  it("still uses a yield stored before serving sizes existed", () => {
    const chefStore = store()
    const presenter = build(answer({}), chefStore)
    presenter.openFor(CARBONARA)

    // What every entry written before the field existed looks like.
    chefStore.emitYield({
      baseServes: 4,
      basis: "A pound of pasta.",
      fingerprint: recipeFingerprint(CARBONARA),
    })

    // The count is still worth having — throwing it away to force a re-ask
    // would spend a model call to recover something already in hand.
    expect(presenter.getBaseServes()).toBe(4)
    expect(presenter.getYield()?.servingSize).toBeUndefined()
  })
})
