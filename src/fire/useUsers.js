import React from "react"
import { userRef } from "./firebase"

const useUsers = () => {
  const [users, setUsers] = React.useState([])

  React.useEffect(() => {}, [], [users])

  userRef.onSnapshot((docs) => docs.forEach((doc) => set))
}
