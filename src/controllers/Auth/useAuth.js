import { useContext } from "react"
import { AuthContext } from "contexts/AuthProvider"

export default () => {
  return useContext(AuthContext)
}
