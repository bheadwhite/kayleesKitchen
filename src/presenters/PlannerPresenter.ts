import { Runner, Signal } from "@tcn/state/core"

import { analyseScaling } from "@/ai/scaling"
import { buildShoppingList } from "@/ai/shoppingList"
import type { ScalingRequest, ScalingResponse, ShoppingRequest, ShoppingResponse } from "@/ai/types"
import { addDays, todayISO } from "@/calendar"
import * as services from "fire/services"
import { ingredientsFingerprint } from "@/recipeFingerprint"
import { applyScale, isUsableSpec, type ScalingSpec } from "@/scaling"
import {
  consolidateVerbatim,
  mergePlan,
  normaliseItemName,
  OTHER,
  sectionKey,
  type MealIngredients,
} from "@/shoppingList"
import type {
  MealSlot,
  PlannedMeal,
  PlanningSession,
  Recipe,
  SessionInvite,
  SessionMember,
  ShoppingItem,
} from "@/types"

type Build = (request: ShoppingRequest) => Promise<ShoppingResponse>
type Analyse = (request: ScalingRequest) => Promise<ScalingResponse>

/**
 * Everything the planner keeps, injectable so tests never reach Firestore —
 * the same arrangement as `ChefStore`, and for the same reason.
 */
export interface PlannerStore {
  watchSessions: (
    uid: string,
    callback: (sessions: PlanningSession[]) => void
  ) => () => void
  watchInvites: (email: string, callback: (invites: SessionInvite[]) => void) => () => void
  watchMeals: (
    sessionId: string,
    from: string,
    callback: (meals: PlannedMeal[]) => void
  ) => () => void
  watchShopping: (sessionId: string, callback: (items: ShoppingItem[]) => void) => () => void
  watchPantry: (callback: (sections: Record<string, string>) => void) => () => void
  createSession: (owner: SessionMember, name: string, covers: number) => Promise<string>
  setCovers: (sessionId: string, covers: number) => Promise<unknown>
  leaveSession: (session: PlanningSession, uid: string) => Promise<unknown>
  invite: (session: PlanningSession, from: SessionMember, toEmail: string) => Promise<unknown>
  acceptInvite: (invite: SessionInvite, me: SessionMember) => Promise<unknown>
  declineInvite: (invite: SessionInvite) => Promise<unknown>
  planMeal: (sessionId: string, meal: Omit<PlannedMeal, "id" | "addedAt">) => Promise<unknown>
  unplanMeal: (sessionId: string, mealId: string) => Promise<unknown>
  moveMeal: (
    sessionId: string,
    mealId: string,
    to: { date: string; slot: MealSlot }
  ) => Promise<unknown>
  setMealServes: (
    sessionId: string,
    mealId: string,
    serves: number | null
  ) => Promise<unknown>
  setChecked: (
    sessionId: string,
    itemId: string,
    checked: boolean,
    uid: string
  ) => Promise<unknown>
  addItem: (sessionId: string, item: Omit<ShoppingItem, "id" | "addedAt">) => Promise<unknown>
  removeItem: (sessionId: string, itemId: string) => Promise<unknown>
  apply: (
    sessionId: string,
    updates: Array<{ id: string; amount: string; from: string[] }>,
    additions: Array<Omit<ShoppingItem, "id" | "addedAt">>
  ) => Promise<unknown>
  clearChecked: (sessionId: string) => Promise<unknown>
  getScalingSpec: (recipeId: string, fingerprint: string) => Promise<ScalingSpec | null>
}

/**
 * Wrapped rather than aliased — `watchMeals: services.onSessionMealsSnapshot`
 * would *read* every one of these the moment this module is imported, so a test
 * injecting its own store would still have to mock the lot to reach the
 * constructor.
 */
