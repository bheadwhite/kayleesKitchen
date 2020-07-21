import { useState, useEffect } from "react"
import useAuth from "./useAuth"

const useAuthState = () => {
  const auth = useAuth()
  const [state, setState] = useState(auth.state)

  useEffect(() => {
    const subscription = auth.onChange((state) => {
      setState(state)
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return state
}

export default useAuthState
