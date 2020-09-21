import React, { useMemo } from "react"
import Auth from "controllers/Auth"
import MockFirebaseAuth from "logic/MockFireBaseAuth"

export const AuthContext = React.createContext(new Auth(new MockFirebaseAuth()))

const AuthProvider = ({ auth, children }) => {
  const authentication = useMemo(() => {
    if (auth) {
      return auth
    } else {
      return new MockFirebaseAuth()
    }
  }, [auth])

  return (
    <AuthContext.Provider value={authentication}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
