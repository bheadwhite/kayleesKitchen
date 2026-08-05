import { Runner, Signal, Status, derive, type DerivedSignal } from "@tcn/state/core"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth"

import { getUserProfile, loginWithGoogle } from "fire/services"
import type { SessionUser } from "@/types"

/**
 * Replaces the hand-rolled xstate chart in the old `logic/AuthStateMachine`.
 * The states are now *derived* from the two runners plus the auth listener
 * rather than transitioned by hand, so they cannot drift out of sync.
 */
export type AuthStatus =
  | "initializing"
  | "loggingIn"
  | "loggingOut"
  | "loggedIn"
  | "loggedOut"

type ProfileLookup = (email: string) => Promise<{ firstName: string; lastName: string } | null>
type GoogleSignIn = (auth: Auth) => Promise<unknown>

/**
 * Rejection message produced by {@link AuthPresenter.cancelLogin}. Views match on
 * it to stay quiet — an abandoned sign-in is not an error worth reporting.
 */
export const SIGN_IN_CANCELLED = "Sign-in cancelled."

export class AuthPresenter {
  private readonly _user = new Signal<SessionUser | null>(null)
  /** True until the Firebase auth listener has reported for the first time. */
  private readonly _initializing = new Signal(true)
  private readonly _loginRunner = new Runner<void>(undefined)
  private readonly _logoutRunner = new Runner<void>(undefined)
  private readonly _status: DerivedSignal<AuthStatus>
  private readonly _unsubscribeAuth: () => void

  constructor(
    private readonly auth: Auth,
    private readonly lookupProfile: ProfileLookup = getUserProfile,
    private readonly googleSignIn: GoogleSignIn = loginWithGoogle
  ) {
    this._status = derive(
      this._initializing.broadcast,
      this._user.broadcast,
      this._loginRunner.stateBroadcast,
      this._logoutRunner.stateBroadcast,
      (initializing, user, login, logout): AuthStatus => {
        if (initializing) return "initializing"
        if (login.status === Status.PENDING) return "loggingIn"
        if (logout.status === Status.PENDING) return "loggingOut"
        return user != null ? "loggedIn" : "loggedOut"
      }
    )

    this._unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
      void this._onAuthStateChanged(user)
    })
  }

  get userBroadcast() {
    return this._user.broadcast
  }

  get statusBroadcast() {
    return this._status.broadcast
  }

  get loginRunnerBroadcast() {
    return this._loginRunner.broadcast
  }

  get logoutRunnerBroadcast() {
    return this._logoutRunner.broadcast
  }

  getUser() {
    return this._user.get()
  }

  getStatus() {
    return this._status.get()
  }

  private async _onAuthStateChanged(user: User | null) {
    try {
      this._user.set(user ? await this._toSessionUser(user) : null)
    } finally {
      // Only flips once — after this the guard trusts `_user`.
      if (this._initializing.get()) this._initializing.set(false)
    }
  }

  /**
   * Merges the Firebase auth identity with the `users` profile document.
   * A missing or unreadable profile is not fatal — the user stays signed in
   * with a null display name. (The old `useUser` threw on `docs[0]` here.)
   */
  private async _toSessionUser(user: User): Promise<SessionUser> {
    const base: SessionUser = {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName,
      photoURL: user.photoURL,
    }

    if (!base.email) return base

    try {
      const profile = await this.lookupProfile(base.email)
      if (profile) {
        return { ...base, displayName: `${profile.firstName} ${profile.lastName}`.trim() }
      }
    } catch (error) {
      console.warn("Could not load user profile", error)
    }

    return base
  }

  logIn(email: string, password: string) {
    return this._loginRunner.execute(async () => {
      await signInWithEmailAndPassword(this.auth, email, password)
    })
  }

  /**
   * Shares `_loginRunner` with {@link logIn} so the derived status reports
   * "loggingIn" for either path and the views need no extra branch.
   */
  logInWithGoogle() {
    return this._loginRunner.execute(async () => {
      await this.googleSignIn(this.auth)
    })
  }

  /**
   * Abandons an in-flight sign-in and returns the status to `loggedOut`.
   *
   * `signInWithPopup` does not reliably reject when its window is dismissed —
   * on mobile it opens a tab rather than a popup, and Firebase's "did the popup
   * close" polling can never fire, leaving the promise pending forever and the
   * login view stuck on a spinner. This is the way out of that.
   *
   * No-op unless a login is actually pending, and safe to lose a race with a
   * sign-in that does eventually succeed: the auth listener still fires, and the
   * derived status reads `loggedIn` from the user rather than from this runner.
   */
  cancelLogin() {
    this._loginRunner.cancel(SIGN_IN_CANCELLED)
  }

  logOut() {
    return this._logoutRunner.execute(async () => {
      await signOut(this.auth)
    })
  }

  dispose() {
    this._unsubscribeAuth()
    this._status.dispose()
    this._loginRunner.dispose()
    this._logoutRunner.dispose()
    this._initializing.dispose()
    this._user.dispose()
  }
}
