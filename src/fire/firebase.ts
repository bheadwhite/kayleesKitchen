import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { collection, doc, getFirestore } from "firebase/firestore"
import { getFunctions } from "firebase/functions"
import { getStorage } from "firebase/storage"

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

if (!config.apiKey) {
  console.warn(
    "Firebase config is missing. Copy .env.example to .env and fill in the VITE_FIREBASE_* values."
  )
}

export const app = initializeApp(config)

// getAnalytics() throws outside a real browser (jsdom, SSR), so it is gated.
if (config.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(app)
    })
    .catch(() => {
      /* analytics is optional */
    })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
/** Hosts `recipeAssistant` — the AI proxy that holds the Anthropic key. */
export const functions = getFunctions(app)

export const userRef = collection(db, "users")
export const recipesRef = collection(db, "recipes")
/**
 * The tag registry: one document per tag, keyed by the tag's own normalised
 * name, holding the colour it is drawn in. Recipes store tag *names*, so a tag
 * can exist on recipes with no document here — it simply wears the default
 * colour until someone gives it one.
 */
export const tagsRef = collection(db, "tags")
/**
 * One document per (recipe, rater), keyed `${recipeId}_${uid}` so a second
 * rating from the same person replaces the first. **Readable only by the person
 * who left it** — see `firestore.rules`. What everyone else sees is the sum and
 * count on the recipe.
 */
export const ratingsRef = collection(db, "ratings")
/**
 * Copies of a recipe someone kept — `recipes/{recipeId}/variants/{id}`.
 *
 * A subcollection rather than a top-level collection: a variant has no meaning
 * away from the recipe it came from, and hanging it underneath means deleting
 * the recipe is the only place that has to think about them. Note that rules do
 * **not** cascade into subcollections — `firestore.rules` matches this path in
 * its own block.
 */
export const recipeVariantsRef = (recipeId: string) =>
  collection(db, "recipes", recipeId, "variants")
/**
 * The chef's settled yield for a recipe — `recipes/{recipeId}/chef/yield`. A
 * fixed document id, so there is one answer per recipe rather than a history
 * nobody reads. **Written only by the Cloud Function**; the client reads it.
 */
export const recipeYieldRef = (recipeId: string) =>
  doc(db, "recipes", recipeId, "chef", "yield")
/** Sign-in events, for the admin console. Written by the client on each sign-in. */
export const loginEventsRef = collection(db, "loginEvents")
/** AI calls. Written **only** by the Cloud Functions — the client just reads. */
export const aiUsageRef = collection(db, "aiUsage")