const FIRESTORE_PLANNER_STORE: PlannerStore = {
  watchSessions: (uid, cb) => services.onMySessionsSnapshot(uid, cb),
  watchInvites: (email, cb) => services.onMyInvitesSnapshot(email, cb),
  watchMeals: (sessionId, from, cb) => services.onSessionMealsSnapshot(sessionId, from, cb),
  watchShopping: (sessionId, cb) => services.onSessionShoppingSnapshot(sessionId, cb),
  watchPantry: (cb) => services.onPantrySnapshot(cb),
  createSession: (owner, name, covers) => services.createSession(owner, name, covers),
  setCovers: (sessionId, covers) => services.setSessionCovers(sessionId, covers),
  leaveSession: (session, uid) => services.leaveSession(session, uid),
  invite: (session, from, toEmail) => services.inviteToSession(session, from, toEmail),
  acceptInvite: (invite, me) => services.acceptInvite(invite, me),
  declineInvite: (invite) => services.declineInvite(invite),
  planMeal: (sessionId, meal) => services.addPlannedMeal(sessionId, meal),
  unplanMeal: (sessionId, mealId) => services.deletePlannedMeal(sessionId, mealId),
  moveMeal: (sessionId, mealId, to) => services.movePlannedMeal(sessionId, mealId, to),
  setMealServes: (sessionId, mealId, serves) =>
    services.setMealServes(sessionId, mealId, serves),
  setChecked: (sessionId, itemId, checked, uid) =>
    services.setShoppingItemChecked(sessionId, itemId, checked, uid),
  addItem: (sessionId, item) => services.addShoppingItem(sessionId, item),
  removeItem: (sessionId, itemId) => services.deleteShoppingItem(sessionId, itemId),
  apply: (sessionId, updates, additions) =>
    services.applyShoppingItems(sessionId, updates, additions),
  clearChecked: (sessionId) => services.clearCheckedShoppingItems(sessionId),
  getScalingSpec: (recipeId, fingerprint) => services.getScalingSpec(recipeId, fingerprint),
}

/** What a session cooks for until somebody says otherwise. */
export const DEFAULT_COVERS = 4

/** Nobody is cooking for nought, and nobody is cooking for a hundred. */
export const MIN_COVERS = 1
export const MAX_COVERS = 24

/** How many days the shopping window offers to pick from. */
export const HORIZON_DAYS = 14

/** Which session was last open, so a reload lands where you left off. */
const LAST_SESSION_KEY = "planner:session"

export interface BuildSummary {
  merged: number
  added: number
  /** Planned meals whose recipe is no longer filed — nothing to read off. */
  skipped: number
  /**
   * Meals whose recipe had no usable scaling spec and could not get one, so
   * their amounts went in as written rather than scaled to the table.
   */
  unscaled: number
  /** Recipes the chef worked out scaling rules for during this build. */
  analysed: number
  note: string
  /** The chef could not be reached; the list was merged without it. */
  usedFallback: boolean
}

/**
 * The planning session on screen: its week, its shopping list, and the
 * switching between the sessions somebody is in.
 *
 * One presenter rather than several because they are one feature — the list is
 * built from the week, the week is scaled to the session's covers, and all
 * three change together when you switch session.
 */
export class PlannerPresenter {
  private readonly _sessions = new Signal<PlanningSession[]>([])
  private readonly _sessionId = new Signal<string | null>(null)
  private readonly _invites = new Signal<SessionInvite[]>([])
  private readonly _meals = new Signal<PlannedMeal[]>([])
  private readonly _items = new Signal<ShoppingItem[]>([])
  /** Ingredient name → aisle, from the shared pantry. Free to read, always. */
  private readonly _pantry = new Signal<Record<string, string>>({})
  /** Which week the agenda is showing, in weeks from this one. */
  private readonly _weekOffset = new Signal<number>(0)
  /** The days the next build covers. Picked, not a rolling window. */
  private readonly _shopDays = new Signal<string[]>([])
  private readonly _lastBuild = new Signal<BuildSummary | null>(null)
  private readonly _buildRunner = new Runner<void>(undefined)
  private readonly _sessionRunner = new Runner<void>(undefined)

  private me: SessionMember | null = null
  /** What the session listeners are currently pointed at. */
  private watchingUid: string | null = null
  private watchingSession: { id: string; from: string } | null = null
  private stopWatchingMe: Array<() => void> = []
  private stopWatchingSession: Array<() => void> = []

  constructor(
    private readonly build: Build = buildShoppingList,
    private readonly analyse: Analyse = analyseScaling,
    private readonly store: PlannerStore = FIRESTORE_PLANNER_STORE
  ) {
    this._shopDays.set(defaultShopDays())
  }

  get sessionsBroadcast() {
    return this._sessions.broadcast
  }

  get sessionIdBroadcast() {
    return this._sessionId.broadcast
  }

  get invitesBroadcast() {
    return this._invites.broadcast
  }

  get mealsBroadcast() {
    return this._meals.broadcast
  }

  get itemsBroadcast() {
    return this._items.broadcast
  }

