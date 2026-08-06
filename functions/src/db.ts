import { getApp, initializeApp, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let firestore: Firestore | undefined

/**
 * The Firestore handle, initialised on first use.
 *
 * Ask for the default app; create one only if that fails. Both of the obvious
 * shortcuts are wrong here, and each was tried:
 *
 * - `getFirestore()` with no argument looks up the default app and throws
 *   `app/no-app` when there isn't one.
 * - `getApps().length > 0 ? getApp() : initializeApp()` looks safer and is not:
 *   the runtime has apps registered that are **not** the default, so the length
 *   is non-zero, the ternary takes the `getApp()` branch, and that throws the
 *   same `app/no-app`. Counting apps says nothing about whether the *default*
 *   one exists.
 *
 * `try { getApp() } catch { initializeApp() }` asks the only question that
 * matters and cannot be fooled by either case.
 */
export const db = (): Firestore => {
  if (!firestore) {
    let app: App
    try {
      app = getApp()
    } catch {
      app = initializeApp()
    }
    firestore = getFirestore(app)
  }
  return firestore
}
