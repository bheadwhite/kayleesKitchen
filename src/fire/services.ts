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
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QuerySnapshot,
} from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"

import {
  aiUsageRef,
  auth,
  db,
  loginEventsRef,
  recipesRef,
  storage,
  tagsRef,
  userRef,
} from "./firebase"
import type {
  AiUsageEvent,
  LoginEvent,
  Recipe,
  RegisterValues,
  TagRecord,
  UserProfile,
} from "@/types"

/* ------------------------------------------------------------------ auth */

export const loginWithEmail = ({ email, password }: { email: string; password: string }) =>
  signInWithEmailAndPassword(auth, email, password)

export const createAuthUser = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)

export const signOut = () => firebaseSignOut(auth)

/**
 * Creates the Firebase auth account and then the `users` profile document
 * (if one does not already exist for this email). Password fields are stripped
 * before the profile is written.
 *
 * **Account first, profile second** — the order is load-bearing.
 * `createUserWithEmailAndPassword` signs the new user in, which is what makes
 * the profile write below an *authenticated* one. Written the other way round,
 * registration touches `users` with no credentials at all, and the security
 * rules would have to leave that collection open to the internet to allow it.
 *
 * The failure modes also favour this order: if the profile write fails, the
 * account exists without a profile, which the app already tolerates
 * (`_toSessionUser` falls back to a null display name). The reverse leaves an
 * orphaned profile document for an account that was never created.
 */
