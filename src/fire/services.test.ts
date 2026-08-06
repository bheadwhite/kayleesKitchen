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

/**
 * The real normaliser, hoisted so the `./firebase` mock below can key documents
 * the way production does. Mocking it as a passthrough would leave the two
 * tests at the bottom of this file asserting nothing.
 */
const { normalise } = vi.hoisted(() => ({
  normalise: (raw: string) => raw.trim().toLowerCase(),
}))

vi.mock("./firebase", () => ({
  aiUsageRef: {},
  auth: {},
  db: {},
  inviteId: (a: string, b: string) => `${normalise(a)}_${b}`,
  invitesRef: {},
  loginEventsRef: {},
  pantryRef: {},
  profileRef: (email: string) => ({ id: normalise(email) }),
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

/**
 * Two documents in this app are keyed by an email address, and both have a
 * rule pinning the id to the address stored *inside* the document —
 * `users/{email}` and `invites/{toEmail}_{sessionId}`. Neither pin can be
 * checked by the client, and getting one wrong fails in a way nobody reports:
 * a second profile for a person who then appears twice in the picker, or an
 * ask that is written successfully and is invisible to the person it names.
 *
 * So both are asserted here in the shape the rule states them, rather than
 * against a hard-coded lowercase string — a test that says
 * `expect(id).toBe("kaylee@…")` passes just as happily when the field beside it
 * has drifted out of step.
 */
describe("addresses used as document ids", () => {
  const capitalised = "Kaylee.Whitehead1@gmail.com"

  it("files one profile per person, however the address was typed", async () => {
    const firestore = await import("firebase/firestore")
    const auth = await import("firebase/auth")
    vi.mocked(auth.createUserWithEmailAndPassword).mockResolvedValue({} as never)
    vi.mocked(firestore.getDoc).mockResolvedValue({ exists: () => false } as never)
    vi.mocked(firestore.setDoc).mockClear()

    await services.addUser({
      firstName: "Kaylee",
      lastName: "Whitehead",
      email: capitalised,
      password: "secret",
      confirmPassword: "secret",
    } as never)

    const [ref, written] = vi.mocked(firestore.setDoc).mock.calls[0] as unknown as [
      { id: string },
      { email: string; password?: string },
    ]
    // The rule is `docId == request.resource.data.email`. Write a raw address
    // into a normalised id and every registration is rejected outright.
    expect(ref.id).toBe(written.email)
    // Same person, so the account Firebase just lowercased must find it.
    expect(ref.id).toBe(capitalised.toLowerCase())
    expect(written.password).toBeUndefined()
  })

  it("leaves an existing profile alone rather than filing a second spelling", async () => {
    const firestore = await import("firebase/firestore")
    vi.mocked(firestore.getDoc).mockResolvedValue({ exists: () => true } as never)
    vi.mocked(firestore.setDoc).mockClear()

    // Registered by email as `Kaylee.…`, now arriving through Google, whose
    // token carries `kaylee.…`. Before the id was normalised this wrote the
    // duplicate that put her in the picker twice.
    await services.ensureUserProfile({
      email: capitalised.toLowerCase(),
      displayName: "Kaylee Whitehead",
    } as never)

    expect(firestore.setDoc).not.toHaveBeenCalled()
  })

  it("addresses an ask so its own recipient can find it", async () => {
    const firestore = await import("firebase/firestore")
    vi.mocked(firestore.setDoc).mockClear()
    vi.mocked(firestore.doc).mockImplementation(((_db: unknown, _path: string, id: string) =>
      ({ id })) as never)

    await services.inviteToSession(
      { id: "s1", name: "Whiteheads", covers: 5 } as never,
      { uid: "u1", name: "Brent" } as never,
      capitalised
    )

    const [ref, written] = vi.mocked(firestore.setDoc).mock.calls[0] as unknown as [
      { id: string },
      { toEmail: string },
    ]
    // The create rule pins the id to the field, and the recipient's listener
    // queries the field against the address on their token.
    expect(ref.id).toBe(`${written.toEmail}_s1`)
    expect(written.toEmail).toBe(capitalised.toLowerCase())
  })
})
