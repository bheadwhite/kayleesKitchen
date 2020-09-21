import { useState, useEffect } from "react"
import { getUser } from "fire/services"

import useAuth from "./useAuth"

const useAuthState = () => {
  const auth = useAuth()
  const [user, setUser] = useState(auth.user.getState())

  useEffect(() => {
    const subscription = auth.onUserChange((user) => {
      getUser(user.email).then((res) => {
        const data = res.docs[0].data()
        setUser({ ...user, displayName: `${data.firstName} ${data.lastName}` })
      })
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return user
}

export default useAuthState