  get weekOffsetBroadcast() {
    return this._weekOffset.broadcast
  }

  get shopDaysBroadcast() {
    return this._shopDays.broadcast
  }

  get lastBuildBroadcast() {
    return this._lastBuild.broadcast
  }

  get buildRunnerBroadcast() {
    return this._buildRunner.stateBroadcast
  }

  get sessionRunnerBroadcast() {
    return this._sessionRunner.stateBroadcast
  }

  getSessions() {
    return this._sessions.get()
  }

  getSession(): PlanningSession | null {
    const id = this._sessionId.get()
    return this._sessions.get().find((session) => session.id === id) ?? null
  }

  getInvites() {
    return this._invites.get()
  }

  getMeals() {
    return this._meals.get()
  }

  getItems() {
    return this._items.get()
  }

  getWeekOffset() {
    return this._weekOffset.get()
  }

  getShopDays() {
    return this._shopDays.get()
  }

  getLastBuild() {
    return this._lastBuild.get()
  }

  /** How many the session cooks for, or the default before there is one. */
  getCovers() {
    return this.getSession()?.covers ?? DEFAULT_COVERS
  }

  /* ------------------------------------------------------------ listeners */

  /**
   * Point the planner at whoever is signed in.
   *
   * Safe to call on every render. A different person starts over: their
   * sessions, their asks, and — since a session is not theirs to see — a blank
   * week until one of their own is picked.
   */
  openFor(me: SessionMember | null) {
    if (me?.uid === this.watchingUid) {
      this.me = me
      return
    }

    this.me = me
    this.watchingUid = me?.uid ?? null

    this.stopWatchingMe.forEach((stop) => stop())
    this.stopWatchingMe = []
    this._sessions.set([])
    this._invites.set([])
    // `remember: false` — signing in is not a choice about which session to
    // open, and recording it as one wipes the memory of the last real choice
    // before `settleSelection` ever gets to read it.
    this.selectSession(null, { remember: false })

    if (me == null) return

    // Held rather than left to the garbage collector — an unstored subscription
    // is WeakRef-collected mid-session and silently stops firing.
    this.stopWatchingMe = [
      this.store.watchSessions(me.uid, (sessions) => {
        this._sessions.set(sessions)
        this.settleSelection(sessions)
      }),
      // Addressed by email — see `SessionInvite`. An account with no address
      // cannot be asked into anything, which is the honest consequence of
      // there being nothing to address the ask to.
      ...(me.email == null
        ? []
        : [this.store.watchInvites(me.email, (invites) => this._invites.set(invites))]),
      // The pantry is not session-scoped and not entitlement-scoped: it is the
      // chef's accumulated answer to "which aisle is this in", and everyone
      // reads it.
      this.store.watchPantry((sections) => this._pantry.set(sections)),
    ]
  }

  /**
   * Keeps the open session pointed at something real.
   *
   * Picks up where the last visit left off, falls to the newest session
   * otherwise, and lets go when the current one disappears — which happens for
   * real, when somebody leaves a session on another device.
   */
  private settleSelection(sessions: PlanningSession[]) {
    const current = this._sessionId.get()
    if (current != null && sessions.some((session) => session.id === current)) return

    const remembered = readLastSession()
    const wanted =
      sessions.find((session) => session.id === remembered) ?? sessions[0] ?? null
    this.selectSession(wanted?.id ?? null)
  }

  /** Switches session: a different week, a different list, from scratch. */
  selectSession(sessionId: string | null, { remember = true } = {}) {
    if (sessionId === this._sessionId.get() && this.watchingSession?.id === sessionId) return

    this._sessionId.set(sessionId)
    this._meals.set([])
    this._items.set([])
    this._lastBuild.set(null)
    this._weekOffset.set(0)
    this._shopDays.set(defaultShopDays())
    if (remember) writeLastSession(sessionId)
    this.watchSession()
  }

  private watchSession() {
    this.stopWatchingSession.forEach((stop) => stop())
    this.stopWatchingSession = []

    const id = this._sessionId.get()
    if (id == null) {
      this.watchingSession = null
      return
    }

    // The week's floor is the start of the earliest week on screen, so paging
    // back re-subscribes and paging forward does not.
    const from = this.weekStart()
    this.watchingSession = { id, from }
    this.stopWatchingSession = [
      this.store.watchMeals(id, from, (meals) => this._meals.set(meals)),
      this.store.watchShopping(id, (items) => this._items.set(items)),
    ]
  }

