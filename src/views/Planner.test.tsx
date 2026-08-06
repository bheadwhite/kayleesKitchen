import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import Planner from "./Planner"
import AuthProvider from "contexts/AuthProvider"
import PlannerProvider from "contexts/PlannerProvider"
import { AuthPresenter } from "presenters/AuthPresenter"
import { PlannerPresenter, type PlannerStore } from "presenters/PlannerPresenter"
import { dayLabel, todayISO } from "@/calendar"
import type {
  PlannedMeal,
  PlanningSession,
  Recipe,
  SessionInvite,
  ShoppingItem,
} from "@/types"

let emitAuthState: (user: unknown) => void = () => {}
let emitRecipes: (recipes: Recipe[]) => void = () => {}

vi.mock("fire/firebase", () => ({ auth: {}, functions: {} }))

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  GoogleAuthProvider: { credentialFromError: () => null },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
  recordLogin: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
  onRecipesSnapshot: (callback: (recipes: Recipe[]) => void) => {
    emitRecipes = callback
    return () => {}
  },
  onUsersSnapshot: (callback: (people: unknown[]) => void) => {
    callback([
      { firstName: "Amy", lastName: "Ham", email: "amy@example.test" },
      { firstName: "B", lastName: "W", email: "bw@example.test" },
      { firstName: "Cook", lastName: "", email: "cook@example.test" },
    ])
    return () => {}
  },
}))

const TODAY = todayISO()

const PANCAKES: Recipe = {
  id: "pancakes",
  title: "Pancakes",
  ingredients: [{ name: "butter", amount: "1 cup" }],
  directions: [{ sectionTitle: "", steps: ["Whisk."] }],
}

const SESSION: PlanningSession = {
  id: "s1",
  name: "Weeknights",
  ownerUid: "u1",
  covers: 4,
  memberUids: ["u1"],
  members: [{ uid: "u1", name: "Cook", email: "cook@example.test" }],
  createdAt: null,
}

const PLANNED: PlannedMeal = {
  id: "m1",
  date: TODAY,
  slot: "dinner",
  recipeId: "pancakes",
  title: "Pancakes",
  byUid: "u1",
  byName: "Cook",
  addedAt: null,
}

