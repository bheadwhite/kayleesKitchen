import { useState, useEffect } from "react"
import useAuth from "./useAuth"

const useAuthState = () => {
  const auth = useAuth()
  const [state, setState] = useState(auth.state.getState())

  useEffect(() => {
    const subscription = auth.onStateChange((state) => {
      setState(state)
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return state
}

export default useAuthState
