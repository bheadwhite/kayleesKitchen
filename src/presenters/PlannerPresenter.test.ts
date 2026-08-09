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
  let failMeals: (e: Error) => void = () => {}
  let failItems: (e: Error) => void = () => {}
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
    watchMeals: vi.fn(
      (
        _id: string,
        _from: string,
        cb: (m: PlannedMeal[]) => void,
        onError: (e: Error) => void
      ) => {
        emitMeals = cb
        failMeals = onError
        return () => {}
      }
    ),
    watchShopping: vi.fn(
      (_id: string, cb: (i: ShoppingItem[]) => void, onError: (e: Error) => void) => {
        emitItems = cb
        failItems = onError
        return () => {}
      }
    ),
    watchPantry: vi.fn((cb: (p: Record<string, string>) => void) => {
      emitPantry = cb
      return () => {}
    }),
    createSession: vi.fn().mockResolvedValue("s-new"),
    setCovers: vi.fn().mockResolvedValue(undefined),
    leaveSession: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
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
    failMeals: (e: Error) => failMeals(e),
    items: (i: ShoppingItem[]) => emitItems(i),
    failItems: (e: Error) => failItems(e),
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
      expect(store.watchMeals).toHaveBeenLastCalledWith(
        "s2",
        expect.any(String),
        expect.any(Function),
        expect.any(Function)
      )
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

  /**
   * A session is one person's invitation to a group, so withdrawing it belongs
   * to whoever issued it. Everybody else's only exit is their own.
   */
  describe("taking somebody out", () => {
    const shared = () => session({ memberUids: [ME.uid, DEV.uid], members: [ME, DEV] })

    it("lets whoever started it take another member out", async () => {
      const { presenter } = opened(store)
      store.sessions([shared()])

      await presenter.removeMember(DEV.uid)

      expect(store.removeMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: "s1" }),
        DEV.uid
      )
      // Removing somebody is not ending the session for everybody else.
      expect(store.deleteSession).not.toHaveBeenCalled()
      expect(presenter.getSession()?.id).toBe("s1")
      presenter.dispose()
    })

    it("refuses when the session is somebody else's", async () => {
      const { presenter } = opened(store)
      store.sessions([
        session({ ownerUid: DEV.uid, memberUids: [DEV.uid, ME.uid], members: [DEV, ME] }),
      ])

      expect(presenter.iOwnThis()).toBe(false)
      await presenter.removeMember(ME.uid)

      // A member's only exit is `leaveSession` — and the rules say the same.
      expect(store.removeMember).not.toHaveBeenCalled()
      presenter.dispose()
    })

    /**
     * Reading a session needs membership and deleting one needs to be the
     * owner, so an owner who took themselves out would leave a session standing
     * that nobody can read and nobody can ever delete.
     */
    it("refuses to take the owner out, even at the owner's asking", async () => {
      const { presenter } = opened(store)
      store.sessions([shared()])

      await presenter.removeMember(ME.uid)

      expect(store.removeMember).not.toHaveBeenCalled()
      presenter.dispose()
    })

    it("does nothing for somebody who is not in it", async () => {
      const { presenter } = opened(store)

      await presenter.removeMember("u404")

      expect(store.removeMember).not.toHaveBeenCalled()
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

    /**
     * All three of these resolved quietly, so the one path people take most —
     * "Plan something", pick a recipe — could do nothing whatsoever and report
     * nothing whatsoever. The recipe was picked out of a list; if it will not
     * go on the week, something is wrong and the caller has to be able to say
     * what.
     */
    describe("refusing to plan", () => {
      it("says so when no session is open", async () => {
        const presenter = new PlannerPresenter(
          build(),
          analyse(null),
          store as unknown as PlannerStore
        )
        presenter.openFor(ME)

        await expect(presenter.planMeal(TODAY, "dinner", CHILLI)).rejects.toThrow(/no session/i)
        expect(store.planMeal).not.toHaveBeenCalled()
        presenter.dispose()
      })

      it("says so when the recipe has no id to plan", async () => {
        const { presenter } = opened(store)

        await expect(
          presenter.planMeal(TODAY, "dinner", { ...CHILLI, id: undefined })
        ).rejects.toThrow(/Chilli/)
        expect(store.planMeal).not.toHaveBeenCalled()
        presenter.dispose()
      })
    })
  })

  /**
   * A listener that fails hands back nothing, which renders exactly like a week
   * nobody has planned — and then everything done next looks broken, because
   * the meal is written and never appears. The sessions listener already had
   * this; the week's did not.
   */
  describe("a week that cannot be read", () => {
    it("reports it rather than showing an empty week", () => {
      const { presenter } = opened(store)

      store.failMeals(new Error("Missing or insufficient permissions."))

      expect(presenter.getWeekError()?.message).toMatch(/insufficient permissions/)
      presenter.dispose()
    })

    it("reports a shopping list that cannot be read too", () => {
      const { presenter } = opened(store)

      store.failItems(new Error("denied"))

      expect(presenter.getWeekError()?.message).toBe("denied")
      presenter.dispose()
    })

    it("clears as soon as anything reads", () => {
      const { presenter } = opened(store)
      store.failMeals(new Error("denied"))

      store.meals([meal({ id: "m1" })])

      expect(presenter.getWeekError()).toBeNull()
      presenter.dispose()
    })

    it("does not carry into the next session", () => {
      const { presenter } = opened(store)
      store.failMeals(new Error("denied"))

      presenter.selectSession("s2")

      // The failure belonged to the session that was open, and switching is a
      // fresh pair of listeners.
      expect(presenter.getWeekError()).toBeNull()
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

    /**
     * The chef used to be shown a line's name and amount and nothing else, so
     * it could not tell its own earlier work from something the cook added —
     * and it was told to give the combined amount. A second press of Build
     * turned two pounds of beef into four.
     */
    it("tells the chef which recipes a line already covers", async () => {
      const { presenter, chef } = opened(store)
      store.meals([meal({ id: "m1" })])
      store.items([item({ id: "b", name: "ground beef", amount: "1 lb", from: ["Chilli"] })])

      await presenter.buildList([CHILLI])

      expect(chef.mock.calls[0][0].existing[0]).toMatchObject({
        id: "b",
        from: ["Chilli"],
      })
      presenter.dispose()
    })

    it("reads in a recipe the list carries that this window does not", async () => {
      const { presenter, chef } = opened(store)
      store.meals([meal({ id: "m1" })])
      // Shopped for last week, or since unplanned. Left out of the request, the
      // chef would state a total that quietly drops its share of a shared line.
      store.items([item({ id: "b", name: "butter", from: ["Pancakes"], fromIds: ["pancakes"] })])

      await presenter.buildList([CHILLI, PANCAKES])

      expect(chef.mock.calls[0][0].meals.map((m: { title: string }) => m.title)).toEqual([
        "Chilli",
        "Pancakes",
      ])
      presenter.dispose()
    })

    it("never removes on the fallback path", async () => {
      const chef = vi.fn().mockRejectedValue(new Error("unavailable"))
      const { presenter } = opened(store, { chef })
      store.meals([meal({ id: "m1" })])
      store.items([item({ id: "v", name: "vanilla", from: ["Chilli"] })])

      await presenter.buildList([CHILLI])

      // `consolidateVerbatim` merges what it was given and nothing else, so its
      // silence about a line must not be read as "drop it" — an outage would
      // otherwise empty the list.
      const [, , , removals] = store.apply.mock.calls[0]
      expect(removals).toEqual([])
      presenter.dispose()
    })
  })

  /**
   * The list is persistent and outlives the plan, so the only way a recipe ever
   * leaves it is somebody saying so.
   */
  describe("what the list covers", () => {
    const listed = () =>
      store.items([
        item({ id: "b", name: "ground beef", from: ["Chilli"], fromIds: ["chilli"] }),
        item({
          id: "s",
          name: "salt",
          amount: "2 tsp",
          from: ["Chilli", "Pancakes"],
          fromIds: ["chilli", "pancakes"],
        }),
        item({ id: "f", name: "foil", from: [], manual: true }),
      ])

    it("names the recipes the lines credit", () => {
      const { presenter } = opened(store)
      listed()

      expect(presenter.getSources()).toEqual([
        { id: "chilli", title: "Chilli", lines: 2, only: 1, dropped: false },
        { id: "pancakes", title: "Pancakes", lines: 1, only: 0, dropped: false },
      ])
      presenter.dispose()
    })

    it("drops its own lines at once and only loosens the shared one", async () => {
      const { presenter } = opened(store)
      listed()

      await presenter.dropSource({ id: "chilli", title: "Chilli" })

      const [, updates, additions, removals] = store.apply.mock.calls[0]
      expect(removals).toEqual(["b"])
      expect(additions).toEqual([])
      // The amount stays exactly as it read: there is no subtracting "1 tsp"
      // from "2 tsp" when both are text. The next build restates it.
      expect(updates).toEqual([
        { id: "s", amount: "2 tsp", from: ["Pancakes"], fromIds: ["pancakes"] },
      ])
      presenter.dispose()
    })

    it("keeps a dropped recipe out of the next build", async () => {
      const { presenter, chef } = opened(store)
      listed()
      store.meals([meal({ id: "m1" })])

      await presenter.dropSource({ id: "chilli", title: "Chilli" })
      await presenter.buildList([CHILLI])

      // Chilli is still planned this window. Without the record, Build would
      // put back what was just taken off, and the two controls would sit next
      // to each other disagreeing.
      expect(chef).not.toHaveBeenCalled()
      presenter.dispose()
    })

    it("still shows a dropped recipe that the week still plans", async () => {
      const { presenter } = opened(store)
      listed()
      store.meals([meal({ id: "m1" })])

      await presenter.dropSource({ id: "chilli", title: "Chilli" })
      store.items([item({ id: "s", name: "salt", from: ["Pancakes"], fromIds: ["pancakes"] })])

      // Its lines have gone, so nothing credits it — but it is the one recipe
      // here that can be put back, and a switch you cannot see is no switch.
      expect(presenter.getSources()).toContainEqual(
        expect.objectContaining({ id: "chilli", title: "Chilli", dropped: true })
      )
      presenter.dispose()
    })

    it("lets it back in, and says nothing was written", () => {
      const { presenter } = opened(store)
      listed()

      void presenter.dropSource({ id: "chilli", title: "Chilli" })
      store.apply.mockClear()
      presenter.restoreSource("chilli")

      // Putting the lines back is a Build — a model call, and a switch that
      // silently spends one is a switch people learn not to touch.
      expect(store.apply).not.toHaveBeenCalled()
      presenter.dispose()
    })

    it("takes off a title-only line, which can never come back", async () => {
      const { presenter } = opened(store)
      store.items([item({ id: "old", name: "flour", from: ["Bread"] })])

      await presenter.dropSource({ id: null, title: "Bread" })

      const [, , , removals] = store.apply.mock.calls[0]
      expect(removals).toEqual(["old"])
      presenter.dispose()
    })
  })
})
