import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import { AuthPresenter, SIGN_IN_CANCELLED } from "./AuthPresenter"

let emitAuthState: (user: unknown) => void = () => {}

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
}))

const authStub = {} as Auth
const noProfile = vi.fn().mockResolvedValue(null)

/** `derive()` batches on a microtask, so status lands one tick late. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("AuthPresenter.logInWithGoogle", () => {
  beforeEach(() => {
    emitAuthState = () => {}
  })

  it("signs in through the injected Google flow", async () => {
    const googleSignIn = vi.fn().mockResolvedValue(undefined)
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()
    expect(presenter.getStatus()).toBe("loggedOut")

    await presenter.logInWithGoogle()
    expect(googleSignIn).toHaveBeenCalledWith(authStub)

    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: "Cook" })
    await flush()
    expect(presenter.getStatus()).toBe("loggedIn")

    presenter.dispose()
  })

  it("reports 'loggingIn' while the popup is open", async () => {
    let resolveSignIn: () => void = () => {}
    const googleSignIn = vi.fn(() => new Promise<void>((resolve) => (resolveSignIn = resolve)))
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()

    const pending = presenter.logInWithGoogle()
    await flush()
    expect(presenter.getStatus()).toBe("loggingIn")

    resolveSignIn()
    await pending
    presenter.dispose()
  })

  it("recovers from a popup that never settles", async () => {
    // `signInWithPopup` can hang forever when its window is dismissed — the
    // status must not be stuck on "loggingIn" because of it.
    const googleSignIn = vi.fn(() => new Promise<void>(() => {}))
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()

    const pending = presenter.logInWithGoogle()
    await flush()
    expect(presenter.getStatus()).toBe("loggingIn")

    presenter.cancelLogin()
    await expect(pending).rejects.toThrow(SIGN_IN_CANCELLED)
    await flush()
    expect(presenter.getStatus()).toBe("loggedOut")

    presenter.dispose()
  })

  it("ignores a cancel when no sign-in is in flight", async () => {
    const googleSignIn = vi.fn().mockResolvedValue(undefined)
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: "Cook" })
    await flush()
    expect(presenter.getStatus()).toBe("loggedIn")

    presenter.cancelLogin()
    await flush()
    expect(presenter.getStatus()).toBe("loggedIn")

    presenter.dispose()
  })

  it("propagates a rejected popup so the view can toast it", async () => {
    const googleSignIn = vi.fn().mockRejectedValue(new Error("popup closed"))
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()

    await expect(presenter.logInWithGoogle()).rejects.toThrow("popup closed")
    await flush()
    expect(presenter.getStatus()).toBe("loggedOut")

    presenter.dispose()
  })
})
