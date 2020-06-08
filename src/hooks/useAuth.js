import { useContext } from "react"
import AuthenticationContext from "contexts/AuthenticationContext"

const useAuth = () => {
  return useContext(AuthenticationContext)
}

export default useAuth
