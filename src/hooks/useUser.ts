import { useState, useEffect } from "react"
import useAuth from "./useAuth"

const useAuthState = () => {
  const auth: any = useAuth()
  const [user, setUser] = useState(auth.currentUser)

  useEffect(() => {
    const subscription = auth.onUserChange((user: any) => {
      setUser(user)
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return user
}

export default useAuthState
