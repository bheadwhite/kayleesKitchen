import { Runner, Signal, Status, derive, type DerivedSignal } from "@tcn/state/core"
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type AuthCredential,
  type User,
} from "firebase/auth"

import {
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL,
  getUserProfile,
  linkGoogleToExistingAccount,
  loginWithGoogle,
  recordLogin,
} from "fire/services"
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
type GoogleLink = (
  auth: Auth,
  details: { email: string; password: string; credential: AuthCredential }
) => Promise<unknown>

/**
 * Rejection message produced by {@link AuthPresenter.cancelLogin}. Views match on
 * it to stay quiet — an abandoned sign-in is not an error worth reporting.
 */
export const SIGN_IN_CANCELLED = "Sign-in cancelled."

/** Reads the email Firebase attaches to a failed sign-in, if it is there. */
const emailFromError = (error: unknown): string | null => {
  if (typeof error !== "object" || error == null) return null
  const data = (error as { customData?: { email?: unknown } }).customData
  return typeof data?.email === "string" ? data.email : null
}

const hasCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error != null &&
  "code" in error &&
  (error as { code: unknown }).code === code

export class AuthPresenter {
  private readonly _user = new Signal<SessionUser | null>(null)
  /** True until the Firebase auth listener has reported for the first time. */
  private readonly _initializing = new Signal(true)
  private readonly _loginRunner = new Runner<void>(undefined)
  private readonly _logoutRunner = new Runner<void>(undefined)
  private readonly _status: DerivedSignal<AuthStatus>
  private readonly _unsubscribeAuth: () => void
  /**
   * Set when Google sign-in stopped because the email already has a password
   * account. The email is public — the view prompts with it — while the
   * credential stays here: nothing outside this class should be handling a raw
   * `AuthCredential`.
   */
  private readonly _linkEmail = new Signal<string | null>(null)
  private _linkCredential: AuthCredential | null = null

  constructor(
    private readonly auth: Auth,
    private readonly lookupProfile: ProfileLookup = getUserProfile,
    private readonly googleSignIn: GoogleSignIn = loginWithGoogle,
    private readonly googleLink: GoogleLink = linkGoogleToExistingAccount
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

  /**
   * The email whose password is needed to finish linking Google, or null when
   * no link is pending.
   */
  get linkEmailBroadcast() {
    return this._linkEmail.broadcast
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
      const credential = await signInWithEmailAndPassword(this.auth, email, password)
      // Explicit sign-ins only. Restoring a persisted session on page load is
      // not a login, and logging it would make this a page-view counter.
      recordLogin(credential.user, "password")
    })
  }

  /**
   * Shares `_loginRunner` with {@link logIn} so the derived status reports
   * "loggingIn" for either path and the views need no extra branch.
   *
   * One failure is not treated as an error: if the Google account's email
   * already has a password on it, Firebase refuses the sign-in rather than
   * merging the two. That is a step in the flow, not a dead end — the pending
   * credential is held and {@link linkEmailBroadcast} tells the view to ask for
   * the password, after which {@link completeGoogleLink} joins them for good.
   */
  logInWithGoogle() {
    return this._loginRunner.execute(async () => {
      try {
        await this.googleSignIn(this.auth)
        if (this.auth.currentUser) recordLogin(this.auth.currentUser, "google")
        this._clearPendingLink()
      } catch (error) {
        const email = emailFromError(error)
        const credential = GoogleAuthProvider.credentialFromError(error as never)

        // Without both halves there is nothing to link with, so this stays an
        // ordinary failure for the view to report.
        if (
          !hasCode(error, ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL) ||
          email == null ||
          credential == null
        ) {
          throw error
        }

        this._linkCredential = credential
        this._linkEmail.set(email)
      }
    })
  }

  /**
   * Finishes what {@link logInWithGoogle} started: signs in with the password
   * already on the account and attaches the held Google credential to it.
   *
   * Rejects if the password is wrong — the pending credential is kept so the
   * view can let them try again rather than sending them back through the popup.
   */
  completeGoogleLink(password: string) {
    return this._loginRunner.execute(async () => {
      const email = this._linkEmail.get()
      const credential = this._linkCredential
      if (email == null || credential == null) return

      await this.googleLink(this.auth, { email, password, credential })
      if (this.auth.currentUser) recordLogin(this.auth.currentUser, "google")
      this._clearPendingLink()
    })
  }

  /** Abandons a pending link — the account is untouched and still has its password. */
  cancelGoogleLink() {
    this._clearPendingLink()
  }

  /** Synchronous read, for callers deciding what to do right after an `await`. */
  getPendingLinkEmail() {
    return this._linkEmail.get()
  }

  private _clearPendingLink() {
    this._linkCredential = null
    if (this._linkEmail.get() != null) this._linkEmail.set(null)
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
    this._linkEmail.dispose()
    this._status.dispose()
    this._loginRunner.dispose()
    this._logoutRunner.dispose()
    this._initializing.dispose()
    this._user.dispose()
  }
}
