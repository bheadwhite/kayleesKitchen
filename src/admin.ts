import type { SessionUser } from "@/types"

/**
 * The one account that sees the admin console.
 *
 * ⚠️ **This check is a UI affordance, not access control.** It decides what to
 * render; it cannot decide what Firestore will hand out. Anyone signed in can
 * open a console and read the `aiUsage` / `loginEvents` collections directly
 * through the SDK unless the security rules say otherwise — see the rules
 * snippet in `firestore.rules.snippet` and the note in CLAUDE.md. Hiding the
 * link is not the same as denying the read.
 */
export const ADMIN_EMAIL = "bheadwhite@gmail.com"

/** Case-insensitive: Firebase preserves the case a user typed at sign-up. */
export const isAdmin = (user: Pick<SessionUser, "email"> | null): boolean =>
  user?.email?.trim().toLowerCase() === ADMIN_EMAIL