export const addUser = async (values: RegisterValues): Promise<UserCredential> => {
  const credential = await createAuthUser(values.email, values.password)

  const existing = await getDocs(query(userRef, where("email", "==", values.email)))
  if (existing.docs.length === 0) {
    const { password: _password, confirmPassword: _confirmPassword, ...profile } = values
    await addDoc(userRef, profile)
  }

  return credential
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
 *
 * Both take an error callback, because without one a rejected listener is
 * *silent*: `onSnapshot` never calls back, the console renders its empty state,
 * and "the security rules are denying you" is indistinguishable from "nothing
 * has happened yet". Those two need to look different.
 */
export const onLoginEventsSnapshot = (
  callback: (events: LoginEvent[]) => void,
  onError?: (error: Error) => void,
  max = 100
) =>
  onSnapshot(
    query(loginEventsRef, orderBy("at", "desc"), limit(max)),
    (snapshot) => callback(snapshot.docs.map((d) => toLoginEvent(d.id, d.data()))),
    (error) => {
      console.error("Could not read sign-in events", error)
      onError?.(error)
    }
  )

export const onAiUsageSnapshot = (
  callback: (events: AiUsageEvent[]) => void,
  onError?: (error: Error) => void,
  max = 200
) =>
  onSnapshot(
    query(aiUsageRef, orderBy("at", "desc"), limit(max)),
    (snapshot) => callback(snapshot.docs.map((d) => toAiUsageEvent(d.id, d.data()))),
    (error) => {
      console.error("Could not read AI usage", error)
      onError?.(error)
    }
  )

/* --------------------------------------------------------------- recipes */

const toRecipe = (id: string, data: Record<string, unknown>): Recipe =>
  ({
    ...data,
    id,
    // Firestore hands this back as a Timestamp, and as null while a local write
    // waits for the server's clock — see the note on `Recipe.createdAt`.
    createdAt: (data.createdAt as { toDate?: () => Date } | null)?.toDate?.() ?? null,
  }) as Recipe

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

/**
 * `createdAt` is stamped here and nowhere else: the server's clock, not the
 * device's, since a phone with a wrong date would otherwise decide for itself
 * how new its recipes are. Any `createdAt` on the way in is dropped — it is
 * written once and never by a caller.
 */
export const addRecipe = ({ createdAt: _createdAt, ...recipe }: Omit<Recipe, "id">) =>
  addDoc(recipesRef, { ...recipe, createdAt: serverTimestamp() })

/** Editing a recipe must not re-date it, so `createdAt` is dropped here too. */
export const updateRecipeById = (
  id: string,
  { createdAt: _createdAt, ...recipe }: Omit<Recipe, "id">
) => updateDoc(doc(db, "recipes", id), { ...recipe })

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

/* ------------------------------------------------------------------ tags */

/**
 * The registry is *only* colours. A tag exists because a recipe wears it, not
 * because a document was written here — which is what lets tags typed into the
 * editor before this collection existed still show up, and why every read
 * merges the two (see `useTagLibrary`).
 *
 * The document id is the tag's own normalised name, so there is no way to end
 * up with two entries for "salad".
 */
export const onTagsSnapshot = (
  callback: (tags: TagRecord[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    tagsRef,
    (snapshot) =>
      callback(
        snapshot.docs.map((d) => ({
          name: String(d.data().name ?? d.id),
          color: String(d.data().color ?? ""),
        }))
      ),
    (error) => {
      console.error("Could not read tags", error)
      onError?.(error)
    }
  )

export const setTagColor = (name: string, color: string) =>
  setDoc(doc(db, "tags", name), { name, color }, { merge: true })

/**
 * Renaming has to reach every recipe wearing the old name — the alternative is
 * a registry entry nothing points at and recipes filed under a word that is no
 * longer offered anywhere.
 *
 * One batch, so a half-finished rename cannot leave two names in circulation.
 * That caps it at 500 writes; this is a household recipe box, and a tag on 499
 * recipes is not the problem that list has.
 */
export const renameTag = async (from: string, to: string, color: string) => {
  if (from === to) return

  const carriers = await getDocs(query(recipesRef, where("tags", "array-contains", from)))
  const batch = writeBatch(db)

  carriers.docs.forEach((d) => {
    const current = (d.data().tags as string[] | undefined) ?? []
    // Through a Set: a recipe already carrying both names would otherwise end
    // up with the survivor twice.
    batch.update(d.ref, { tags: Array.from(new Set(current.map((t) => (t === from ? to : t)))) })
  })

  batch.delete(doc(db, "tags", from))
  batch.set(doc(db, "tags", to), { name: to, color })
  await batch.commit()
}

/**
 * Deleting a tag is only allowed once nothing is filed under it.
 *
 * Rename reaches into every recipe because the label is still wanted, only
 * spelled differently. Delete is the opposite: it would quietly edit recipes —
 * possibly other people's — to make a tidy-up in this screen possible, and the
 * person pressing it cannot see what they are about to change. Untag the
 * recipes first (the list filters by tag, which is how you find them), and this
 * becomes a one-document delete with nothing to undo.
 *
 * Checked here rather than only in the UI: the count on the screen comes from a
 * snapshot that may be a moment stale, and this read happens against the server.
 */
export const deleteTag = async (name: string) => {
  const carriers = await getDocs(query(recipesRef, where("tags", "array-contains", name)))

  if (!carriers.empty) {
    const count = carriers.size
    throw new Error(
      `"${name}" is still on ${count} recipe${count === 1 ? "" : "s"}. ` +
        "Take it off those first."
    )
  }

  await deleteDoc(doc(db, "tags", name))
}

/* --------------------------------------------------------------- storage */

/**
 * Scratch upload used by the editor before a recipe id exists.
 * Resolves to the download URL.
 */
/**
 * Stages the editor's image at one fixed path per user, so a cook who tries
 * five photos leaves one file behind rather than five.
 *
 * That reuse is exactly why the URL gets a cache-buster. The path never changes,
 * so a second upload can hand back a byte-identical download URL — and three
 * separate layers then conspire to show the *old* picture:
 *
 * - the `<img>` in `ImageUpload` clears its spinner only from `onLoad`, which
 *   never fires again when `src` is unchanged, so the spinner runs forever;
 * - the service worker caches `firebasestorage.googleapis.com` `CacheFirst` for
 *   30 days (see `vite.config.ts`), so the new bytes are never fetched;
 * - the browser's own image cache does the same thing.
 *
 * That is what made "Generate" appear to work exactly once per session. Storage
 * ignores the extra parameter, and it cannot reach Firestore: staging always
 * sets `imageFile` too, and `RecipeEditor` re-uploads that file through
 * `uploadImageToRecipeId` — the persisted URL is built there, and stays clean.
 */
export const uploadRecipeEditorImage = async (file: File, email: string) => {
  const result = await uploadBytes(ref(storage, `${email}/recipeEditor.png`), file)
  const url = await getDownloadURL(result.ref)
  return `${url}${url.includes("?") ? "&" : "?"}staged=${Date.now()}`
}

/** Final upload, keyed by recipe id. Resolves to the download URL. */
export const uploadImageToRecipeId = async (file: File, email: string, recipeId: string) => {
  const result = await uploadBytes(ref(storage, `${email}/${recipeId}.png`), file)
  return getDownloadURL(result.ref)
}

export const getImageUrlByEmailId = (email: string, recipeId: string) =>
  getDownloadURL(ref(storage, `${email}/${recipeId}.png`))
