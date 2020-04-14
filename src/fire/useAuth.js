import React from "react"
import { authRef } from "./firebase"

const useAuth = () => {
  authRef.onAuthStateChanged((state) => {
    console.log("state changed", state)
  })
}

export default useAuth
