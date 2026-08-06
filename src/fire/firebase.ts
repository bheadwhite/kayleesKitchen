import { initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getAuth } from "firebase/auth"
import { collection, doc, getFirestore } from "firebase/firestore"
import { getFunctions } from "firebase/functions"
import { getStorage } from "firebase/storage"

import { normaliseEmail } from "@/email"

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
/**
 * One profile per person, keyed by their **normalised email address** — the
 * same trick `tags` and `pantry` use, and for the same reason: a duplicate is
 * not something to guard against on the way in, it is something the id makes
 * impossible. The previous `addDoc` + "is there one already?" query was both a
 * race and case-sensitive, and the case-sensitivity is what actually bit —
 * an address typed with a capital at registration filed a second profile the
 * rest of the app could never match, because everything else reads the address
 * back from the auth token, which Firebase has already lowercased.
 *
 * `firestore.rules` pins the id to the document's own `email` field, so this is
 * an invariant rather than a convention.
 */
export const profileRef = (email: string) => doc(userRef, normaliseEmail(email))
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
/**
 * Planning sessions — a name, however many are eating, a week, and one shopping
 * list, shared by whoever is in it. Found with
 * `where("memberUids", "array-contains", uid)`, which is a single-field index
 * and so needs nothing declared.
 */
export const sessionsRef = collection(db, "sessions")
/** One session's week — `sessions/{sessionId}/meals/{mealId}`. */
export const sessionMealsRef = (sessionId: string) =>
  collection(db, "sessions", sessionId, "meals")
/**
 * The same session's shopping list. Persistent and appended to rather than
 * derived from the week above it: it is read in a shop, where the plan changing
 * underneath is not a correction but a rug-pull.
 */
export const sessionShoppingRef = (sessionId: string) =>
  collection(db, "sessions", sessionId, "shopping")
/**
 * Asks to join a session — `invites/{toEmail}_{sessionId}`.
 *
 * Composite id, like `ratings`: a second ask replaces the first, and the id is
 * *derivable*, which is what lets `firestore.rules` check that an ask exists
 * without being handed one. Addressed by email because that is what the app can
 * look somebody up by and what the auth token carries — see `SessionInvite`.
 */
export const invitesRef = collection(db, "invites")
export const inviteId = (toEmail: string, sessionId: string) =>
  `${normaliseEmail(toEmail)}_${sessionId}`
/**
 * How a recipe's ingredient lines respond to cooking for more people —
 * `recipes/{recipeId}/scaling/{ingredientsFingerprint}`.
 *
 * **Written only by the Cloud Function**, read by everyone, and keyed by the
 * *ingredients* stamp rather than the whole recipe's: rewriting a step cannot
 * change how much flour to buy, so it must not throw this away. One document
 * per version of the ingredient list answers every serving count, which is why
 * an unusual eleven costs nothing.
 */
export const recipeScalingRef = (recipeId: string, fingerprint: string) =>
  doc(db, "recipes", recipeId, "scaling", fingerprint)
/**
 * Which aisle an ingredient is found in, keyed by its normalised name. Written
 * only by the callable; read by anyone, entitlement or not.
 */
export const pantryRef = collection(db, "pantry")
/** Sign-in events, for the admin console. Written by the client on each sign-in. */
export const loginEventsRef = collection(db, "loginEvents")
/** AI calls. Written **only** by the Cloud Functions — the client just reads. */
export const aiUsageRef = collection(db, "aiUsage")
/**
 * The same calls summed per day, one document per `YYYY-MM-DD`. The raw feed
 * above is capped at 200 events, so it cannot answer "what did last month
 * cost"; this can, in thirty reads. Written only by the Cloud Functions.
 */
export const aiUsageDailyRef = collection(db, "aiUsageDaily")
