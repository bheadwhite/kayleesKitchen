import { execSync } from "node:child_process"
import { fileURLToPath, URL } from "node:url"
import { defineConfig, type Plugin } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

/**
 * Build stamp, inlined at build time so the running app can say which build it
 * is. The commit is what actually *identifies* a deploy, and it is what makes
 * "is the fix live yet?" answerable from a phone.
 *
 * Every lookup is guarded: a build from a tarball with no git checkout still has
 * to succeed, just with an unknown commit.
 */
const gitCommit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "unknown"
  }
}

/**
 * The version, as the date it was built: `2026.8.6`.
 *
 * **Derived rather than declared, and deliberately not `package.json`'s.** That
 * number sat at `0.2.0` for 122 commits and six years — through a framework
 * rewrite, the chef, and the planner — because nothing bumped it and nothing
 * depended on it. A version that has to be remembered is a version that goes
 * stale, and a stale one is worse than none: it reads as information.
 *
 * Semver would earn its keep if anything consumed this package, but it is
 * `private` and never published, and the update check compares the *commit*.
 * So the honest job left for a version is telling a person how old the build in
 * their hand is — which a date does perfectly, needs no discipline, and cannot
 * rot. The commit sits beside it for exactness: the date says when, the commit
 * says which.
 *
 * No zero padding, so it reads as a version rather than as an ISO date that has
 * lost its dashes.
 */
const calendarVersion = (builtAt: Date) =>
  `${builtAt.getFullYear()}.${builtAt.getMonth() + 1}.${builtAt.getDate()}`

const builtAt = new Date()

const BUILD = {
  version: calendarVersion(builtAt),
  commit: gitCommit(),
  builtAt: builtAt.toISOString(),
}

/**
 * Emits `version.json` alongside the bundle.
 *
 * This is what makes "is there a newer build?" answerable *over the network*,
 * independent of the service worker. Asking the worker is not good enough: when
 * it is the thing that is stuck — an installed PWA holding assets from three
 * deploys ago — it has no idea anything is wrong. A tiny file fetched with
 * `cache: "no-store"` and compared against the commit baked into the running
 * bundle always tells the truth.
 *
 * It is deliberately `.json`: workbox's `globPatterns` covers js/css/html/images
 * and not json, so this file is never precached.
 */
const versionFile = (): Plugin => ({
  name: "kitchen-help:version-file",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify(BUILD, null, 2),
    })
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD.version),
    __APP_COMMIT__: JSON.stringify(BUILD.commit),
    __APP_BUILT_AT__: JSON.stringify(BUILD.builtAt),
  },
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
    VitePWA({
      // The app shell is precached and swapped out silently on the next visit.
      // No update prompt: there is no long-lived session worth interrupting,
      // and a stale shell talking to a redeployed Cloud Function is worse.
      registerType: "autoUpdate",
      // The manifest link is still injected; the registration is ours. The
      // plugin's own script is a bare `register()` that never reloads the page
      // when a new worker takes over, which is how an installed PWA ends up
      // running a build from three deploys ago. See src/pwa.ts.
      injectRegister: null,
      includeAssets: ["icons/*.png", "robots.txt"],
      manifest: {
        name: "Kitchen Help",
        short_name: "Kitchen Help",
        description: "Browse and edit the family recipes.",
        start_url: "/recipes",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        // The brand sheet specifies steel here. It is the ground instead,
        // because this value paints the Android status bar directly above a
        // header that *is* the ground — a steel band there reads as a rendering
        // bug, not as branding. The icons below carry the steel.
        theme_color: "#f2f2f3",
        background_color: "#f2f2f3",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          // Drawn with the mark inside an 80% safe zone, so Android can crop it
          // to whatever shape it likes without clipping the wordmark.
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // `**/*.map` is deliberately absent — the build emits sourcemaps and
        // precaching them would roughly double the install payload.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Every path is the SPA shell (firebase.json rewrites the same way).
        navigateFallback: "/index.html",
        // Firebase's own endpoints must reach the network — a cached auth or
        // Firestore response is either stale data or a stale session.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            // Recipe photos in Storage: big, immutable once written, and the
            // thing you actually want on a phone with no signal in a kitchen.
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/,
            handler: "CacheFirst",
            options: {
              // Must match `RECIPE_IMAGE_CACHE` in `src/pwa.ts`, which evicts
              // from this cache by name — see below for why it has to.
              cacheName: "recipe-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // **Status 0 is here on purpose, and it is a known hazard.**
              //
              // An `<img>` fetches cross-origin with `no-cors`, so what reaches
              // the worker is an *opaque* response — status 0 — and an opaque
              // response says nothing about whether the request worked: a 403
              // and a 200 arrive looking identical. Dropping 0 is the tidy fix
              // and the wrong one, because opaque is *all* these requests ever
              // are: it would mean caching no recipe photo at all, and the
              // photos on a phone with no signal in a kitchen are the reason
              // this rule exists.
              //
              // So the failure is repaired where it can be seen instead. A
              // response that will not decode is a broken picture in the
              // editor, and `ImageUpload` answers that by evicting the URL from
              // this cache and asking again — see `forgetCachedImage`. Without
              // that, `CacheFirst` served a cached 403 back for thirty days.
              //
              // The real fix is a CORS configuration on the bucket, which would
              // make these responses ordinary 200s the worker can judge for
              // itself. `gsutil cors get gs://whatsfordinner-e69a4.appspot.com`
              // currently reports none.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Off by default: a service worker in `npm run dev` serves stale modules
        // and makes HMR look broken. Flip to true to debug the worker itself.
        enabled: false,
      },
    }),
  ],
  resolve: {
    // Preserves the CRA-era `baseUrl: "src"` absolute imports
    // (e.g. `import { Button } from "components"`). Keep in sync with
    // the `paths` block in tsconfig.json.
    alias: {
      "@": src(""),
      ai: src("ai"),
      components: src("components"),
      contexts: src("contexts"),
      data: src("data"),
      fire: src("fire"),
      hooks: src("hooks"),
      presenters: src("presenters"),
      utils: src("utils"),
      views: src("views"),
      validation: src("validation.js"),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
})
