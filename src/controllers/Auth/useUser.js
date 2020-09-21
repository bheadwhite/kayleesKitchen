import { useState, useEffect } from "react"
import useAuth from "./useAuth"

const useAuthState = () => {
  const auth = useAuth()
  const [user, setUser] = useState(auth.user.getState())

  useEffect(() => {
    const subscription = auth.onUserChange((user) => {
      setUser(user)
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return user
}

export default useAuthState
