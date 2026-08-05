import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useSignalValue } from "@tcn/state/react"

import { auth } from "fire/firebase"
import { AuthPresenter } from "presenters/AuthPresenter"

const AuthContext = createContext<AuthPresenter | null>(null)

interface AuthProviderProps {
  children: ReactNode
  /** Inject a presenter in tests; otherwise one is created over the real Firebase auth. */
  presenter?: AuthPresenter
}

export const AuthProvider = ({ children, presenter }: AuthProviderProps) => {
  const value = useMemo(() => presenter ?? new AuthPresenter(auth), [presenter])

  // Deliberately NOT disposed on unmount. This provider sits at the app root, so
  // the presenter's lifetime is the page's. Disposing it in an effect cleanup
  // breaks under <StrictMode>, which mounts / unmounts / remounts every effect in
  // development: the cleanup disposes the presenter, but `useMemo` does not re-run
  // on the remount, leaving the app wired to a dead presenter — the Firebase auth
  // listener is unsubscribed and the derived status never leaves "initializing".
  // An injected presenter is the caller's to dispose.

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthPresenter = () => {
  const presenter = useContext(AuthContext)
  if (presenter == null) {
    throw new Error("useAuthPresenter must be used inside an <AuthProvider>")
  }
  return presenter
}

/** "initializing" | "loggingIn" | "loggingOut" | "loggedIn" | "loggedOut" */
export const useAuthStatus = () => useSignalValue(useAuthPresenter().statusBroadcast)

export const useSessionUser = () => useSignalValue(useAuthPresenter().userBroadcast)

/**
 * The email whose password is needed to finish linking a Google sign-in, or
 * null when nothing is pending. See `AuthPresenter.logInWithGoogle`.
 */
export const usePendingLinkEmail = () => useSignalValue(useAuthPresenter().linkEmailBroadcast)

export default AuthProvider
