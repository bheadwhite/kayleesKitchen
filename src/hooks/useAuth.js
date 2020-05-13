import { useEffect, useState } from "react"
import { authRef } from "fire/firebase"
import { getUser } from "fire/services"

const useAuth = () => {
  const [authState, setAuthState] = useState({ isLoading: true, user: null })

  useEffect(() => {
    const unsubcribe = authRef.onAuthStateChanged(async (state) => {
      if ((state == null && authState.isLoading === true) || state !== authState.user) {
        if (state.displayName == null) {
          const user = await getUser(state.email)
          const { firstName, lastName } = user.docs[0].data()
          const fbUser = authRef.currentUser
          fbUser.updateProfile({ displayName: `${firstName} ${lastName}` })
        }
        setAuthState({ isLoading: false, user: state })
      }
    })
    return unsubcribe
  }, [authState])

  return authState
}

export default useAuth
