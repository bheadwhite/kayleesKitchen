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
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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
  inviteId,
  invitesRef,
  loginEventsRef,
  pantryRef,
  recipeScalingRef,
  recipeVariantsRef,
  recipeYieldRef,
  recipesRef,
  sessionMealsRef,
  sessionShoppingRef,
  sessionsRef,
  storage,
  tagsRef,
  userRef,
} from "./firebase"
import type { ScalingSpec } from "@/scaling"
import type {
  AiUsageEvent,
  ChefFork,
  ChefVariant,
  MealSlot,
  PlannedMeal,
  PlanningSession,
  RecipeYield,
  LoginEvent,
  Recipe,
  RegisterValues,
  SessionInvite,
  SessionMember,
  ShoppingItem,
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

/* -------------------------------------------------------- recipe variants */

/**
 * Copies of a recipe someone kept, newest first.
 *
 * Shared, like the recipe box itself: a doubled version is as useful to whoever
 * cooks it next as it was to the person who asked for it, and the whole point
 * of keeping one is that nobody has to pay the model to work it out twice.
 */
export const onRecipeVariantsSnapshot = (
  recipeId: string,
  callback: (variants: ChefVariant[]) => void
) =>
  onSnapshot(query(recipeVariantsRef(recipeId), orderBy("savedAt", "desc")), (snapshot) =>
    callback(
      snapshot.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: data.title ?? "",
          ingredients: data.ingredients ?? [],
          directions: data.directions ?? [],
          serves: data.serves ?? 0,
          servingSize: data.servingSize || undefined,
          baseServes: data.baseServes ?? 0,
          summary: data.summary ?? "",
          label: data.label ?? `Feeds ${data.serves ?? "?"}`,
          email: data.email ?? null,
          // Null between the local write and the server timestamp landing.
          savedAt: data.savedAt?.toDate?.() ?? null,
        }
      })
    )
  )

/**
 * Keeps a copy. The timestamp is the **server's** — ordering a household's
 * saved versions by a phone with a wrong clock puts them in an order nobody
 * recognises.
 */
export const saveRecipeVariant = (recipeId: string, fork: ChefFork, email: string | null) =>
  addDoc(recipeVariantsRef(recipeId), { ...fork, email, savedAt: serverTimestamp() })

export const deleteRecipeVariant = (recipeId: string, variantId: string) =>
  deleteDoc(doc(db, "recipes", recipeId, "variants", variantId))

/**
 * The chef's settled yield for this recipe, or null if nobody has ever asked.
 *
 * A listener rather than a one-shot read, for the same reason the variants are:
 * it has the lifetime of the open recipe either way, and this way the number
 * appears the moment somebody else's phone works it out.
 *
 * The caller still has to check the fingerprint — this only says what is
 * stored, not whether it still describes the recipe in hand.
 */
export const onRecipeYieldSnapshot = (
  recipeId: string,
  callback: (recipeYield: RecipeYield | null) => void
) =>
  onSnapshot(recipeYieldRef(recipeId), (snapshot) => {
    const data = snapshot.data()
    callback(
      data == null
        ? null
        : {
            baseServes: data.baseServes ?? 0,
            basis: data.basis ?? "",
            servingSize: data.servingSize || undefined,
            fingerprint: data.fingerprint ?? "",
          }
    )
  })

/**
 * Everyone with an account, alphabetical — the list a session asks people from.
 *
 * Only names and addresses live in `users`, which is exactly what an invite
 * needs: asks are addressed by email, since a uid is not something this app can
 * look anybody up by. See `SessionInvite`.
 */
