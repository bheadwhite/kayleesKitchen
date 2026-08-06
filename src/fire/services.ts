import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type AuthCredential,
  type User,
  type UserCredential,
} from "firebase/auth"
import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QuerySnapshot,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"

import { aiUsageRef, auth, db, loginEventsRef, recipesRef, storage, userRef } from "./firebase"
import type { AiUsageEvent, LoginEvent, Recipe, RegisterValues, UserProfile } from "@/types"

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

/**
 * The error Firebase raises when the Google account's email already belongs to
 * an account created some other way — here, always email + password. With
 * "one account per email address" on (the default), Google sign-in *fails*
 * rather than silently merging.
 */
export const ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL =
  "auth/account-exists-with-different-credential"

/**
 * Attaches a Google credential to the existing password account for the same
 * email, so both ways in reach one account from then on.
 *
 * The password is required because linking has to happen while signed in *as*
 * that account, and Firebase will only hand out that session in exchange for
 * the existing credential. That is also why this cannot be done silently: the
 * whole point of the check is that someone holding only a Google token should
 * not be able to take over an account they have not proved they own.
 *
 * Note what this deliberately does *not* do: `fetchSignInMethodsForEmail` is the
 * classic way to discover which provider the existing account uses, but it is
 * deprecated and returns an empty list whenever Email Enumeration Protection is
 * enabled — so it cannot be trusted to tell us anything. Password is the only
 * other provider this app offers, so the caller asks for it directly.
 */
export const linkGoogleToExistingAccount = async (
  authInstance: Auth,
  {
    email,
    password,
    credential,
  }: { email: string; password: string; credential: AuthCredential }
): Promise<UserCredential> => {
  const existing = await signInWithEmailAndPassword(authInstance, email, password)
  await linkWithCredential(existing.user, credential)
  // Google accounts normally get their profile document from `loginWithGoogle`,
  // which this path skipped. A password account registered through <Register>
  // already has one, so this is a no-op in the usual case.
  await ensureUserProfile(existing.user)
  return existing
}

/* ------------------------------------------------------------- telemetry */

/**
 * Records a sign-in for the admin console.
 *
 * Fire-and-forget by design: this is bookkeeping, and a failed write must never
 * turn into a failed sign-in. It is also *only* called on an explicit sign-in —
 * restoring a persisted session on page load is not a login, and recording one
 * would turn the log into a page-view counter.
 */
export const recordLogin = (
  user: { uid: string; email: string | null },
  method: LoginEvent["method"]
): void => {
  void addDoc(loginEventsRef, {
    uid: user.uid,
    email: user.email,
    method,
    at: serverTimestamp(),
  }).catch((error) => console.warn("Could not record sign-in", error))
}

const toLoginEvent = (id: string, data: Record<string, unknown>): LoginEvent => ({
  id,
  uid: String(data.uid ?? ""),
  email: (data.email as string | null) ?? null,
  method: (data.method as LoginEvent["method"]) ?? "password",
  at: (data.at as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

const toAiUsageEvent = (id: string, data: Record<string, unknown>): AiUsageEvent => ({
  id,
  feature: (data.feature as AiUsageEvent["feature"]) ?? "assistant",
  email: (data.email as string | null) ?? null,
  model: String(data.model ?? ""),
  ok: data.ok !== false,
  ms: Number(data.ms ?? 0),
  inputTokens: Number(data.inputTokens ?? 0),
  outputTokens: Number(data.outputTokens ?? 0),
  cacheReadTokens: Number(data.cacheReadTokens ?? 0),
  cacheCreationTokens: Number(data.cacheCreationTokens ?? 0),
  images: Number(data.images ?? 0),
  errorCode: (data.errorCode as string | undefined) ?? undefined,
  at: (data.at as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

/**
 * The admin console's two feeds. Both are capped and newest-first — the console
 * is a dashboard, not an export, and an unbounded listener on a collection that
 * grows with every AI call would eventually pull the whole history into a phone.
 */
export const onLoginEventsSnapshot = (
  callback: (events: LoginEvent[]) => void,
  max = 100
) =>
  onSnapshot(query(loginEventsRef, orderBy("at", "desc"), limit(max)), (snapshot) =>
    callback(snapshot.docs.map((d) => toLoginEvent(d.id, d.data())))
  )

export const onAiUsageSnapshot = (callback: (events: AiUsageEvent[]) => void, max = 200) =>
  onSnapshot(query(aiUsageRef, orderBy("at", "desc"), limit(max)), (snapshot) =>
    callback(snapshot.docs.map((d) => toAiUsageEvent(d.id, d.data())))
  )

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
