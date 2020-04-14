import React from "react"
import { userRef } from "./firebase"

const useUsers = () => {
  const [users, setUsers] = React.useState([])

  userRef.onSnapshot((docs) => {
    const myUsers = []
    docs.forEach((doc) => myUsers.push(doc.data()))
    if (users.length !== myUsers.length) setUsers(myUsers)
  })

  return users
}

export default useUsers
