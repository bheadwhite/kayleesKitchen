import { authRef, userRef, recipesRef, storageRef, ratingsRef } from "./firebase"

export const loginWithEmail = ({ email, password }) =>
  Promise.resolve(authRef.signInWithEmailAndPassword(email, password))

export const createAuthUser = (email, password) =>
  Promise.resolve(authRef.createUserWithEmailAndPassword(email, password))

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

export const getUser = (email) => Promise.resolve(userRef.where("email", "==", email).get())

export const signOut = () => Promise.resolve(authRef.signOut())

export const getRecipes = () => Promise.resolve(recipesRef.get())

export const getRatings = () => Promise.resolve(ratingsRef.get())
export const getMyRatingByIdAndEmail = (id, email) =>
  new Promise((res, rej) => {
    ratingsRef
      .where("recipeId", "==", id)
      .get()
      .then((response) => {
        const { scores } = response.docs[0].data()
        const rating = scores.find((score) => score.userId === email)
        if (rating != null) {
          res({ score: rating.score, id: response.docs[0].id })
        } else {
          res(0)
        }
      })
      .catch((err) => rej(err))
  })
export const updateRatingByIdAndEmail = (id, email, score) =>
  Promise.resolve(ratingsRef.doc(id).update())

export const getRecipesByEmail = (email) =>
  Promise.resolve(recipesRef.where("email", "==", email).get())

export const addRecipe = (recipe) => Promise.resolve(recipesRef.add(recipe))

export const getRecipeById = (recipe) => Promise.resolve(recipesRef.add(recipe))

export const updateRecipeById = (id, recipe) => Promise.resolve(recipesRef.doc(id).update(recipe))

export const uploadRecipeEditorImage = (file, name) =>
  Promise.resolve(storageRef.ref().child(`${name}/recipeEditor.png`).put(file))

export const uploadImageToRecipeId = (file, name, recipeId) =>
  Promise.resolve(storageRef.ref().child(`${name}/${recipeId}.png`).put(file))

export const getImageUrlByEmailId = (email, recipeId) =>
  Promise.resolve(storageRef.ref(`${email}/${recipeId}.png`).getDownloadURL())

export const deleteRecipeById = (id) => Promise.resolve(recipesRef.doc(id).delete())