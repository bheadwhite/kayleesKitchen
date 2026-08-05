import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth"
import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type QuerySnapshot,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"

import { auth, db, recipesRef, storage, userRef } from "./firebase"
import type { Recipe, RegisterValues, UserProfile } from "@/types"

/* ------------------------------------------------------------------ auth */

export const loginWithEmail = ({ email, password }: { email: string; password: string }) =>
  signInWithEmailAndPassword(auth, email, password)

export const createAuthUser = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)

export const signOut = () => firebaseSignOut(auth)

/**
 * Creates the `users` profile document (if one does not already exist for this
 * email) and then the Firebase auth account. Password fields are stripped
 * before the profile is written.
 */
export const addUser = async (values: RegisterValues): Promise<UserCredential> => {
  const existing = await getDocs(query(userRef, where("email", "==", values.email)))

  if (existing.docs.length === 0) {
    const { password: _password, confirmPassword: _confirmPassword, ...profile } = values
    await addDoc(userRef, profile)
  }

  return createAuthUser(values.email, values.password)
}

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
  const snapshot = await getDocs(query(userRef, where("email", "==", email)))
  const first = snapshot.docs[0]
  return first ? (first.data() as UserProfile) : null
}

/**
 * Google accounts never pass through <Register>, so nothing has written their
 * `users` profile document. Split the Google display name into the first/last
 * pair the rest of the app expects. No-op when a profile already exists, so a
 * user who registered with email and later signs in with Google keeps theirs.
 */
export const ensureUserProfile = async (user: User): Promise<void> => {
  if (!user.email) return

  const existing = await getDocs(query(userRef, where("email", "==", user.email)))
  if (existing.docs.length > 0) return

  const [firstName = "", ...rest] = (user.displayName ?? "").trim().split(/\s+/)
  await addDoc(userRef, { firstName, lastName: rest.join(" "), email: user.email })
}

const googleProvider = new GoogleAuthProvider()

/**
 * Popup — not redirect — so the SPA keeps its in-memory state and the caller
 * gets a promise it can await. A profile document is created on first sign-in.
 */
export const loginWithGoogle = async (authInstance: Auth = auth): Promise<UserCredential> => {
  const credential = await signInWithPopup(authInstance, googleProvider)
  await ensureUserProfile(credential.user)
  return credential
}

/* --------------------------------------------------------------- recipes */

const toRecipe = (id: string, data: Record<string, unknown>): Recipe =>
  ({ ...data, id }) as Recipe

export const getRecipes = async (): Promise<Recipe[]> => {
  const snapshot = await getDocs(recipesRef)
  return snapshot.docs.map((d) => toRecipe(d.id, d.data()))
}

export const getRecipesByEmail = async (email: string): Promise<Recipe[]> => {
  const snapshot = await getDocs(query(recipesRef, where("email", "==", email)))
  return snapshot.docs.map((d) => toRecipe(d.id, d.data()))
}

export const getRecipeById = async (id: string): Promise<Recipe | null> => {
  const snapshot = await getDoc(doc(db, "recipes", id))
  return snapshot.exists() ? toRecipe(snapshot.id, snapshot.data()) : null
}

export const addRecipe = (recipe: Omit<Recipe, "id">) => addDoc(recipesRef, recipe)

export const updateRecipeById = (id: string, recipe: Omit<Recipe, "id">) =>
  updateDoc(doc(db, "recipes", id), { ...recipe })

export const deleteRecipeById = (id: string) => deleteDoc(doc(db, "recipes", id))

const mapSnapshot = (snapshot: QuerySnapshot): Recipe[] =>
  snapshot.docs.map((d) => toRecipe(d.id, d.data()))

/** Live listener over every recipe. Returns the unsubscribe function. */
export const onRecipesSnapshot = (callback: (recipes: Recipe[]) => void) =>
  onSnapshot(recipesRef, (snapshot) => callback(mapSnapshot(snapshot)))

/** Live listener over one user's recipes. Returns the unsubscribe function. */
export const onRecipesByEmailSnapshot = (
  email: string,
  callback: (recipes: Recipe[]) => void
) =>
  onSnapshot(query(recipesRef, where("email", "==", email)), (snapshot) =>
    callback(mapSnapshot(snapshot))
  )

/* --------------------------------------------------------------- storage */

/**
 * Scratch upload used by the editor before a recipe id exists.
 * Resolves to the download URL.
 */
export const uploadRecipeEditorImage = async (file: File, email: string) => {
  const result = await uploadBytes(ref(storage, `${email}/recipeEditor.png`), file)
  return getDownloadURL(result.ref)
}

/** Final upload, keyed by recipe id. Resolves to the download URL. */
export const uploadImageToRecipeId = async (file: File, email: string, recipeId: string) => {
  const result = await uploadBytes(ref(storage, `${email}/${recipeId}.png`), file)
  return getDownloadURL(result.ref)
}

export const getImageUrlByEmailId = (email: string, recipeId: string) =>
  getDownloadURL(ref(storage, `${email}/${recipeId}.png`))
