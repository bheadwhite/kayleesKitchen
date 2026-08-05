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
}

export interface RegisterValues {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}
