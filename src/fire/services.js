import { authRef, userRef, recipesRef } from "./firebase"

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

export const getUser = (email) =>
  new Promise(async (res, rej) => {
    try {
      res(await userRef.where("email", "==", email).get())
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

export const getRecipes = () =>
  new Promise(async (res, rej) => {
    try {
      const docs = await recipesRef.get()
      res(docs)
    } catch (error) {
      rej(new Error(error))
    }
  })

export const getRecipesByEmail = (email) =>
  new Promise(async (res, rej) => {
    try {
      const docs = await recipesRef.where("email", "==", email).get()
      res(docs)
    } catch (error) {
      rej(new Error(error))
    }
  })

export const addRecipe = (recipe) =>
  new Promise(async (res, rej) => {
    try {
      res(await recipesRef.add(recipe))
    } catch (e) {
      rej(e)
    }
  })

export const getRecipeById = (recipe) =>
  new Promise(async (res, rej) => {
    try {
      res(await recipesRef.add(recipe))
    } catch (e) {
      rej(e)
    }
  })

export const updateRecipeById = (id, recipe) =>
  new Promise(async (res, rej) => {
    try {
      res(await recipesRef.doc(id).update(recipe))
    } catch (e) {
      rej(e)
    }
  })
