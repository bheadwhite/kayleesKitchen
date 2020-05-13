import { useEffect, useState } from "react"
import useAuth from "./useAuth"
import { getUser } from "fire/services"

const useAuthUserDetails = () => {
  const { user: authUser } = useAuth()
  const [user, setUser] = useState(null)

  useEffect(() => {
    ;(async () => {
      if (authUser?.email != null) {
        const users = await getUser(authUser.email)
        setUser(users.docs[0].data())
      }
    })()
  }, [authUser])

  return user
}

export default useAuthUserDetails
