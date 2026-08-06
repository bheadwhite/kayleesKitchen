/**
 * Which build is running.
 *
 * The three values are replaced by Vite at build time (see `define` in
 * `vite.config.ts`), so they describe the bundle rather than the moment the
 * page loaded. `declare const` gives them types without importing anything —
 * they are literals in the output, not variables.
 *
 * `APP_VERSION` is the **build date** (`2026.8.6`), not a semver from
 * `package.json` — that field is gone, because nothing bumped it for six years
 * and nothing depended on it. The date says how old the build in your hand is;
 * `APP_COMMIT` beside it says exactly which one. See `calendarVersion`.
 *
 * Vitest does not run the `define` step, so each falls back rather than
 * throwing a ReferenceError in tests.
 */
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_BUILT_AT__: string

const read = (value: () => string, fallback: string) => {
  try {
    return value()
  } catch {
    return fallback
  }
}

export const APP_VERSION = read(() => __APP_VERSION__, "dev")
export const APP_COMMIT = read(() => __APP_COMMIT__, "local")
export const APP_BUILT_AT = read(() => __APP_BUILT_AT__, "")

/** e.g. `v2026.8.6 · 465a4f3` — short enough for a footer line. */
export const buildLabel = () => `v${APP_VERSION} · ${APP_COMMIT}`

/** Build date in the viewer's locale, or "" when there is no stamp (dev). */
export const buildDate = () => {
  if (APP_BUILT_AT === "") return ""
  const parsed = new Date(APP_BUILT_AT)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString()
}
