import { APP_COMMIT } from "./version"

/** How often to ask the server whether a newer build has shipped. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Registers the service worker and keeps it looking for new deploys.
 *
 * Registration is deliberately plain — no auto-reload. `registerType:
 * "autoUpdate"` puts `skipWaiting` + `clientsClaim` in the worker, so a new
 * build takes over as soon as it is fetched and the *next* page load serves it.
 * What we do not want is that reload happening on its own: the recipe editor
 * holds unsaved work, and swapping the bundle underneath someone mid-recipe
 * would throw it away. <UpdateBanner> asks first.
 *
 * `registration.update()` on an interval and on focus is what gets the new
 * worker fetched at all — a phone that keeps the app open in the background
 * performs no navigation, so nothing would otherwise trigger the check.
 */
export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        setInterval(() => void registration.update(), CHECK_INTERVAL_MS)
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registration.update()
        })
      })
      .catch((error) => {
        // Never fatal: the app works unregistered, just without offline use.
        console.warn("Service worker registration failed", error)
      })
  })
}

/**
 * Is the deployed build newer than the one running?
 *
 * Asks the *server*, not the service worker. That distinction is the whole
 * point: when the worker is the thing that is stale, it does not know it, and
 * anything that consults it agrees that everything is fine. `version.json` is
 * never precached and is fetched with `cache: "no-store"`, so this answer comes
 * from Hosting every time.
 *
 * Any failure — offline, a 404 on an older deploy, malformed JSON — reports
 * "no update". A false negative just means the banner appears later; a false
 * positive would nag someone who is already current.
 */
export const isUpdateAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch("/version.json", { cache: "no-store" })
    if (!response.ok) return false

    const live: unknown = await response.json()
    const commit =
      typeof live === "object" && live != null
        ? (live as { commit?: unknown }).commit
        : undefined

    return typeof commit === "string" && commit !== "" && commit !== APP_COMMIT
  } catch {
    return false
  }
}

/**
 * Swaps in the new build. Nudges the worker first so the reload is served the
 * newest assets rather than whatever is currently cached, then reloads.
 */
export const applyUpdate = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
  } catch {
    // Ignore — the reload below is what actually swaps the bundle.
  }
  window.location.reload()
}
