import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
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

  useEffect(() => {
    // Only dispose presenters this provider created — an injected one is the
    // caller's to tear down.
    if (presenter) return
    return () => value.dispose()
  }, [value, presenter])

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

export default AuthProvider
