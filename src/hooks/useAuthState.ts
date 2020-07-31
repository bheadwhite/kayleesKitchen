import { useState, useEffect } from "react"
import useAuth from "./useAuth"

const useAuthState = () => {
  const auth: any = useAuth()
  const [state, setState] = useState<any>(auth.state)

  useEffect(() => {
    const subscription = auth.onChange((state: any) => {
      setState(state)
    })
    return () => subscription.unsubscribe()
  }, [auth])

  return state
}

export default useAuthState
