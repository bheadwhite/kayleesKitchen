import { authRef, userRef } from "./firebase"

export const loginWithEmail = ({ email, password }) =>
  new Promise(async (res, rej) => {
    try {
      const response = authRef.signInWithEmailAndPassword(email, password)
      res(response)
    } catch (error) {
      rej(new Error(error))
    }
  })

export const createAuthUser = (email, password) =>
  new Promise(async (res, rej) => {
    try {
      const response = authRef.createUserWithEmailAndPassword(email, password)
      res(response)
    } catch (error) {
      rej(new Error(error))
    }
  })

export const addUser = (user) =>
  new Promise(async (res, rej) => {
    try {
      const getUser = await userRef.where("email", "==", user.email).get()
      if (getUser.docs.length === 0) {
        const clone = { ...user }
        delete clone.password
        delete clone.confirmPassword
        await userRef.add(clone)
      }
      res(createAuthUser(user.email, user.password))
    } catch (error) {
      rej(new Error(error))
    }
  })

export const signOut = () =>
  new Promise(async (res, rej) => {
    try {
      res(authRef.signOut())
    } catch (error) {
      rej(new Error(error))
    }
  })
