import { authRef } from "./firebase"

export const loginWithEmail = ({ email, password }) =>
  new Promise(async (res, rej) => {
    try {
      const response = authRef.signInWithEmailAndPassword(email, password)
      res(response)
    } catch (error) {
      rej(new Error(error))
    }
  })
