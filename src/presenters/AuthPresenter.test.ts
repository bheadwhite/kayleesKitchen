import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import { GoogleAuthProvider } from "firebase/auth"

import { AuthPresenter, SIGN_IN_CANCELLED } from "./AuthPresenter"

let emitAuthState: (user: unknown) => void = () => {}

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  GoogleAuthProvider: { credentialFromError: vi.fn(() => null) },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
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

describe("AuthPresenter — linking Google to an existing password account", () => {
  /** What Firebase throws when the Google email already has a password on it. */
  const conflict = () =>
    Object.assign(new Error("account exists"), {
      code: "auth/account-exists-with-different-credential",
      customData: { email: "cook@example.test" },
    })

  const credential = { providerId: "google.com" } as never

  beforeEach(() => {
    emitAuthState = () => {}
    vi.mocked(GoogleAuthProvider.credentialFromError).mockReturnValue(credential)
  })

  it("asks for the password instead of failing the sign-in", async () => {
    const googleSignIn = vi.fn().mockRejectedValue(conflict())
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()

    // Resolves rather than rejects: this is a step in the flow, not an error.
    await expect(presenter.logInWithGoogle()).resolves.toBeUndefined()
    expect(presenter.getPendingLinkEmail()).toBe("cook@example.test")
    await flush()
    expect(presenter.getStatus()).toBe("loggedOut")

    presenter.dispose()
  })

  it("links the held credential once the password checks out", async () => {
    const googleSignIn = vi.fn().mockRejectedValue(conflict())
    const googleLink = vi.fn().mockResolvedValue(undefined)
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn, googleLink)

    emitAuthState(null)
    await flush()
    await presenter.logInWithGoogle()

    await presenter.completeGoogleLink("hunter2")

    expect(googleLink).toHaveBeenCalledWith(authStub, {
      email: "cook@example.test",
      password: "hunter2",
      credential,
    })
    // Nothing left pending, so the login view goes back to its normal self.
    expect(presenter.getPendingLinkEmail()).toBeNull()

    presenter.dispose()
  })

  it("keeps the pending credential when the password is wrong", async () => {
    const googleSignIn = vi.fn().mockRejectedValue(conflict())
    const googleLink = vi.fn().mockRejectedValue(new Error("auth/invalid-credential"))
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn, googleLink)

    emitAuthState(null)
    await flush()
    await presenter.logInWithGoogle()

    await expect(presenter.completeGoogleLink("wrong")).rejects.toThrow()
    // Still pending — a second attempt must not need another trip through the popup.
    expect(presenter.getPendingLinkEmail()).toBe("cook@example.test")

    presenter.dispose()
  })

  it("drops the pending link when cancelled", async () => {
    const googleSignIn = vi.fn().mockRejectedValue(conflict())
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()
    await presenter.logInWithGoogle()

    presenter.cancelGoogleLink()
    expect(presenter.getPendingLinkEmail()).toBeNull()

    presenter.dispose()
  })

  it("stays an ordinary failure when Firebase gives no credential to link", async () => {
    vi.mocked(GoogleAuthProvider.credentialFromError).mockReturnValue(null)
    const googleSignIn = vi.fn().mockRejectedValue(conflict())
    const presenter = new AuthPresenter(authStub, noProfile, googleSignIn)

    emitAuthState(null)
    await flush()

    await expect(presenter.logInWithGoogle()).rejects.toThrow("account exists")
    expect(presenter.getPendingLinkEmail()).toBeNull()

    presenter.dispose()
  })
})