export const onUsersSnapshot = (
  callback: (people: UserProfile[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    userRef,
    (snapshot) =>
      callback(
        snapshot.docs
          .map((d) => d.data() as UserProfile)
          .filter((person) => Boolean(person.email))
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      ),
    (error) => {
      console.error("Could not read the people list", error)
      onError?.(error)
    }
  )

/* --------------------------------------------------- planning sessions */

const toSession = (id: string, data: Record<string, unknown>): PlanningSession => ({
  id,
  name: String(data.name ?? ""),
  ownerUid: String(data.ownerUid ?? ""),
  covers: Number(data.covers ?? 4),
  memberUids: (data.memberUids as string[] | undefined) ?? [],
  members: (data.members as SessionMember[] | undefined) ?? [],
  createdAt: (data.createdAt as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

/**
 * Every session this person is in, newest first.
 *
 * `array-contains` on `memberUids` is a single-field index, so nothing has to
 * be declared — which matters in a project that deploys neither indexes nor
 * rules automatically.
 */
export const onMySessionsSnapshot = (
  uid: string,
  callback: (sessions: PlanningSession[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    query(sessionsRef, where("memberUids", "array-contains", uid), orderBy("createdAt", "desc")),
    (snapshot) => callback(snapshot.docs.map((d) => toSession(d.id, d.data()))),
    (error) => {
      console.error("Could not read your planning sessions", error)
      onError?.(error)
    }
  )

/** Starts a session with one member in it. Resolves to the new id. */
export const createSession = async (
  owner: SessionMember,
  name: string,
  covers: number
): Promise<string> => {
  const created = await addDoc(sessionsRef, {
    name,
    covers,
    ownerUid: owner.uid,
    memberUids: [owner.uid],
    members: [owner],
    createdAt: serverTimestamp(),
  })
  return created.id
}

/** How many the session cooks for. Moves every meal that has no number of its own. */
export const setSessionCovers = (sessionId: string, covers: number) =>
  updateDoc(doc(db, "sessions", sessionId), { covers })

/**
 * Steps out of a session.
 *
 * The session document itself is left alone even when the owner leaves. A week
 * several people wrote into is not one person's to delete, and a session with
 * nobody in it is unreachable by every query and rule here — which is a tidier
 * end than a cascade that has to reach two subcollections and can half-finish.
 */
export const leaveSession = (session: PlanningSession, uid: string) =>
  updateDoc(doc(db, "sessions", session.id), {
    memberUids: session.memberUids.filter((member) => member !== uid),
    members: session.members.filter((member) => member.uid !== uid),
  })

/* ------------------------------------------------------------- invites */

const toInvite = (id: string, data: Record<string, unknown>): SessionInvite => ({
  id,
  sessionId: String(data.sessionId ?? ""),
  sessionName: String(data.sessionName ?? ""),
  covers: Number(data.covers ?? 4),
  fromUid: String(data.fromUid ?? ""),
  fromName: String(data.fromName ?? ""),
  toEmail: String(data.toEmail ?? ""),
  createdAt: (data.createdAt as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

/** Asks waiting on this person. Shown on their own tab, never on the session. */
export const onMyInvitesSnapshot = (
  email: string,
  callback: (invites: SessionInvite[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    query(invitesRef, where("toEmail", "==", email)),
    (snapshot) => callback(snapshot.docs.map((d) => toInvite(d.id, d.data()))),
    (error) => {
      console.error("Could not read your invitations", error)
      onError?.(error)
    }
  )

/**
 * Asks someone into a session. The id is `${toEmail}_${sessionId}`, so asking
 * twice replaces rather than stacks — and so the join rule can find it.
 */
export const inviteToSession = (
  session: PlanningSession,
  from: SessionMember,
  toEmail: string
) =>
  setDoc(doc(db, "invites", inviteId(toEmail, session.id)), {
    sessionId: session.id,
    sessionName: session.name,
    covers: session.covers,
    fromUid: from.uid,
    fromName: from.name,
    toEmail,
    createdAt: serverTimestamp(),
  })

/**
 * Takes an ask: adds you to the session, then drops the invite.
 *
 * **Two writes rather than a transaction**, and deliberately in this order. A
 * transaction cannot span the pair here anyway — the rule that lets a stranger
 * write to the session is the one that reads the invite, so consuming the
 * invite first would revoke the permission needed for the write that follows.
 * The failure mode of this order is a consumed-late invite for a session you
 * are already in, which the ask list filters out on sight. The other order
 * loses the session.
 */
export const acceptInvite = async (invite: SessionInvite, me: SessionMember) => {
  await updateDoc(doc(db, "sessions", invite.sessionId), {
    memberUids: arrayUnion(me.uid),
    members: arrayUnion(me),
  })
  await deleteDoc(doc(db, "invites", invite.id))
}

export const declineInvite = (invite: SessionInvite) =>
  deleteDoc(doc(db, "invites", invite.id))

/* ------------------------------------------------------------- the week */

const toPlannedMeal = (id: string, data: Record<string, unknown>): PlannedMeal => ({
  id,
  date: String(data.date ?? ""),
  slot: (data.slot as MealSlot) ?? "dinner",
  recipeId: String(data.recipeId ?? ""),
  title: String(data.title ?? ""),
  serves: typeof data.serves === "number" ? data.serves : undefined,
  byUid: String(data.byUid ?? ""),
  byName: String(data.byName ?? ""),
  addedAt: (data.addedAt as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

/**
 * Everything planned in a session from `from` (a `YYYY-MM-DD` day) onward.
 *
 * A floor and no ceiling, because that is the shape of the question: a week is
 * read forwards. `limit` is a backstop against a session nobody ever cleared,
 * not a page size. Comparing `date` as a string works precisely because it is
 * stored as `YYYY-MM-DD` — see the note on `PlannedMeal.date`.
 */
export const onSessionMealsSnapshot = (
  sessionId: string,
  from: string,
  callback: (meals: PlannedMeal[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    query(sessionMealsRef(sessionId), where("date", ">=", from), orderBy("date"), limit(400)),
    (snapshot) => callback(snapshot.docs.map((d) => toPlannedMeal(d.id, d.data()))),
    (error) => {
      console.error("Could not read the week", error)
      onError?.(error)
    }
  )

export const addPlannedMeal = (
  sessionId: string,
  meal: Omit<PlannedMeal, "id" | "addedAt">
) => addDoc(sessionMealsRef(sessionId), { ...meal, addedAt: serverTimestamp() })

export const deletePlannedMeal = (sessionId: string, mealId: string) =>
  deleteDoc(doc(db, "sessions", sessionId, "meals", mealId))

/** Same meal, different day or slot. `addedAt` is when it was planned, not moved. */
export const movePlannedMeal = (
  sessionId: string,
  mealId: string,
  to: { date: string; slot: MealSlot }
) => updateDoc(doc(db, "sessions", sessionId, "meals", mealId), { ...to })

/**
 * How many this one meal is for. `null` gives it back to the session's number,
 * rather than freezing it at whatever the session happened to say today.
 */
export const setMealServes = (sessionId: string, mealId: string, serves: number | null) =>
  updateDoc(doc(db, "sessions", sessionId, "meals", mealId), {
    serves: serves == null ? deleteField() : serves,
  })

/* -------------------------------------------------------- shopping list */

const toShoppingItem = (id: string, data: Record<string, unknown>): ShoppingItem => ({
  id,
  name: String(data.name ?? ""),
  amount: String(data.amount ?? ""),
  section: String(data.section ?? "other"),
  from: (data.from as string[] | undefined) ?? [],
  checked: data.checked === true,
  sort: Number(data.sort ?? 0),
  manual: data.manual === true,
  byUid: (data.byUid as string | null) ?? null,
  tickedByUid: (data.tickedByUid as string | null) ?? null,
  addedAt: (data.addedAt as { toDate?: () => Date } | null)?.toDate?.() ?? null,
})

/**
 * The whole list. Deliberately unordered here: the sections are put in
 * store-walk order by `SECTIONS` in `src/shoppingList.ts`, which is a decision
 * about how a shop is laid out rather than about what Firestore holds. Ordering
 * on `section` here would sort the aisles alphabetically, which is nobody's shop.
 */
export const onSessionShoppingSnapshot = (
  sessionId: string,
  callback: (items: ShoppingItem[]) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    sessionShoppingRef(sessionId),
    (snapshot) => callback(snapshot.docs.map((d) => toShoppingItem(d.id, d.data()))),
    (error) => {
      console.error("Could not read the shopping list", error)
      onError?.(error)
    }
  )

/** Ticking records *who*: in a shared shop, that is how two people stay out of each other's way. */
export const setShoppingItemChecked = (
  sessionId: string,
  itemId: string,
  checked: boolean,
  uid: string
) =>
  updateDoc(doc(db, "sessions", sessionId, "shopping", itemId), {
    checked,
    tickedByUid: checked ? uid : null,
  })

export const addShoppingItem = (
  sessionId: string,
  item: Omit<ShoppingItem, "id" | "addedAt">
) => addDoc(sessionShoppingRef(sessionId), { ...item, addedAt: serverTimestamp() })

export const deleteShoppingItem = (sessionId: string, itemId: string) =>
  deleteDoc(doc(db, "sessions", sessionId, "shopping", itemId))

/**
 * A whole build, in one `writeBatch`: the rows an existing line now covers, and
 * the rows that are new.
 *
 * Batched because a half-applied build is the worst of both — some ingredients
 * folded into lines that no longer say what they cover, the rest missing
 * outright, and no way to tell by looking. Same 500-write cap and the same
 * reasoning as `renameTag`; a shop is not that big.
 */
export const applyShoppingItems = async (
  sessionId: string,
  updates: Array<{ id: string; amount: string; from: string[] }>,
  additions: Array<Omit<ShoppingItem, "id" | "addedAt">>
) => {
  if (updates.length === 0 && additions.length === 0) return

  const batch = writeBatch(db)
  updates.forEach(({ id, amount, from }) => {
    batch.update(doc(db, "sessions", sessionId, "shopping", id), { amount, from })
  })
  additions.forEach((item) => {
    batch.set(doc(sessionShoppingRef(sessionId)), { ...item, addedAt: serverTimestamp() })
  })
  await batch.commit()
}

/**
 * Empties the ticked rows once the shopping is home.
 *
 * The query runs against the server rather than reading the ticks off the
 * snapshot on screen, for the same reason `deleteTag` re-reads its carriers: the
 * phone in a pocket may be a moment behind, and this one deletes.
 */
export const clearCheckedShoppingItems = async (sessionId: string) => {
  const ticked = await getDocs(
    query(sessionShoppingRef(sessionId), where("checked", "==", true))
  )
  if (ticked.empty) return

  const batch = writeBatch(db)
  ticked.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

/* ------------------------------------------- scaling specs and the pantry */

/**
 * How this recipe's ingredients scale, or null if nobody has ever asked.
 *
 * A one-shot read rather than a listener: unlike the yield, this is fetched for
 * a specific recipe at build time and used immediately, so there is no open
 * screen for a live update to improve. The caller still has to check the
 * fingerprint — `isUsableSpec` does — because this only says what is stored,
 * not whether it still describes the ingredient list in hand.
 */
export const getScalingSpec = async (
  recipeId: string,
  fingerprint: string
): Promise<ScalingSpec | null> => {
  const snapshot = await getDoc(recipeScalingRef(recipeId, fingerprint))
  return snapshot.exists() ? (snapshot.data() as ScalingSpec) : null
}

/**
 * Which aisle each ingredient is found in, as a name → section map.
 *
 * Read whole rather than per-name: it is one small document per ingredient a
 * household has ever shopped for, and a build needs to look up dozens at once.
 * One listener beats forty reads, and the map is useful to the free tier too.
 */
export const onPantrySnapshot = (
  callback: (sections: Record<string, string>) => void,
  onError?: (error: Error) => void
) =>
  onSnapshot(
    pantryRef,
    (snapshot) =>
      callback(
        Object.fromEntries(
          snapshot.docs.map((d) => [String(d.data().name ?? d.id), String(d.data().section ?? "")])
        )
      ),
    (error) => {
      console.error("Could not read the pantry", error)
      onError?.(error)
    }
  )

/* --------------------------------------------------------------- ratings */

/** The stars this person gave this recipe, or null if they have not rated it. */
export const getMyRating = async (recipeId: string, uid: string): Promise<number | null> => {
  const snapshot = await getDoc(doc(db, "ratings", `${recipeId}_${uid}`))
  return snapshot.exists() ? Number(snapshot.data().stars) : null
}

/**
 * Leaves or changes a rating.
 *
 * Two writes that must agree — the rating itself and the totals on the recipe —
 * so they go in a transaction: the read of the previous rating and of the
 * current totals has to be the one the arithmetic is based on, or two people
 * rating at once lose a vote between them.
 *
 * Totals are cached on the recipe because the ratings themselves are private.
 * Averaging client-side would mean every reader could see every rating, and
 * "anonymous" would only be true of the screen, not of the data.
 *
 * The rules re-check the star range and that this is not your own recipe. This
 * arithmetic they cannot check — but the totals only ever move by a vote each,
 * and the people who can write here are the household.
 */
export const rateRecipe = async (recipeId: string, uid: string, stars: number) => {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("A rating is 1 to 5 stars.")
  }

  await runTransaction(db, async (transaction) => {
    const ratingRef = doc(db, "ratings", `${recipeId}_${uid}`)
    const recipeRef = doc(db, "recipes", recipeId)

    // Every read before any write — a transaction requires it.
    const previous = await transaction.get(ratingRef)
    const recipe = await transaction.get(recipeRef)
    if (!recipe.exists()) throw new Error("That recipe is gone.")

    const previousStars = previous.exists() ? Number(previous.data().stars) : null
    const count = Number(recipe.data().ratingCount ?? 0)
    const sum = Number(recipe.data().ratingSum ?? 0)

    transaction.set(ratingRef, { recipeId, uid, stars, at: serverTimestamp() })
    transaction.update(recipeRef, {
      // Changing a rating moves the sum but not the count.
      ratingCount: previousStars == null ? count + 1 : count,
      ratingSum: sum - (previousStars ?? 0) + stars,
    })
  })
}

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
