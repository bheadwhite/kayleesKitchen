import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * These tests exist for one reason: **Firestore needs a composite index for a
 * filter on one field plus an `orderBy` on another**, and this project declares
 * indexes exactly as often as it declares rules — by hand, or never.
 *
 * A query that quietly grows an `orderBy` fails at runtime with
 * `failed-precondition`, which surfaces as a listener that returns nothing —
 * indistinguishable from an empty collection. That is not a failure any unit
 * test of the *presenter* can catch, because the presenter only ever sees "no
 * documents". So the query shapes are pinned here instead.
 */

const calls: Array<{ kind: string; args: unknown[] }> = []

const record = (kind: string) =>
  vi.fn((...args: unknown[]) => {
    calls.push({ kind, args })
    return { kind, args }
  })

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: record("limit"),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: record("orderBy"),
  query: vi.fn((...args: unknown[]) => args),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: record("where"),
  writeBatch: vi.fn(),
}))

vi.mock("./firebase", () => ({
  aiUsageRef: {},
  auth: {},
  db: {},
  inviteId: (a: string, b: string) => `${a}_${b}`,
  invitesRef: {},
  loginEventsRef: {},
  pantryRef: {},
  recipeScalingRef: vi.fn(() => ({})),
  recipeVariantsRef: vi.fn(() => ({})),
  recipeYieldRef: vi.fn(() => ({})),
  recipesRef: {},
  sessionMealsRef: vi.fn(() => ({})),
  sessionShoppingRef: vi.fn(() => ({})),
  sessionsRef: {},
  storage: {},
  tagsRef: {},
  userRef: {},
}))

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: class {},
  linkWithCredential: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}))

const services = await import("./services")

const fieldsUsed = (kind: string) =>
  calls.filter((call) => call.kind === kind).map((call) => call.args[0])

describe("query shapes that would need a composite index", () => {
  beforeEach(() => {
    calls.length = 0
  })

  it("finds your sessions by membership alone, and sorts them in memory", () => {
    services.onMySessionsSnapshot("u1", () => {})

    expect(fieldsUsed("where")).toEqual(["memberUids"])
    // The one that broke: `array-contains` on memberUids plus `orderBy` on
    // createdAt is a filter and an order on *different* fields.
    expect(fieldsUsed("orderBy")).toEqual([])
  })

  it("finds your invites by address alone", () => {
    services.onMyInvitesSnapshot("cook@example.test", () => {})

    expect(fieldsUsed("where")).toEqual(["toEmail"])
    expect(fieldsUsed("orderBy")).toEqual([])
  })

  it("orders the week by the same field it filters on", () => {
    services.onSessionMealsSnapshot("s1", "2026-08-06", () => {})

    // A range and an order on the *same* field is a single-field index, which
    // Firestore maintains automatically. This one is fine as it stands.
    expect(fieldsUsed("where")).toEqual(["date"])
    expect(fieldsUsed("orderBy")).toEqual(["date"])
  })

  it("reads the shopping list unfiltered and unordered", () => {
    services.onSessionShoppingSnapshot("s1", () => {})

    expect(fieldsUsed("where")).toEqual([])
    expect(fieldsUsed("orderBy")).toEqual([])
  })
})

describe("deleteSession", () => {
  it("still deletes the session when the asks cannot be swept", async () => {
    const firestore = await import("firebase/firestore")
    let getCall = 0

    // Meals and shopping read fine; the invites query is rejected — which is
    // what "rules are not filters" looks like from here. A leftover ask is a
    // nuisance; a session you cannot delete is not.
    vi.mocked(firestore.getDocs).mockImplementation(async () => {
      getCall += 1
      if (getCall > 2) throw Object.assign(new Error("Missing permissions"), {
        code: "permission-denied",
      })
      return { docs: [], empty: true } as never
    })
    vi.mocked(firestore.writeBatch).mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn(async () => {}),
    } as never)
    const deleted = vi.fn(async () => {})
    vi.mocked(firestore.deleteDoc).mockImplementation(deleted)

    await expect(services.deleteSession("s1")).resolves.toBeUndefined()
    expect(deleted).toHaveBeenCalled()
  })

  it("names the step that failed rather than failing anonymously", async () => {
    const firestore = await import("firebase/firestore")
    vi.mocked(firestore.getDocs).mockResolvedValue({ docs: [], empty: true } as never)
    vi.mocked(firestore.writeBatch).mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn(async () => {}),
    } as never)
    vi.mocked(firestore.deleteDoc).mockRejectedValue(
      Object.assign(new Error("Missing permissions"), { code: "permission-denied" })
    )

    await expect(services.deleteSession("s1")).rejects.toThrow(
      "deleting the session (permission-denied)"
    )
  })

  it("sweeps the children before the parent, or they can never be removed", async () => {
    const firestore = await import("firebase/firestore")
    const order: string[] = []

    vi.mocked(firestore.getDocs).mockResolvedValue({
      docs: [{ ref: { path: "child" } }],
      empty: false,
    } as never)
    vi.mocked(firestore.writeBatch).mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn(async () => {
        order.push("children")
      }),
    } as never)
    vi.mocked(firestore.deleteDoc).mockImplementation(async () => {
      order.push("session")
    })

    await services.deleteSession("s1")

    // The rules guarding meals and shopping read the session document to check
    // membership. Delete it first and the permission to clear the children is
    // revoked with it, orphaning them for good.
    expect(order[order.length - 1]).toBe("session")
    expect(order).toContain("children")
  })
})

describe("onMySessionsSnapshot", () => {
  it("puts the newest first, with a just-written session at the top", async () => {
    const firestore = await import("firebase/firestore")
    let emit: (snapshot: unknown) => void = () => {}
    vi.mocked(firestore.onSnapshot).mockImplementation(((_q: unknown, next: unknown) => {
      emit = next as (snapshot: unknown) => void
      return () => {}
    }) as never)

    const seen: string[][] = []
    services.onMySessionsSnapshot("u1", (sessions) => seen.push(sessions.map((s) => s.id)))

    const at = (iso: string | null) => (iso == null ? null : { toDate: () => new Date(iso) })
    emit({
      docs: [
        { id: "old", data: () => ({ createdAt: at("2026-01-01") }) },
        { id: "new", data: () => ({ createdAt: at("2026-08-01") }) },
        // Written a moment ago; the server stamp has not landed yet.
        { id: "pending", data: () => ({ createdAt: at(null) }) },
      ],
    })

    expect(seen[0]).toEqual(["pending", "new", "old"])
  })
})