  /* --------------------------------------------------------------- weeks */

  /** The Sunday-relative first day of the week on screen. */
  weekStart(offset = this._weekOffset.get()) {
    return addDays(todayISO(), offset * 7)
  }

  showWeek(offset: number) {
    if (offset === this._weekOffset.get()) return
    const goingBack = offset < this._weekOffset.get()
    this._weekOffset.set(offset)
    // Only a step backwards moves the query's floor; forward is already covered.
    if (goingBack) this.watchSession()
  }

  previousWeek() {
    this.showWeek(this._weekOffset.get() - 1)
  }

  nextWeek() {
    this.showWeek(this._weekOffset.get() + 1)
  }

  thisWeek() {
    this.showWeek(0)
  }

  /* ------------------------------------------------------------ sessions */

  startSession(name: string, covers: number) {
    const me = this.me
    const clean = name.trim()
    if (me == null || clean === "") return Promise.resolve()

    return this._sessionRunner.execute(async () => {
      const id = await this.store.createSession(me, clean, clampCovers(covers))
      // Selected straight away rather than waiting for the snapshot: the person
      // who just named a session is looking at it.
      this.selectSession(id)
    })
  }

  setCovers(covers: number) {
    const session = this.getSession()
    if (session == null) return Promise.resolve()
    const wanted = clampCovers(covers)
    if (wanted === session.covers) return Promise.resolve()
    return this.store.setCovers(session.id, wanted)
  }

  invite(toEmail: string) {
    const session = this.getSession()
    const me = this.me
    if (session == null || me == null || toEmail === "") return Promise.resolve()
    if (session.members.some((member) => member.email === toEmail)) return Promise.resolve()
    return this.store.invite(session, me, toEmail)
  }

  leaveSession() {
    const session = this.getSession()
    const me = this.me
    if (session == null || me == null) return Promise.resolve()

    return this._sessionRunner.execute(async () => {
      await this.store.leaveSession(session, me.uid)
      this.selectSession(null)
    })
  }

  acceptInvite(invite: SessionInvite) {
    const me = this.me
    if (me == null) return Promise.resolve()

    return this._sessionRunner.execute(async () => {
      await this.store.acceptInvite(invite, me)
      this.selectSession(invite.sessionId)
    })
  }

  declineInvite(invite: SessionInvite) {
    return this.store.declineInvite(invite)
  }

  /* -------------------------------------------------------------- the week */

  mealsAt(date: string, slot: MealSlot) {
    return this._meals.get().filter((meal) => meal.date === date && meal.slot === slot)
  }

  /** How many a given meal is for: its own number, or the session's. */
  servesFor(meal: PlannedMeal) {
    return meal.serves ?? this.getCovers()
  }

  planMeal(date: string, slot: MealSlot, recipe: Recipe) {
    const session = this.getSession()
    const me = this.me
    if (session == null || me == null || recipe.id == null) return Promise.resolve()

    return this.store.planMeal(session.id, {
      date,
      slot,
      recipeId: recipe.id,
      // Carried rather than looked up later — see the note on `PlannedMeal.title`.
      title: recipe.title,
      byUid: me.uid,
      byName: me.name,
    })
  }

  unplanMeal(mealId: string) {
    const session = this.getSession()
    return session == null ? Promise.resolve() : this.store.unplanMeal(session.id, mealId)
  }

  moveMeal(mealId: string, to: { date: string; slot: MealSlot }) {
    const session = this.getSession()
    return session == null ? Promise.resolve() : this.store.moveMeal(session.id, mealId, to)
  }

  /**
   * How many this one meal is for.
   *
   * Setting it back to the session's own number **clears** the override rather
   * than writing the same figure: a meal that merely agrees with the session
   * today should still follow it tomorrow.
   */
  setMealServes(meal: PlannedMeal, serves: number) {
    const session = this.getSession()
    if (session == null) return Promise.resolve()

    const wanted = clampCovers(serves)
    return this.store.setMealServes(
      session.id,
      meal.id,
      wanted === this.getCovers() ? null : wanted
    )
  }

  /* --------------------------------------------------------------- the list */

  toggleItem(item: ShoppingItem) {
    const session = this.getSession()
    const me = this.me
    if (session == null || me == null) return Promise.resolve()
    return this.store.setChecked(session.id, item.id, !item.checked, me.uid)
  }