const item = (partial: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem => ({
  amount: "",
  section: "other",
  from: [],
  checked: false,
  sort: 0,
  addedAt: null,
  ...partial,
})

const fakeStore = () => {
  let emitSessions: (s: PlanningSession[]) => void = () => {}
  let emitMeals: (m: PlannedMeal[]) => void = () => {}
  let emitItems: (i: ShoppingItem[]) => void = () => {}

  return {
    watchSessions: vi.fn((_uid: string, cb: (s: PlanningSession[]) => void) => {
      emitSessions = cb
      return () => {}
    }),
    watchInvites: vi.fn((_email: string, _cb: (i: SessionInvite[]) => void) => () => {}),
    watchMeals: vi.fn((_id: string, _from: string, cb: (m: PlannedMeal[]) => void) => {
      emitMeals = cb
      return () => {}
    }),
    watchShopping: vi.fn((_id: string, cb: (i: ShoppingItem[]) => void) => {
      emitItems = cb
      return () => {}
    }),
    watchPantry: vi.fn(() => () => {}),
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
    meals: (m: PlannedMeal[]) => emitMeals(m),
    items: (i: ShoppingItem[]) => emitItems(i),
  }
}

/**
 * The auth status is a `derive()`, which batches on a microtask — so the planner
 * does not subscribe until a tick after the session lands. Everything the tests
 * push in has to wait for that, or it goes into a listener nobody holds yet.
 */
const renderPlanner = async (path = "/plan", { withSession = true } = {}) => {
  const auth = new AuthPresenter({} as Auth)
  const store = fakeStore()
  const planner = new PlannerPresenter(
    vi.fn().mockResolvedValue({ items: [], note: "" }),
    vi.fn().mockResolvedValue({ spec: null }),
    store as unknown as PlannerStore
  )

  render(
    <AuthProvider presenter={auth}>
      <PlannerProvider presenter={planner}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path='/plan' element={<Planner />} />
            <Route path='/recipes' element={<p>recipe list</p>} />
          </Routes>
        </MemoryRouter>
      </PlannerProvider>
    </AuthProvider>
  )

  emitAuthState({ uid: "u1", email: "cook@example.test", displayName: "Cook" })
  await waitFor(() => expect(store.watchSessions).toHaveBeenCalled())
  if (withSession) act(() => store.sessions([SESSION]))

  return {
    auth,
    planner,
    store,
    recipes: (list: Recipe[]) => act(() => emitRecipes(list)),
    meals: (list: PlannedMeal[]) => act(() => store.meals(list)),
    items: (list: ShoppingItem[]) => act(() => store.items(list)),
  }
}

describe("Planner", () => {
  beforeEach(() => {
    emitAuthState = () => {}
    emitRecipes = () => {}
    try {
      sessionStorage.clear()
    } catch {
      /* not every environment has one */
    }
  })

  it("says planning is a group thing before there is a session", async () => {
    const { auth, planner } = await renderPlanner("/plan", { withSession: false })

    expect(
      await screen.findByRole("heading", { name: /Planning is a group thing/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Start a session/ })).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("names the session and how many it cooks for", async () => {
    const { auth, planner } = await renderPlanner()

    expect(screen.getByText("Weeknights")).toBeInTheDocument()
    expect(screen.getByText("Cooking for")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("moves the session's covers", async () => {
    const user = userEvent.setup()
    const { auth, planner, store } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: "One more at the table" }))
    expect(store.setCovers).toHaveBeenCalledWith("s1", 5)

    auth.dispose()
    planner.dispose()
  })

  it("plans a recipe into the slot that was tapped", async () => {
    const user = userEvent.setup()
    const { auth, planner, store, recipes } = await renderPlanner()
    recipes([PANCAKES])

    await user.click(screen.getByRole("button", { name: `Plan dinner for ${dayLabel(TODAY)}` }))
    await user.click(await screen.findByRole("button", { name: /Pancakes/ }))

    expect(store.planMeal).toHaveBeenCalledWith("s1", {
      date: TODAY,
      slot: "dinner",
      recipeId: "pancakes",
      title: "Pancakes",
      byUid: "u1",
      byName: "Cook",
    })

    auth.dispose()
    planner.dispose()
  })

  it("shows a planned meal at the session's number until it is given its own", async () => {
    const user = userEvent.setup()
    const { auth, planner, store, meals } = await renderPlanner()
    meals([PLANNED])

    expect(screen.getByText("eating · session default")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "One more eating for Pancakes" }))
    expect(store.setMealServes).toHaveBeenCalledWith("s1", "m1", 5)

    auth.dispose()
    planner.dispose()
  })

  it("takes a planned meal off the week", async () => {
    const user = userEvent.setup()
    const { auth, planner, store, meals } = await renderPlanner()
    meals([PLANNED])

    await user.click(screen.getByRole("button", { name: /Take Pancakes off dinner/ }))
    expect(store.unplanMeal).toHaveBeenCalledWith("s1", "m1")

    auth.dispose()
    planner.dispose()
  })

  it("pages to next week and back", async () => {
    const user = userEvent.setup()
    const { auth, planner } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: "Next week" }))
    expect(screen.getByText("Next week")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Back to this week" }))
    expect(screen.getByText("This week")).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("opens the recipe a planned meal names", async () => {
    const user = userEvent.setup()
    const { auth, planner, meals } = await renderPlanner()
    meals([PLANNED])

    await user.click(screen.getByRole("button", { name: "Open Pancakes" }))
    expect(screen.getByText("recipe list")).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("starts on the list when the URL asks for it, and says what it covers", async () => {
    const { auth, planner, meals } = await renderPlanner("/plan?tab=list")
    meals([PLANNED])

    expect(screen.getByText("Shopping for")).toBeInTheDocument()
    // Five days are picked by default, and today's dinner is inside them.
    expect(screen.getByRole("button", { name: "Write up 1 meal" })).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("will not build with nothing planned in the picked days", async () => {
    const { auth, planner } = await renderPlanner("/plan?tab=list")

    expect(screen.getByRole("button", { name: /Write up 0 meals/ })).toBeDisabled()
    expect(screen.getByText(/Nothing planned on those days/)).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("ticks a row off, recording who did it", async () => {
    const user = userEvent.setup()
    const { auth, planner, store, items } = await renderPlanner("/plan?tab=list")

    items([
      item({ id: "i1", name: "flour", amount: "2 cups", section: "pantry" }),
      item({ id: "i2", name: "butter", section: "dairy", checked: true }),
    ])

    await user.click(screen.getByRole("checkbox", { name: /flour/ }))
    expect(store.setChecked).toHaveBeenCalledWith("s1", "i1", true, "u1")

    auth.dispose()
    planner.dispose()
  })

  it("walks the sections in store order rather than alphabetically", async () => {
    const { auth, planner, items } = await renderPlanner("/plan?tab=list")

    items([
      item({ id: "i1", name: "flour", section: "pantry" }),
      item({ id: "i2", name: "apples", section: "produce" }),
    ])

    const headings = screen.getAllByRole("heading", { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual(["Produce", "Pantry"])

    auth.dispose()
    planner.dispose()
  })

  it("lists the sessions you are in, and offers to start another", async () => {
    const user = userEvent.setup()
    const { auth, planner } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))

    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })
    expect(within(sheet).getByText("Start a new one")).toBeInTheDocument()
    expect(within(sheet).getByText("Cook (you)")).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("starts a session with the name and covers it was given", async () => {
    const user = userEvent.setup()
    const { auth, planner, store } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    await user.type(within(sheet).getByLabelText("Name for the new session"), "Camping trip")
    await user.click(within(sheet).getByRole("button", { name: "One more at the table" }))
    await user.click(within(sheet).getByRole("button", { name: "Start" }))

    expect(store.createSession).toHaveBeenCalledWith(
      { uid: "u1", name: "Cook", email: "cook@example.test" },
      "Camping trip",
      5
    )

    auth.dispose()
    planner.dispose()
  })

  it("names what deletion takes with it, and asks first", async () => {
    const user = userEvent.setup()
    const { auth, planner, store, meals, items } = await renderPlanner()
    meals([PLANNED])
    items([item({ id: "i1", name: "flour" }), item({ id: "i2", name: "butter" })])

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    await user.click(within(sheet).getByRole("button", { name: /Delete Weeknights/ }))
    expect(store.deleteSession).not.toHaveBeenCalled()

    // The counts are the point: "everything will be deleted" means nothing
    // until it says how much everything is.
    expect(within(sheet).getByText(/1 planned meal/)).toBeInTheDocument()
    expect(within(sheet).getByText(/2 items/)).toBeInTheDocument()

    await user.click(within(sheet).getByRole("button", { name: "Delete it" }))
    expect(store.deleteSession).toHaveBeenCalledWith("s1")

    auth.dispose()
    planner.dispose()
  })

  it("suggests people to ask in only once you type, rather than listing everyone", async () => {
    const user = userEvent.setup()
    const { auth, planner, store } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    // Nothing offered at rest — the roster grows with the app, and the sheet
    // must not grow with it.
    expect(within(sheet).queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument()

    await user.type(within(sheet).getByLabelText("Search people to ask in"), "amy")

    expect(within(sheet).getByText("Amy Ham")).toBeInTheDocument()
    expect(within(sheet).queryByText("B W")).not.toBeInTheDocument()

    await user.click(within(sheet).getByRole("button", { name: /Ask Amy Ham into Weeknights/ }))
    expect(store.invite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" }),
      expect.anything(),
      "amy@example.test"
    )

    auth.dispose()
    planner.dispose()
  })

  it("finds someone by address when their name is barely there", async () => {
    const user = userEvent.setup()
    const { auth, planner } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    await user.type(within(sheet).getByLabelText("Search people to ask in"), "bw@")
    expect(within(sheet).getByText("B W")).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("never offers to ask in somebody already in the session", async () => {
    const user = userEvent.setup()
    const { auth, planner } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    // "Cook" is the signed-in user and already a member.
    await user.type(within(sheet).getByLabelText("Search people to ask in"), "cook")
    expect(within(sheet).getByText(/Nobody here matches/)).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("backs out of deleting", async () => {
    const user = userEvent.setup()
    const { auth, planner, store } = await renderPlanner()

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    await user.click(within(sheet).getByRole("button", { name: /Delete Weeknights/ }))
    await user.click(within(sheet).getByRole("button", { name: "Keep it" }))

    expect(store.deleteSession).not.toHaveBeenCalled()
    expect(within(sheet).getByRole("button", { name: /Delete Weeknights/ })).toBeInTheDocument()

    auth.dispose()
    planner.dispose()
  })

  it("offers to leave, not delete, somebody else's session", async () => {
    const user = userEvent.setup()
    const { auth, planner, store } = await renderPlanner()

    act(() =>
      store.sessions([
        {
          ...SESSION,
          ownerUid: "u2",
          memberUids: ["u2", "u1"],
          members: [
            { uid: "u2", name: "Dev", email: "dev@example.test" },
            { uid: "u1", name: "Cook", email: "cook@example.test" },
          ],
        },
      ])
    )

    await user.click(screen.getByRole("button", { name: /Weeknights/ }))
    const sheet = screen.getByRole("dialog", { name: "Planning sessions" })

    expect(
      within(sheet).queryByRole("button", { name: /Delete Weeknights/ })
    ).not.toBeInTheDocument()

    await user.click(within(sheet).getByRole("button", { name: /Leave Weeknights/ }))
    expect(within(sheet).getByText(/session carries on without you/)).toBeInTheDocument()

    await user.click(within(sheet).getByRole("button", { name: "Leave" }))
    expect(store.leaveSession).toHaveBeenCalled()
    expect(store.deleteSession).not.toHaveBeenCalled()

    auth.dispose()
    planner.dispose()
  })
})
