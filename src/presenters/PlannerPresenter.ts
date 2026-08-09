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
  sourcesOf,
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
    callback: (sessions: PlanningSession[]) => void,
    onError: (error: Error) => void
  ) => () => void
  watchInvites: (email: string, callback: (invites: SessionInvite[]) => void) => () => void
  /** Asks outstanding *on a session*, as against `watchInvites`' asks on a person. */
  watchSessionInvites: (
    sessionId: string,
    callback: (invites: SessionInvite[]) => void
  ) => () => void
  watchMeals: (
    sessionId: string,
    from: string,
    callback: (meals: PlannedMeal[]) => void,
    onError: (error: Error) => void
  ) => () => void
  watchShopping: (
    sessionId: string,
    callback: (items: ShoppingItem[]) => void,
    onError: (error: Error) => void
  ) => () => void
  watchPantry: (callback: (sections: Record<string, string>) => void) => () => void
  createSession: (owner: SessionMember, name: string, covers: number) => Promise<string>
  setCovers: (sessionId: string, covers: number) => Promise<unknown>
  leaveSession: (session: PlanningSession, uid: string) => Promise<unknown>
  /** Somebody *else* out — owner only, which the rules enforce. */
  removeMember: (session: PlanningSession, uid: string) => Promise<unknown>
  deleteSession: (sessionId: string) => Promise<unknown>
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
    updates: Array<{ id: string; amount: string; from: string[]; fromIds: string[] }>,
    additions: Array<Omit<ShoppingItem, "id" | "addedAt">>,
    removals: string[]
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
  watchSessions: (uid, cb, onError) => services.onMySessionsSnapshot(uid, cb, onError),
  watchInvites: (email, cb) => services.onMyInvitesSnapshot(email, cb),
  watchSessionInvites: (sessionId, cb) => services.onSessionInvitesSnapshot(sessionId, cb),
  watchMeals: (sessionId, from, cb, onError) =>
    services.onSessionMealsSnapshot(sessionId, from, cb, onError),
  watchShopping: (sessionId, cb, onError) =>
    services.onSessionShoppingSnapshot(sessionId, cb, onError),
  watchPantry: (cb) => services.onPantrySnapshot(cb),
  createSession: (owner, name, covers) => services.createSession(owner, name, covers),
  setCovers: (sessionId, covers) => services.setSessionCovers(sessionId, covers),
  leaveSession: (session, uid) => services.leaveSession(session, uid),
  removeMember: (session, uid) => services.removeFromSession(session, uid),
  deleteSession: (sessionId) => services.deleteSession(sessionId),
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
  apply: (sessionId, updates, additions, removals) =>
    services.applyShoppingItems(sessionId, updates, additions, removals),
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
  /** Lines taken off because their recipe is no longer part of the list. */
  removed: number
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
  /**
   * Asks outstanding on the **open session** — the other direction from
   * `_invites`, which holds the asks outstanding on *you*. Both are lists of
   * `SessionInvite`, which is why they are named apart rather than by type.
   */
  private readonly _asked = new Signal<SessionInvite[]>([])
  private readonly _meals = new Signal<PlannedMeal[]>([])
  private readonly _items = new Signal<ShoppingItem[]>([])
  /** Ingredient name → aisle, from the shared pantry. Free to read, always. */
  private readonly _pantry = new Signal<Record<string, string>>({})
  /**
   * Recipes the cook has taken off the list, by id.
   *
   * Without this, dropping a recipe whose meal is still in the shop window is
   * undone by the very next Build — the two controls would sit next to each
   * other disagreeing. Held per session and **per device**: it is a statement
   * about the list you are about to build rather than about the plan, and
   * writing it to the session document would have one person's tidy-up quietly
   * decide what everybody else's next build contains.
   */
  private readonly _dropped = new Signal<string[]>([])
  /** Which week the agenda is showing, in weeks from this one. */
  private readonly _weekOffset = new Signal<number>(0)
  /** The days the next build covers. Picked, not a rolling window. */
  private readonly _shopDays = new Signal<string[]>([])
  /** Why the session list is empty, when it is empty for a reason. */
  private readonly _loadError = new Signal<Error | null>(null)
  /**
   * Why *this session's* week and list are empty, when they are empty for a
   * reason. The other half of `_loadError`, and it had to exist for the same
   * argument: a denied or malformed listener hands back nothing, which renders
   * exactly like a week nobody has planned yet. That is how planning a meal
   * could appear to do nothing at all — the write landed, and the listener that
   * was supposed to show it had failed silently at subscribe time.
   */
  private readonly _weekError = new Signal<Error | null>(null)
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

  get askedBroadcast() {
    return this._asked.broadcast
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

  get loadErrorBroadcast() {
    return this._loadError.broadcast
  }

  get weekErrorBroadcast() {
    return this._weekError.broadcast
  }

  get droppedBroadcast() {
    return this._dropped.broadcast
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

  getAsked() {
    return this._asked.get()
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

  getLoadError() {
    return this._loadError.get()
  }

  getWeekError() {
    return this._weekError.get()
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
    this._loadError.set(null)
    // `remember: false` — signing in is not a choice about which session to
    // open, and recording it as one wipes the memory of the last real choice
    // before `settleSelection` ever gets to read it.
    this.selectSession(null, { remember: false })

    if (me == null) return

    // Held rather than left to the garbage collector — an unstored subscription
    // is WeakRef-collected mid-session and silently stops firing.
    this.stopWatchingMe = [
      this.store.watchSessions(
        me.uid,
        (sessions) => {
          this._loadError.set(null)
          this._sessions.set(sessions)
          this.settleSelection(sessions)
        },
        // A denied or malformed query hands back *nothing*, which renders
        // identically to "you are in no sessions yet" — so the two have to be
        // told apart here. The same reasoning the admin console's feeds already
        // spell out: "the rules are denying you" and "nothing has happened yet"
        // must not look the same.
        (error) => this._loadError.set(error)
      ),
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
    // Dropped recipes belong to a list, and a different session is a different
    // list. Read back rather than cleared, so switching away and back does not
    // quietly re-admit everything that was taken off.
    this._dropped.set(sessionId == null ? [] : readDropped(sessionId))
    if (remember) writeLastSession(sessionId)
    this.watchSession()
  }

  private watchSession() {
    this.stopWatchingSession.forEach((stop) => stop())
    this.stopWatchingSession = []

    const id = this._sessionId.get()
    this._weekError.set(null)
    if (id == null) {
      this.watchingSession = null
      this._asked.set([])
      return
    }

    // The week's floor is the start of the earliest week on screen, so paging
    // back re-subscribes and paging forward does not.
    const from = this.weekStart()
    this.watchingSession = { id, from }
    this.stopWatchingSession = [
      // Both report their failures, for the reason `watchSessions` already
      // does: nothing hands back an error and a value, so a listener that never
      // fires is indistinguishable from a week nobody has planned — and the
      // thing that then looks broken is whatever you did last, which is
      // usually planning a meal.
      this.store.watchMeals(
        id,
        from,
        (meals) => {
          this._weekError.set(null)
          this._meals.set(meals)
        },
        (error) => this._weekError.set(error)
      ),
      this.store.watchShopping(
        id,
        (items) => {
          this._weekError.set(null)
          this._items.set(items)
        },
        (error) => this._weekError.set(error)
      ),
      // Who has been asked and not answered. Scoped to the session rather than
      // to the viewer — `_invites` is the other direction, the asks waiting on
      // *you*, and the two must not be confused.
      this.store.watchSessionInvites(id, (asked) => this._asked.set(asked)),
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

  /** Whether the session on screen is one this person started. */
  iOwnThis() {
    const session = this.getSession()
    return session != null && this.me != null && session.ownerUid === this.me.uid
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

  /**
   * Takes somebody else out of the session.
   *
   * **Whoever started it, and nobody else.** A session is one person's
   * invitation to a group, so withdrawing it belongs to the person who issued
   * it; everybody else's only exit is their own. Checked here so the sheet
   * cannot offer a button that would be denied, and again in `firestore.rules`,
   * which is what actually decides it.
   *
   * The owner is not somebody the owner can remove — that would leave a session
   * standing that nobody can read and nobody can ever delete. Their way out is
   * `deleteSession`.
   *
   * Nothing they planned leaves with them: the week and the list belong to the
   * session. On their own device the session simply stops coming back from
   * `watchSessions`, and `settleSelection` moves them off it.
   */
  removeMember(uid: string) {
    const session = this.getSession()
    if (session == null || !this.iOwnThis()) return Promise.resolve()
    if (uid === session.ownerUid || !session.memberUids.includes(uid)) {
      return Promise.resolve()
    }

    return this._sessionRunner.execute(async () => {
      await this.store.removeMember(session, uid)
    })
  }

  /**
   * Deletes the session and everything in it. Owner only — everybody else
   * leaves, which takes them out without taking the week away from whoever is
   * still cooking it.
   */
  deleteSession() {
    const session = this.getSession()
    if (session == null || !this.iOwnThis()) return Promise.resolve()

    return this._sessionRunner.execute(async () => {
      // Let go *first*: the listeners under a session being swept out from
      // underneath them would otherwise spend the delete reporting a week that
      // is emptying document by document.
      this.selectSession(null)
      await this.store.deleteSession(session.id)
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

  /**
   * Puts a recipe on a day.
   *
   * **Every way this can decline says so**, rather than resolving quietly. All
   * three used to be a bare `Promise.resolve()`, which meant the one path a
   * person takes most — press "Plan something", pick a recipe — could do
   * absolutely nothing and report absolutely nothing. None of the three is a
   * "nothing to do" case: the recipe was picked out of a list, so if it cannot
   * be placed, something is wrong and the caller's `guard` should say what.
   */
  planMeal(date: string, slot: MealSlot, recipe: Recipe) {
    const session = this.getSession()
    const me = this.me
    if (session == null) {
      return Promise.reject(new Error("no session is open — open one from the session bar"))
    }
    if (me == null) {
      return Promise.reject(new Error("you are not signed in"))
    }
    // A recipe read out of a snapshot always carries its document id, so this
    // is a recipe from somewhere else — and planning it would write a meal that
    // no shopping list could ever read ingredients off.
    if (recipe.id == null) {
      return Promise.reject(new Error(`"${recipe.title}" has no id and cannot be planned`))
    }

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

  /* ------------------------------------------------- what the list covers */

  /**
   * The recipes the list currently carries lines for, each marked with whether
   * the cook has dropped it.
   *
   * Read off the list rather than off the week: the list outlives the plan it
   * came from, so a meal unplanned yesterday is still on it and still shown
   * here — which is how anybody notices. A dropped recipe keeps its place in
   * the row for as long as the window still plans it, because that is the one
   * you can put back; once nothing plans it and nothing credits it, it is gone
   * and there is nothing to show.
   */
  getSources() {
    const dropped = new Set(this._dropped.get())
    const listed = sourcesOf(this._items.get())
    const known = new Set(listed.map((source) => source.title))

    // A dropped recipe still planned in the window would otherwise vanish from
    // the row the moment its lines went, leaving no way back but un-dropping
    // something invisible.
    const alsoPlanned = this.mealsInWindow()
      .filter((meal) => dropped.has(meal.recipeId) && !known.has(meal.title))
      .map((meal) => ({ id: meal.recipeId, title: meal.title, lines: 0, only: 0 }))

    return [...listed, ...alsoPlanned].map((source) => ({
      ...source,
      dropped: source.id != null && dropped.has(source.id),
    }))
  }

  /**
   * Takes a recipe off the list.
   *
   * **Its own lines go immediately**, because that costs nothing: a line
   * crediting only this recipe is entirely its doing. A line it *shares* keeps
   * its amount and merely loses the credit — there is no subtracting "1 cup"
   * from "3 cups" when both are text, and inventing an answer to that is how a
   * list starts lying about quantities. The next Build restates those exactly,
   * for free, because a build now states totals.
   *
   * Ticked rows and hand-typed rows are never touched, the same three
   * exclusions `mergePlan` makes.
   */
  dropSource(source: { id: string | null; title: string }) {
    const session = this.getSession()
    if (session == null) return Promise.resolve()

    // Recorded before the write, so a Build racing this cannot re-add it.
    if (source.id != null && !this._dropped.get().includes(source.id)) {
      this._dropped.transform((ids) => [...ids, source.id as string])
      this.rememberDropped()
    }

    const affected = this._items
      .get()
      .filter(
        (item) => !item.checked && item.manual !== true && item.from.includes(source.title)
      )

    const removals = affected.filter((item) => item.from.length === 1).map((item) => item.id)
    const updates = affected
      .filter((item) => item.from.length > 1)
      .map((item) => ({
        id: item.id,
        // Left as it reads. See above: the share cannot be worked out here.
        amount: item.amount,
        from: item.from.filter((title) => title !== source.title),
        fromIds: (item.fromIds ?? []).filter((id) => id !== source.id),
      }))

    if (removals.length === 0 && updates.length === 0) return Promise.resolve()
    return this.store.apply(session.id, updates, [], removals)
  }

  /**
   * Puts a dropped recipe back in the running. Adding its lines is a Build —
   * that is a model call, and a switch that silently spends one is a switch
   * people learn not to touch.
   */
  restoreSource(recipeId: string) {
    this._dropped.transform((ids) => ids.filter((id) => id !== recipeId))
    this.rememberDropped()
  }

  private rememberDropped() {
    const id = this._sessionId.get()
    if (id != null) writeDropped(id, this._dropped.get())
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
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]))
      const existing = this._items.get()
      const dropped = new Set(this._dropped.get())

      const planned = this.mealsInWindow().filter((meal) => !dropped.has(meal.recipeId))

      /**
       * Recipes the list already carries lines for that this window does not
       * cover — a meal shopped for last week, or one since unplanned.
       *
       * **They have to be read in even though nothing new is being planned for
       * them**, because the chef is now asked for the total a line should read
       * rather than an amount to add. A recipe it cannot see is a recipe whose
       * share of a shared line it cannot preserve, and leaving it out would
       * quietly shrink "3 cups butter" to the one cup this window wants.
       *
       * Scaled to the session's covers: there is no planned meal left to take a
       * number from, and the session's own is the honest default.
       */
      const carried = sourcesOf(existing).filter(
        (source) =>
          source.id != null &&
          !dropped.has(source.id) &&
          !planned.some((meal) => meal.recipeId === source.id)
      )

      const meals: MealIngredients[] = []
      /** Title → recipe id, for the lines `mergePlan` is about to write. */
      const ids = new Map<string, string>()
      let skipped = 0
      let unscaled = 0
      let analysed = 0

      // One recipe planned twice in the same window is one recipe. Without
      // this, a week with Tuesday's and Friday's chilli asks the chef to work
      // out the same scaling rules twice — the second read racing the write the
      // first one triggered — and bills for both.
      const specs = new Map<string, ScalingSpec | null>()

      const read = async (recipe: Recipe, serves: number) => {
        const fingerprint = ingredientsFingerprint(recipe)
        const key = `${recipe.id}:${fingerprint}`
        if (!specs.has(key)) {
          const found = await this.specFor(recipe, fingerprint)
          if (found.freshlyAnalysed) analysed += 1
          specs.set(key, found.spec)
        }

        if (recipe.id != null) ids.set(recipe.title, recipe.id)

        const spec = specs.get(key) ?? null
        if (spec == null) {
          unscaled += 1
          meals.push({ title: recipe.title, ingredients: recipe.ingredients ?? [] })
          return
        }
        meals.push({ title: recipe.title, ingredients: applyScale(spec, serves).ingredients })
      }

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
        await read(recipe, this.servesFor(meal))
      }

      for (const source of carried) {
        const recipe = byId.get(source.id as string)
        // Its lines stay: nothing here accounted for it, so `covered` will not
        // name it and `mergePlan` will not take it off.
        if (recipe == null) continue
        await read(recipe, this.getCovers())
      }

      /**
       * What this build accounted for — everything it read, plus everything the
       * cook dropped. That is what licenses a removal: see {@link mergePlan}.
       */
      const covered = {
        built: meals.map((meal) => meal.title),
        dropped: sourcesOf(existing)
          .filter((source) => source.id != null && dropped.has(source.id))
          .map((source) => source.title),
      }
      const idOf = (title: string) => ids.get(title)

      // Nothing left to read, but there may still be lines to take off — which
      // is exactly the state after dropping the last recipe on the list. The
      // chef is not asked, because there is nothing to ask about.
      if (meals.length === 0) {
        const { removals } = mergePlan(existing, [], { covered, idOf })
        if (removals.length > 0) await this.store.apply(session.id, [], [], removals)
        this._lastBuild.set({
          merged: 0,
          added: 0,
          removed: removals.length,
          skipped,
          unscaled: 0,
          analysed: 0,
          note: "",
          usedFallback: false,
        })
        return
      }

      // Only the unticked rows are shown to the chef — a row it cannot see is a
      // row it cannot merge into. See `ShoppingRequest`. `from` rides along so
      // it can tell its own earlier work from a line it has never seen, which
      // is what stops a second press of Build doubling every amount.
      const open = existing
        .filter((item) => !item.checked)
        .map(({ id, name, amount, section, from }) => ({ id, name, amount, section, from }))

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

      // **No removals on the fallback path.** `consolidateVerbatim` merges what
      // it was given and nothing else; treating its silence about a line as
      // "drop it" would let an outage empty the list.
      const { updates, additions, removals } = mergePlan(
        existing,
        proposed,
        usedFallback ? { idOf } : { covered, idOf }
      )
      await this.store.apply(session.id, updates, additions, removals)

      this._lastBuild.set({
        merged: updates.length,
        added: additions.length,
        removed: removals.length,
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
    this._asked.dispose()
    this._loadError.dispose()
    this._weekError.dispose()
    this._dropped.dispose()
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

/**
 * Recipes taken off this session's list. `sessionStorage`, like the last
 * session and the chef's fork: it survives the reload an installed PWA does on
 * its own, and goes no further, which is the whole intent — see `_dropped`.
 */
const droppedKey = (sessionId: string) => `planner:dropped:${sessionId}`

const readDropped = (sessionId: string): string[] => {
  try {
    const raw = sessionStorage.getItem(droppedKey(sessionId))
    const parsed: unknown = raw == null ? null : JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

const writeDropped = (sessionId: string, ids: string[]) => {
  try {
    if (ids.length === 0) sessionStorage.removeItem(droppedKey(sessionId))
    else sessionStorage.setItem(droppedKey(sessionId), JSON.stringify(ids))
  } catch {
    // Storage can be off entirely. The switch still works for this visit.
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
