import { unpackRecipes } from "src/fire/unpackers";
import { authRef, userRef, recipesRef, storageRef } from "./firebase";
import { RegisterUserFormValues } from "src/types/types";

export const loginWithEmail = ({ email, password }) =>
  Promise.resolve(authRef.signInWithEmailAndPassword(email, password));

export const createAuthUser = (email, password) =>
  Promise.resolve(authRef.createUserWithEmailAndPassword(email, password));

export const addUser = async (user: RegisterUserFormValues) => {
  try {
    const snapshot = await userRef.where("email", "==", user.email).get();
    if (snapshot.docs.length === 0) {
      const clone: Partial<RegisterUserFormValues> = { ...user };
      delete clone.password;
      delete clone.confirmPassword;
      await userRef.add(clone);
    }
    return createAuthUser(user.email, user.password);
  } catch (e) {
    console.error(e);
  }
};

export const getUser = (email) =>
  Promise.resolve(userRef.where("email", "==", email).get());

export const signOut = () => Promise.resolve(authRef.signOut());

export const getRecipes = async () => {
  const snapshot = await recipesRef.get();
  return unpackRecipes(snapshot);
};

export const getRecipesByEmail = async (email) => {
  const snapshot = await recipesRef.where("email", "==", email).get();
  return unpackRecipes(snapshot);
};

export const addRecipe = (recipe) => Promise.resolve(recipesRef.add(recipe));

export const getRecipeById = (recipe) =>
  Promise.resolve(recipesRef.add(recipe));

export const updateRecipeById = (id, recipe) =>
  Promise.resolve(recipesRef.doc(id).update(recipe));

export const uploadRecipeEditorImage = (file, name) =>
  Promise.resolve(storageRef.ref().child(`${name}/recipeEditor.png`).put(file));

export const uploadImageToRecipeId = (file, name, recipeId) =>
  Promise.resolve(storageRef.ref().child(`${name}/${recipeId}.png`).put(file));

export const getImageUrlByEmailId = (email, recipeId) =>
  Promise.resolve(storageRef.ref(`${email}/${recipeId}.png`).getDownloadURL());

export const deleteRecipeById = (id) =>
  Promise.resolve(recipesRef.doc(id).delete());
