import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

/**
 * Build stamp, inlined at build time so the running app can say which build it
 * is. The commit is what actually identifies a deploy — `version` moves rarely —
 * and it is what makes "is the fix live yet?" answerable from a phone.
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

const packageVersion = () => {
  try {
    return JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version
  } catch {
    return "0.0.0"
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion()),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app shell is precached and swapped out silently on the next visit.
      // No update prompt: there is no long-lived session worth interrupting,
      // and a stale shell talking to a redeployed Cloud Function is worse.
      registerType: "autoUpdate",
      // Injects both the <link rel="manifest"> and the registration script, so
      // index.html and src/ stay free of PWA plumbing.
      injectRegister: "auto",
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
              cacheName: "recipe-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
