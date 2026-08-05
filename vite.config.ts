import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Preserves the CRA-era `baseUrl: "src"` absolute imports
    // (e.g. `import { Button } from "components"`). Keep in sync with
    // the `paths` block in tsconfig.json.
    alias: {
      "@": src(""),
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