  /**
   * Something no recipe asked for — milk, foil, paper towels. No amount and no
   * section, because someone typing it is in a hurry; the pantry supplies the
   * aisle if it happens to know the name.
   */
  addManualItem(name: string) {
    const session = this.getSession()
    const clean = normaliseItemName(name)
    if (session == null || clean === "") return Promise.resolve()

    const section = sectionKey(this._pantry.get()[clean] ?? OTHER)
    const sort =
      this._items
        .get()
        .filter((item) => sectionKey(item.section) === section)
        .reduce((highest, item) => Math.max(highest, item.sort), 0) + 1

    return this.store.addItem(session.id, {
      name: clean,
      amount: "",
      section,
      from: [],
      checked: false,
      manual: true,
      byUid: this.me?.uid ?? null,
      tickedByUid: null,
      sort,
    })
  }

  removeItem(itemId: string) {
    const session = this.getSession()
    return session == null ? Promise.resolve() : this.store.removeItem(session.id, itemId)
  }

  clearChecked() {
    const session = this.getSession()
    return session == null ? Promise.resolve() : this.store.clearChecked(session.id)
  }

  /* -------------------------------------------------------- shopping window */

  toggleShopDay(date: string) {
    this._shopDays.transform((days) =>
      days.includes(date) ? days.filter((day) => day !== date) : [...days, date].sort()
    )
  }

  setShopDays(days: string[]) {
    this._shopDays.set([...days].sort())
  }

  /** The meals the picked days cover — what a build would read. */
  mealsInWindow() {
    const days = new Set(this._shopDays.get())
    return this._meals.get().filter((meal) => days.has(meal.date))
  }

  /* ------------------------------------------------------------- building */

  /**
   * Reads the planned meals into the list.
   *
   * Three steps, and only the ones that have to cost anything do:
   *
   * 1. **Scale each meal to the number eating.** Almost always free — a recipe's
   *    scaling rules are cached under the recipe itself and answer every
   *    serving count, so the chef is asked only for recipes nobody has ever
   *    scaled. A session cooking for eleven pays nothing a session cooking for
   *    four has not already paid.
   * 2. **Consolidate.** One call, and the only part that recurs. It arrives
   *    already scaled and with most aisles already known from the pantry, so it
   *    is doing the merging alone.
   * 3. **Write**, through `mergePlan`, which is where the guarantee about
   *    already-ticked rows is enforced.
   *
   * Every step degrades rather than failing. No spec and no way to get one means
   * that recipe's amounts go in as written; no chef at all means the whole list
   * is merged verbatim. **The shop is never blocked** — that is the point of
   * writing the chef's work down as data.
   */
  buildList(recipes: Recipe[]) {
    const session = this.getSession()
    if (session == null) return Promise.resolve()

    return this._buildRunner.execute(async () => {
      const planned = this.mealsInWindow()
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]))

      const meals: MealIngredients[] = []
      let skipped = 0
      let unscaled = 0
      let analysed = 0

      // One recipe planned twice in the same window is one recipe. Without
      // this, a week with Tuesday's and Friday's chilli asks the chef to work
      // out the same scaling rules twice — the second read racing the write the
      // first one triggered — and bills for both.
      const specs = new Map<string, ScalingSpec | null>()

      for (const meal of planned) {
        const recipe = byId.get(meal.recipeId)
        // A meal whose recipe has been deleted still names itself on the week,
        // but there is nothing to read ingredients off. Counted rather than
        // ignored — a list quietly missing a dinner is the failure you find at
        // the till.
        if (recipe == null) {
          skipped += 1
          continue
        }

        const fingerprint = ingredientsFingerprint(recipe)
        const key = `${recipe.id}:${fingerprint}`
        if (!specs.has(key)) {
          const found = await this.specFor(recipe, fingerprint)
          if (found.freshlyAnalysed) analysed += 1
          specs.set(key, found.spec)
        }

        const spec = specs.get(key) ?? null
        if (spec == null) {
          unscaled += 1
          meals.push({ title: recipe.title, ingredients: recipe.ingredients ?? [] })
          continue
        }

        meals.push({
          title: recipe.title,
          ingredients: applyScale(spec, this.servesFor(meal)).ingredients,
        })
      }

      if (meals.length === 0) {
        this._lastBuild.set({
          merged: 0,
          added: 0,
          skipped,
          unscaled: 0,
          analysed: 0,
          note: "",
          usedFallback: false,
        })
        return
      }

