# Kitchen Help

A shared family recipe box. Sign in, browse everyone's recipes, and write your own
with an editor that handles ingredients, step-by-step directions grouped into
sections, and a photo.

Built with Vite, React 18, TypeScript, Tailwind CSS v4, Firebase, and
[`@tcn/state`](https://www.npmjs.com/package/@tcn/state) for state management.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Firebase values
npm run dev            # http://localhost:3000
```

The `VITE_FIREBASE_*` values come from the Firebase console under
**Project settings → General → Your apps → SDK setup and configuration**. They are
bundled into the client and are not secrets — Firebase web config is public by
design, and access control lives in Firestore/Storage security rules.

Without a `.env`, the app boots but every Firebase call fails.

## Scripts

| command | what it does |
|---|---|
| `npm run dev` | dev server on :3000 with HMR |
| `npm run build` | typecheck, then bundle to `build/` |
| `npm run preview` | serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

Run a single test file or a single test:

```bash
npm test -- RecipePresenter
npm test -- -t "clears the id back to null"
```

## Deploying (Cloudflare Pages)

Connect the repo in the Cloudflare dashboard and use:

- **Build command:** `npm run build`
- **Build output directory:** `build`
- **Node version:** pinned to 22.12.0 by `.node-version`

Add every `VITE_FIREBASE_*` variable under **Settings → Environment variables** for
both Production and Preview. Vite inlines them at build time, so changing one
requires a redeploy.

`public/_redirects` routes unmatched paths to `index.html` so react-router handles
deep links.

To deploy by hand instead:

```bash
npm run build
npx wrangler pages deploy build
```

After the first deploy, add the Pages domain to Firebase Auth's authorized domains
(**Authentication → Settings → Authorized domains**) or sign-in will be rejected.

## Data model

Two Firestore collections:

- **`users`** — `{ firstName, lastName, email }`. Looked up by email to build the
  display name credited on a recipe.
- **`recipes`** — `{ title, ingredients, directions, email, contributor, image }`,
  owned by `email`. `ingredients` is `{ name, amount, optional, unique }[]`;
  `directions` is `{ sectionTitle, steps: string[] }[]`.

Recipe photos live in Cloud Storage at `{userEmail}/{recipeId}.png`, plus a scratch
`{userEmail}/recipeEditor.png` used for the editor preview before a recipe id
exists.

`src/data/` holds hand-authored seed recipes composed from ingredient factory
functions. They are not loaded by the app — they predate the Firestore schema and
are kept as reference content.
