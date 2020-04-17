import { useEffect, useState } from "react"
import { authRef } from "fire/firebase"

const useAuth = () => {
  const [authState, setAuthState] = useState({ isLoading: true, user: null })

  useEffect(() => {
    const unsubcribe = authRef.onAuthStateChanged((state) => {
      if (authState.user !== state) {
        setAuthState({ isLoading: false, user: state })
      }
    })
    return unsubcribe
  }, [authState])

  return authState
}

export default useAuth