      const existing = this._items.get()
      // Only the unticked rows are shown to the chef — a row it cannot see is a
      // row it cannot merge into. See `ShoppingRequest`.
      const open = existing
        .filter((item) => !item.checked)
        .map(({ id, name, amount, section }) => ({ id, name, amount, section }))

      let proposed
      let note = ""
      let usedFallback = false
      try {
        const response = await this.build({ meals, existing: open, known: this._pantry.get() })
        proposed = response.items ?? []
        note = response.note ?? ""
        // A refusal or an empty answer is not a reason to write nothing at all.
        if (proposed.length === 0) throw new Error("The chef returned no items.")
      } catch (error) {
        console.warn("Building the list with the chef failed; merging it plainly.", error)
        proposed = consolidateVerbatim(meals, existing).map((item) => ({
          ...item,
          // The pantry still knows the aisles even when the chef is unreachable.
          section: sectionKey(this._pantry.get()[item.name] ?? item.section),
        }))
        usedFallback = true
      }

      const { updates, additions } = mergePlan(existing, proposed)
      await this.store.apply(session.id, updates, additions)

      this._lastBuild.set({
        merged: updates.length,
        added: additions.length,
        skipped,
        unscaled,
        analysed,
        note,
        usedFallback,
      })
    })
  }

  /**
   * How this recipe scales — from the cache if anyone has ever asked, from the
   * chef otherwise.
   *
   * The chef is asked for the recipe's **rules**, not for a scaled list, so one
   * answer covers every serving count from then on, for every session and every
   * member. A null spec is not a failure: the caller carries the amounts as
   * written and says how many meals it had to do that for.
   */
  private async specFor(recipe: Recipe, fingerprint: string) {
    if (recipe.id == null) return { spec: null, freshlyAnalysed: false }

    let stored: ScalingSpec | null = null
    try {
      stored = await this.store.getScalingSpec(recipe.id, fingerprint)
    } catch (error) {
      console.warn("Could not read the scaling rules", error)
    }

    if (isUsableSpec(stored, fingerprint)) return { spec: stored, freshlyAnalysed: false }

    try {
      const response = await this.analyse({
        recipeId: recipe.id,
        recipe: {
          title: recipe.title,
          ingredients: recipe.ingredients ?? [],
          directions: recipe.directions ?? [],
        },
        fingerprint,
      })
      // Verified on the way out of the callable exactly as on the way out of
      // the cache: a spec is model output, and the failure this must never have
      // is a confident wrong quantity.
      const spec = isUsableSpec(response.spec, fingerprint) ? response.spec : null
      return { spec, freshlyAnalysed: true }
    } catch (error) {
      console.warn("Could not work out how to scale this recipe", error)
      return { spec: null, freshlyAnalysed: false }
    }
  }

  dispose() {
    this.stopWatchingMe.forEach((stop) => stop())
    this.stopWatchingSession.forEach((stop) => stop())
    this.stopWatchingMe = []
    this.stopWatchingSession = []
    this._sessions.dispose()
    this._sessionId.dispose()
    this._invites.dispose()
    this._meals.dispose()
    this._items.dispose()
    this._pantry.dispose()
    this._weekOffset.dispose()
    this._shopDays.dispose()
    this._lastBuild.dispose()
    this._buildRunner.dispose()
    this._sessionRunner.dispose()
  }
}

const clampCovers = (covers: number) =>
  Math.max(MIN_COVERS, Math.min(MAX_COVERS, Math.round(covers) || MIN_COVERS))

/** The next five days — what most people shop for, and a sane thing to open on. */
const defaultShopDays = () =>
  Array.from({ length: 5 }, (_, index) => addDays(todayISO(), index))

/**
 * Which session was last open. `sessionStorage` rather than the URL: switching
 * session is not navigation — the Plan tab is the same page either way — and an
 * installed PWA is resumed rather than cold-started, so landing back on the
 * session you were shopping from matters more than a shareable link.
 */
const readLastSession = () => {
  try {
    return sessionStorage.getItem(LAST_SESSION_KEY)
  } catch {
    return null
  }
}

const writeLastSession = (sessionId: string | null) => {
  try {
    if (sessionId == null) sessionStorage.removeItem(LAST_SESSION_KEY)
    else sessionStorage.setItem(LAST_SESSION_KEY, sessionId)
  } catch {
    // Storage can be disabled outright (Safari private browsing). Landing on
    // the newest session instead is a fine second best.
  }
}
