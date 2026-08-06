import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlannerPresenter, type PlannerStore } from "./PlannerPresenter"
import { addDays, todayISO } from "@/calendar"
import { ingredientsFingerprint } from "@/recipeFingerprint"
import type { ScalingSpec } from "@/scaling"
import type {
  PlannedMeal,
  PlanningSession,
  Recipe,
  SessionInvite,
  SessionMember,
  ShoppingItem,
} from "@/types"

vi.mock("fire/firebase", () => ({ functions: {} }))
vi.mock("fire/services", () => ({}))

const TODAY = todayISO()

const ME: SessionMember = { uid: "u1", name: "Sam", email: "sam@example.test" }
const DEV: SessionMember = { uid: "u2", name: "Dev", email: "dev@example.test" }

const CHILLI: Recipe = {
  id: "chilli",
  title: "Chilli",
  ingredients: [
    { name: "ground beef", amount: "1 lb" },
    { name: "kosher salt", amount: "to taste" },
  ],
  directions: [{ sectionTitle: "", steps: ["Simmer."] }],
}

const PANCAKES: Recipe = {
  id: "pancakes",
  title: "Pancakes",
  ingredients: [{ name: "butter", amount: "1 cup" }],
  directions: [{ sectionTitle: "", steps: ["Whisk."] }],
}

const specFor = (recipe: Recipe): ScalingSpec => ({
  baseServes: 4,
  fingerprint: ingredientsFingerprint(recipe),
  lines: [
    { name: "ground beef", rule: "linear", qty: 1, unit: "lb", text: "1 lb" },
    { name: "kosher salt", rule: "fixed", text: "to taste" },
  ],
})

const session = (partial: Partial<PlanningSession> = {}): PlanningSession => ({
  id: "s1",
  name: "Weeknights",
  ownerUid: ME.uid,
  covers: 4,
  memberUids: [ME.uid],
  members: [ME],
  createdAt: null,
  ...partial,
})

const meal = (partial: Partial<PlannedMeal> & { id: string }): PlannedMeal => ({
  date: TODAY,
  slot: "dinner",
  recipeId: "chilli",
  title: "Chilli",
  byUid: ME.uid,
  byName: ME.name,
  addedAt: null,
  ...partial,
})

