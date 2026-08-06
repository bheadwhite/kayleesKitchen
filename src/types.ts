export interface Ingredient {
  name: string
  amount: string
  optional?: boolean
  unique?: boolean
}

export interface DirectionSection {
  sectionTitle: string
  steps: string[]
  /** Index of the step currently being edited. Transient — stripped before write. */
  editStep?: number | null
}

export interface Recipe {
  id?: string
  title: string
  ingredients: Ingredient[]
  directions: DirectionSection[]
  /** Owner. Recipes are scoped by the author's email address. */
  email?: string
  contributor?: string | null
  image?: string | null
}

/**
 * The slice of a recipe the editor owns and the AI assistant proposes.
 * Deliberately excludes `id`, `email`, `contributor`, and `image` — those are
 * set by the editor's own save path, not by anything the assistant returns.
 */
export interface RecipeDraft {
  title: string
  ingredients: Ingredient[]
  directions: DirectionSection[]
}

/** Firestore `users` document. */
export interface UserProfile {
  firstName: string
  lastName: string
  email: string
}

/**
 * The signed-in user, flattened to just what the views need: the Firebase auth
 * identity plus the display name assembled from the `users` profile document.
 */
export interface SessionUser {
  uid: string
  email: string
  displayName: string | null
  /**
   * Google's account picture. Null for email/password accounts — nothing in this
   * app uploads one — so <Avatar> always needs its initials fallback.
   */
  photoURL: string | null
}

/** One sign-in, as shown in the admin console. */
export interface LoginEvent {
  id: string
  uid: string
  email: string | null
  method: "password" | "google" | "register"
  /** Null for the instant between the local write and the server timestamp. */
  at: Date | null
}

/**
 * One AI call. Written by the Cloud Functions — the token counts only exist on
 * the provider's response, which never reaches the browser.
 */
export interface AiUsageEvent {
  id: string
  feature: "assistant" | "image"
  email: string | null
  model: string
  ok: boolean
  ms: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  /** Photos sent *to* the assistant, not images generated. */
  images: number
  errorCode?: string
  at: Date | null
}

export interface LoginValues {
  email?: string
  password?: string
}

export interface RegisterValues {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}
