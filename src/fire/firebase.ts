import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { collection, getFirestore } from "firebase/firestore"
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
/** Sign-in events, for the admin console. Written by the client on each sign-in. */
export const loginEventsRef = collection(db, "loginEvents")
/** AI calls. Written **only** by the Cloud Functions — the client just reads. */
export const aiUsageRef = collection(db, "aiUsage")