const item = (partial: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem => ({
  amount: "",
  section: "other",
  from: [],
  checked: false,
  sort: 0,
  addedAt: null,
  ...partial,
})

/** A store the test drives by hand. Nothing here reaches Firestore. */
const fakeStore = () => {
  let emitSessions: (s: PlanningSession[]) => void = () => {}
  let failSessions: (error: Error) => void = () => {}
  let emitInvites: (i: SessionInvite[]) => void = () => {}
  /** Asks on the open session, as against `emitInvites`' asks on the viewer. */
  let emitAsked: (i: SessionInvite[]) => void = () => {}
  let emitMeals: (m: PlannedMeal[]) => void = () => {}
  let emitItems: (i: ShoppingItem[]) => void = () => {}
  let emitPantry: (p: Record<string, string>) => void = () => {}

  return {
    watchSessions: vi.fn(
      (_uid: string, cb: (s: PlanningSession[]) => void, onError: (e: Error) => void) => {
        emitSessions = cb
        failSessions = onError
        return () => {}
      }
    ),
    watchInvites: vi.fn((_uid: string, cb: (i: SessionInvite[]) => void) => {
      emitInvites = cb
      return () => {}
    }),
    watchSessionInvites: vi.fn((_id: string, cb: (i: SessionInvite[]) => void) => {
      emitAsked = cb
      return () => {}
    }),
    watchMeals: vi.fn((_id: string, _from: string, cb: (m: PlannedMeal[]) => void) => {
      emitMeals = cb
      return () => {}
    }),
    watchShopping: vi.fn((_id: string, cb: (i: ShoppingItem[]) => void) => {
      emitItems = cb
      return () => {}
    }),
    watchPantry: vi.fn((cb: (p: Record<string, string>) => void) => {
      emitPantry = cb
      return () => {}
    }),
    createSession: vi.fn().mockResolvedValue("s-new"),
    setCovers: vi.fn().mockResolvedValue(undefined),
    leaveSession: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    invite: vi.fn().mockResolvedValue(undefined),
    acceptInvite: vi.fn().mockResolvedValue(undefined),
    declineInvite: vi.fn().mockResolvedValue(undefined),
    planMeal: vi.fn().mockResolvedValue(undefined),
    unplanMeal: vi.fn().mockResolvedValue(undefined),
    moveMeal: vi.fn().mockResolvedValue(undefined),
    setMealServes: vi.fn().mockResolvedValue(undefined),
    setChecked: vi.fn().mockResolvedValue(undefined),
    addItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    apply: vi.fn().mockResolvedValue(undefined),
    clearChecked: vi.fn().mockResolvedValue(undefined),
    getScalingSpec: vi.fn().mockResolvedValue(null),
    sessions: (s: PlanningSession[]) => emitSessions(s),
    failSessions: (error: Error) => failSessions(error),
    invites: (i: SessionInvite[]) => emitInvites(i),
    asked: (i: SessionInvite[]) => emitAsked(i),
    meals: (m: PlannedMeal[]) => emitMeals(m),
    items: (i: ShoppingItem[]) => emitItems(i),
    pantry: (p: Record<string, string>) => emitPantry(p),
  }
}

type Fake = ReturnType<typeof fakeStore>

const build = (items: unknown[] = [], note = "") =>
  vi.fn().mockResolvedValue({ items, note })

const analyse = (spec: ScalingSpec | null) =>
  vi.fn().mockResolvedValue({ spec })

/** Signed in, in one session, with a week to look at. */
const opened = (
  store: Fake,
  { chef = build(), scaler = analyse(specFor(CHILLI)) } = {}
) => {
  const presenter = new PlannerPresenter(chef, scaler, store as unknown as PlannerStore)
  presenter.openFor(ME)
  store.sessions([session()])
  return { presenter, chef, scaler }
}

describe("PlannerPresenter", () => {
  let store: Fake

  beforeEach(() => {
    store = fakeStore()
    try {
      sessionStorage.clear()
    } catch {
      /* not every environment has one */
    }
  })

  /**
   * Two lists of `SessionInvite` that mean opposite things: the asks waiting on
   * *you* (any session, shown on your own tab) and the asks this session is
   * waiting on *other people* to answer. Same type, so only the wiring keeps
   * them apart.
   */
  describe("asks on the open session", () => {
    it("keeps them apart from the asks waiting on you", () => {
      const { presenter } = opened(store)

      store.asked([{ id: "a", sessionId: "s1", toEmail: "kaylee@x.test" } as SessionInvite])
      expect(presenter.getAsked().map((i) => i.toEmail)).toEqual(["kaylee@x.test"])
      expect(presenter.getInvites()).toEqual([])

      presenter.dispose()
    })

    it("forgets them when the session changes, rather than showing the last one's", () => {
      const { presenter } = opened(store)
      store.asked([{ id: "a", sessionId: "s1", toEmail: "kaylee@x.test" } as SessionInvite])
      expect(presenter.getAsked()).toHaveLength(1)

      presenter.selectSession(null)
      expect(presenter.getAsked()).toEqual([])

      presenter.dispose()
    })
  })

  describe("openFor", () => {
    it("subscribes once for a person who has not changed", () => {
      const { presenter } = opened(store)
      presenter.openFor(ME)

      expect(store.watchSessions).toHaveBeenCalledTimes(1)
      presenter.dispose()
    })

    it("drops one person's sessions before showing another's", () => {
      const { presenter } = opened(store)
      expect(presenter.getSessions()).toHaveLength(1)

      presenter.openFor(DEV)
      expect(presenter.getSessions()).toEqual([])
      expect(presenter.getSession()).toBeNull()

      presenter.dispose()
    })

    it("tells a failed listener apart from being in no sessions", () => {
      const { presenter } = opened(store)
      store.sessions([])
      expect(presenter.getLoadError()).toBeNull()

      // A denied or unindexed query hands back nothing, which renders exactly
      // like "you're in none yet" unless the two are kept distinct.
      store.failSessions(new Error("The query requires an index"))
      expect(presenter.getLoadError()?.message).toBe("The query requires an index")

      // And clears once it starts working, rather than sticking forever.
      store.sessions([session()])
      expect(presenter.getLoadError()).toBeNull()

      presenter.dispose()
    })

    it("does nothing with no session", () => {
      const presenter = new PlannerPresenter(build(), analyse(null), store as unknown as PlannerStore)
      presenter.openFor(null)
      expect(store.watchSessions).not.toHaveBeenCalled()
      presenter.dispose()
    })
  })

  describe("choosing a session", () => {
    it("opens the newest when there is nothing remembered", () => {
      const { presenter } = opened(store)
      expect(presenter.getSession()?.id).toBe("s1")
      presenter.dispose()
    })

    it("lets go when the open one disappears — somebody left it elsewhere", () => {
      const { presenter } = opened(store)
      store.sessions([])
      expect(presenter.getSession()).toBeNull()
      presenter.dispose()
    })

    it("switches to a different week and list entirely", () => {
      const { presenter } = opened(store)
      store.meals([meal({ id: "m1" })])
      store.items([item({ id: "i1", name: "flour" })])

      presenter.selectSession("s2")

      expect(presenter.getMeals()).toEqual([])
      expect(presenter.getItems()).toEqual([])
      expect(store.watchMeals).toHaveBeenLastCalledWith("s2", expect.any(String), expect.any(Function))
      presenter.dispose()
    })

    it("comes back to the session it was last on", () => {
      const first = opened(store)
      first.presenter.selectSession("s1")
      first.presenter.dispose()

      const store2 = fakeStore()
      const presenter = new PlannerPresenter(build(), analyse(null), store2 as unknown as PlannerStore)
      presenter.openFor(ME)
      store2.sessions([session({ id: "s9", name: "Newer" }), session()])

      expect(presenter.getSession()?.id).toBe("s1")
      presenter.dispose()
    })
  })

  describe("ending a session", () => {
    it("lets whoever started it delete it", async () => {
      const { presenter } = opened(store)
      expect(presenter.iOwnThis()).toBe(true)

      await presenter.deleteSession()

      expect(store.deleteSession).toHaveBeenCalledWith("s1")
      // Let go before the sweep, so the listeners are not reporting a week
      // emptying out document by document.
      expect(presenter.getSession()).toBeNull()
      presenter.dispose()
    })

    it("refuses to delete somebody else's session", async () => {
      const { presenter } = opened(store)
      store.sessions([session({ ownerUid: DEV.uid, memberUids: [DEV.uid, ME.uid] })])

      expect(presenter.iOwnThis()).toBe(false)
      await presenter.deleteSession()

      expect(store.deleteSession).not.toHaveBeenCalled()
      presenter.dispose()
    })

    it("leaving takes you out without taking the session away", async () => {
      const { presenter } = opened(store)
      await presenter.leaveSession()

      expect(store.leaveSession).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), "u1")
      expect(store.deleteSession).not.toHaveBeenCalled()
      presenter.dispose()
    })
  })

  describe("the week", () => {
    it("re-subscribes going back, because that moves the query's floor", () => {
      const { presenter } = opened(store)
      const before = store.watchMeals.mock.calls.length

      presenter.previousWeek()
      expect(store.watchMeals.mock.calls.length).toBe(before + 1)
      expect(store.watchMeals.mock.calls.at(-1)?.[1]).toBe(addDays(TODAY, -7))

      presenter.dispose()
    })

    it("does not re-subscribe going forward — the query has no ceiling", () => {
      const { presenter } = opened(store)
      const before = store.watchMeals.mock.calls.length

      presenter.nextWeek()
      expect(store.watchMeals.mock.calls.length).toBe(before)
      expect(presenter.getWeekOffset()).toBe(1)

      presenter.dispose()
    })
  })

  describe("planning", () => {
    it("records who put a meal up", async () => {
      const { presenter } = opened(store)
      await presenter.planMeal(TODAY, "dinner", CHILLI)

      expect(store.planMeal).toHaveBeenCalledWith("s1", {
        date: TODAY,
        slot: "dinner",
        recipeId: "chilli",
        title: "Chilli",
        byUid: "u1",
        byName: "Sam",
      })
      presenter.dispose()
    })

    it("falls back to the session's covers for a meal with no number of its own", () => {
      const { presenter } = opened(store)
      expect(presenter.servesFor(meal({ id: "m1" }))).toBe(4)
      expect(presenter.servesFor(meal({ id: "m2", serves: 12 }))).toBe(12)
      presenter.dispose()
    })

    it("clears the override when a meal is set back to the session's number", async () => {
      const { presenter } = opened(store)
      await presenter.setMealServes(meal({ id: "m1", serves: 8 }), 4)

      // Null, not 4 — a meal that merely agrees with the session today should
      // still follow it tomorrow.
      expect(store.setMealServes).toHaveBeenCalledWith("s1", "m1", null)
      presenter.dispose()
    })

    it("keeps an override that differs", async () => {
      const { presenter } = opened(store)
      await presenter.setMealServes(meal({ id: "m1" }), 12)
      expect(store.setMealServes).toHaveBeenCalledWith("s1", "m1", 12)
      presenter.dispose()
    })
  })

  describe("the list", () => {
    it("records who ticked a row", async () => {
      const { presenter } = opened(store)
      await presenter.toggleItem(item({ id: "i1", name: "flour" }))
      expect(store.setChecked).toHaveBeenCalledWith("s1", "i1", true, "u1")
      presenter.dispose()
    })

    it("files a manual item under the aisle the pantry already knows", async () => {
      const { presenter } = opened(store)
      store.pantry({ butter: "dairy" })

      await presenter.addManualItem("  Butter ")

      expect(store.addItem).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ name: "butter", section: "dairy", manual: true })
      )
      presenter.dispose()
    })

    it("leaves an unknown manual item in other", async () => {
      const { presenter } = opened(store)
      await presenter.addManualItem("paper towels")
      expect(store.addItem).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ name: "paper towels", section: "other" })
      )
      presenter.dispose()
    })
  })

  describe("buildList", () => {
    it("scales each meal to the number eating before consolidating", async () => {
      store.getScalingSpec.mockResolvedValue(specFor(CHILLI))
      const { presenter, chef } = opened(store)
      store.meals([meal({ id: "m1", serves: 8 })])

      await presenter.buildList([CHILLI])

      const sent = chef.mock.calls[0][0]
      expect(sent.meals[0].ingredients).toEqual([
        { name: "ground beef", amount: "2 lb" },
        { name: "kosher salt", amount: "to taste" },
      ])
      presenter.dispose()
    })

    it("asks the chef for scaling rules once, then never again for that recipe", async () => {
      const spec = specFor(CHILLI)
      const { presenter, scaler } = opened(store, { scaler: analyse(spec) })
      store.meals([
        meal({ id: "m1", serves: 8 }),
        meal({ id: "m2", slot: "lunch", serves: 12 }),
      ])

      // Nothing cached: one call for the recipe, covering both serving counts.
      await presenter.buildList([CHILLI])
      expect(scaler).toHaveBeenCalledTimes(1)
      expect(presenter.getLastBuild()?.analysed).toBe(1)

      // Now cached, and a third serving count is free.
      store.getScalingSpec.mockResolvedValue(spec)
      store.meals([meal({ id: "m3", serves: 11 })])
      await presenter.buildList([CHILLI])
      expect(scaler).toHaveBeenCalledTimes(1)
      expect(presenter.getLastBuild()?.analysed).toBe(0)

      presenter.dispose()
    })

    it("ignores a spec written for different ingredient lines", async () => {
      // A stale spec must not be applied: the amounts it quotes are for a
      // recipe that has moved on.
      store.getScalingSpec.mockResolvedValue({ ...specFor(CHILLI), fingerprint: "stale" })
      const { presenter, scaler } = opened(store)
      store.meals([meal({ id: "m1" })])

      await presenter.buildList([CHILLI])
      expect(scaler).toHaveBeenCalledTimes(1)
      presenter.dispose()
    })

    it("refuses a malformed spec rather than scaling by it", async () => {
      const { presenter, chef } = opened(store, {
        scaler: analyse({ ...specFor(CHILLI), lines: [] }),
      })
      store.meals([meal({ id: "m1", serves: 8 })])

      await presenter.buildList([CHILLI])

      // Amounts as filed, not scaled — and counted, so the view can say so.
      expect(chef.mock.calls[0][0].meals[0].ingredients).toEqual(CHILLI.ingredients)
      expect(presenter.getLastBuild()?.unscaled).toBe(1)
      presenter.dispose()
    })

    it("carries amounts as written when the scaler cannot be reached", async () => {
      const scaler = vi.fn().mockRejectedValue(new Error("unavailable"))
      const { presenter, chef } = opened(store, { scaler })
      store.meals([meal({ id: "m1", serves: 8 })])

      await presenter.buildList([CHILLI])

      expect(chef.mock.calls[0][0].meals[0].ingredients).toEqual(CHILLI.ingredients)
      expect(presenter.getLastBuild()?.unscaled).toBe(1)
      presenter.dispose()
    })

    it("only covers the days that were picked", async () => {
      const { presenter, chef } = opened(store)
      store.meals([
        meal({ id: "in", date: TODAY, recipeId: "pancakes", title: "Pancakes" }),
        meal({ id: "out", date: addDays(TODAY, 9) }),
      ])
      presenter.setShopDays([TODAY])

      await presenter.buildList([CHILLI, PANCAKES])

      expect(chef.mock.calls[0][0].meals.map((m: { title: string }) => m.title)).toEqual([
        "Pancakes",
      ])
      presenter.dispose()
    })

    it("sends the pantry so the chef is only asked about names nobody knows", async () => {
      const { presenter, chef } = opened(store)
      store.pantry({ butter: "dairy" })
      store.meals([meal({ id: "m1" })])

      await presenter.buildList([CHILLI])
      expect(chef.mock.calls[0][0].known).toEqual({ butter: "dairy" })
      presenter.dispose()
    })

    it("sends only the unticked rows", async () => {
      const { presenter, chef } = opened(store)
      store.meals([meal({ id: "m1" })])
      store.items([
        item({ id: "open", name: "flour" }),
        item({ id: "bought", name: "butter", checked: true }),
      ])

      await presenter.buildList([CHILLI])
      expect(chef.mock.calls[0][0].existing.map((r: { id: string }) => r.id)).toEqual(["open"])
      presenter.dispose()
    })

    it("merges plainly when the chef cannot be reached, keeping known aisles", async () => {
      const chef = vi.fn().mockRejectedValue(new Error("unavailable"))
      const { presenter } = opened(store, { chef })
      store.pantry({ "ground beef": "meat" })
      store.meals([meal({ id: "m1" })])

      await presenter.buildList([CHILLI])

      const [, , additions] = store.apply.mock.calls[0]
      expect(additions.find((r: { name: string }) => r.name === "ground beef")).toMatchObject({
        section: "meat",
      })
      expect(presenter.getLastBuild()?.usedFallback).toBe(true)
      presenter.dispose()
    })

    it("counts a meal whose recipe has been deleted rather than ignoring it", async () => {
      const { presenter } = opened(store)
      store.meals([meal({ id: "m1" }), meal({ id: "m2", recipeId: "gone", title: "Gone" })])

      await presenter.buildList([CHILLI])
      expect(presenter.getLastBuild()?.skipped).toBe(1)
      presenter.dispose()
    })

    it("writes nothing when the picked days hold nothing", async () => {
      const { presenter } = opened(store)
      store.meals([])

      await presenter.buildList([CHILLI])
      expect(store.apply).not.toHaveBeenCalled()
      expect(presenter.getLastBuild()).toMatchObject({ added: 0, merged: 0 })
      presenter.dispose()
    })
  })
})
