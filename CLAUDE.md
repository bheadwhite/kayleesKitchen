# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                     # Vite dev server on :3000
npm run build                   # tsc --noEmit && vite build -> build/
npm run preview                 # serve the production build
npm run typecheck               # tsc --noEmit
npm test                        # vitest run
npm run test:watch              # vitest watch
npm test -- RecipePresenter     # single file by name pattern
npm test -- -t "moves a step down"   # single test by name
```

There is no lint script. Type errors surface via `npm run typecheck` (and as part
of `npm run build`).

The Cloud Functions backend is a **separate npm package** under `functions/`, with its
own `package.json`, `tsconfig.json`, and `node_modules`. The root `typecheck`/`build`
does **not** cover it — check it separately:

```bash
cd functions && npm install
cd functions && npm run typecheck    # tsc --noEmit
cd functions && npm run deploy       # builds, then firebase deploy --only functions
```

## Environment

Firebase config comes from `VITE_FIREBASE_*` variables read in `src/fire/firebase.ts`
(`.env` is gitignored; `.env.example` lists the keys). Vite only exposes `VITE_`-prefixed
vars to the client, and inlines them at build time — a changed value needs a rebuild.
Without a `.env` the app boots and logs a warning, but every Firebase call fails.

The Anthropic key is **not** a `VITE_` var — it lives in Secret Manager and is read only
by the Cloud Function:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

## Imports

`vite.config.ts` `resolve.alias` and the `paths` block in `tsconfig.json` define
directory-level aliases: `ai`, `components`, `contexts`, `fire`, `hooks`, `presenters`,
`views`, `data`, plus `@/*` for anything under `src`. **Adding a new top-level
directory under `src/` means adding it to both files** — they are kept in sync by
hand, and a missing alias fails at import time rather than at typecheck.

## Architecture

### Presenters own state; React only renders it

State lives in plain TypeScript classes under `src/presenters/`, built on
`@tcn/state`. This is the library's documented presenter pattern, and it replaced a
hand-rolled equivalent (rxjs `StatefulSubject` + xstate + one bespoke subscription
hook per field).

The shape is always the same:

1. **Presenter** — private `Signal<T>` fields, public `xBroadcast` getters, public
   mutator methods, and `dispose()`.
2. **Provider** — `src/contexts/RecipeProvider.tsx` / `AuthProvider.tsx` instantiate the
   presenter in a `useMemo`, put it on a context, and dispose it on unmount. Both accept
   an optional `presenter` prop so tests can inject one (an injected presenter is *not*
   disposed by the provider).
3. **Hooks** — thin `useSignalValue(presenter.xBroadcast)` wrappers, colocated in the
   provider file (`useIngredients`, `useDirections`, `useEditSection`, `useEditIngredient`,
   `useRecipeImageUrl`, `useLoadingRecipeImage`, `useAuthStatus`, `useSessionUser`,
   `useAssistantTurns`, `usePendingImages`, `useProposedDraft`, `useAssistantStatus`).

To add shared state: add a private `Signal` + a `xBroadcast` getter + mutators on the
presenter, then one `useSignalValue` hook next to the others. Do not lift that state
into React.

Rules the library enforces that are easy to violate:

- **Never expose a `Signal` or `Runner`** — return `.broadcast`.
- **Store the return value of `.subscribe()`.** Subscriptions are `WeakRef`-backed; an
  unstored subscription is garbage collected and silently stops firing. `useSignalValue`
  handles this, but direct `.subscribe()` calls in tests or services must not.
- Prefer `transform()` over `set()` for arrays/objects.
- Import from `@tcn/state/core` in non-React code (presenters, services, tests) and
  `@tcn/state/react` for hooks.

`@tcn/state` is marked deprecated on npm but is the intended dependency here.

### Auth status is derived, not transitioned

`AuthPresenter` (`src/presenters/AuthPresenter.ts`) exposes an `AuthStatus` of
`initializing | loggingIn | loggingOut | loggedIn | loggedOut`. It is a `derive()` over
four sources — an `initializing` signal, the user signal, and the `stateBroadcast` of the
login and logout `Runner`s — rather than a state machine stepped by hand. Adding a state
means changing that one `derive` callback and `RequireAuth` in `src/App.tsx`.

`derive()` batches on a microtask, so status changes land one tick after the underlying
signal. Tests must `await`/`findBy*` rather than assert synchronously.

Google sign-in (`logInWithGoogle`) shares the login `Runner` with email/password, so it
needs no extra status. It goes through `loginWithGoogle` in `services.ts`
(`signInWithPopup`), which also writes the `users` profile document Google accounts would
otherwise never get — `<Register>` is the only other thing that creates one. The presenter
takes the flow as an injectable third constructor argument, like `lookupProfile`. The
provider must be enabled under Firebase Console → Authentication → Sign-in method, with the
serving domain listed under Authorized domains.

Async work belongs in a `Runner`, not a `Signal` plus a loading boolean — `Runner` tracks
`status`/`error`/`progress` and supports `retry()` and `cancel()`.

### Firebase access

`src/fire/firebase.ts` initializes the modular SDK and exports `auth`, `db`, `storage`,
`userRef`, `recipesRef`. `src/fire/services.ts` wraps every read/write, including the
`onSnapshot` listeners (`onRecipesSnapshot`, `onRecipesByEmailSnapshot`), which return
their unsubscribe function so callers can `return` them straight out of a `useEffect`.
New Firestore/Storage access belongs in `services.ts`, never inline in a component.

Because the modular SDK exports free functions rather than methods, tests stub Firebase
by mocking the modules (`vi.mock("fire/firebase")`, `vi.mock("fire/services")`,
`vi.mock("firebase/auth")`) — see `src/App.test.tsx`. There is no injectable auth double.

### The AI recipe assistant

The editor's assistant panel takes photos of a recipe, a pasted link, or a plain
instruction like "double everything", and proposes a filled-in draft.

Links go through Claude's server-side `web_fetch` tool — there is no scraping code
here, and no client change: a pasted URL is just message text, and `web_fetch` only
reads URLs already in the conversation. Because it runs a server-side loop, a response
can come back with `stop_reason: "pause_turn"`; the function re-sends with the partial
assistant turn appended (never a "continue" message) up to `MAX_CONTINUATIONS`.
**Instagram and Facebook usually return a login wall** — the system prompt tells the
model to say so and ask for a screenshot rather than invent a recipe from a page title.

**The Anthropic API key must never reach the client.** This is a pure Vite SPA — every
`VITE_*` var is inlined into the bundle — so the call goes through the
`recipeAssistant` callable in `functions/`, which holds the key in Secret Manager and
rejects unauthenticated callers. Adding an `import Anthropic from "@anthropic-ai/sdk"`
anywhere under `src/` is always wrong.

The flow, and why each piece is where it is:

1. `AiDraftPresenter` owns the transcript, staged photos, and the proposed draft, with a
   `Runner` for the in-flight call. Photos stay attached to the turn that sent them, so
   a later "check the second photo again" still has something to look at.
2. `recipeAssistant` (`functions/src/index.ts`) rebuilds the transcript as content
   blocks and calls Claude with a single `propose_recipe` tool. The tool is `strict`, so
   `tool_use.input` is a valid `RecipeDraft` with no parsing or normalising on either
   side. `tool_choice` stays `auto` — a conversational turn should answer, not invent a
   draft.
3. **Nothing is applied automatically.** The draft sits in `_proposedDraft` until the
   user presses "Apply to editor", which calls `RecipePresenter.loadRecipe()`. An
   unwanted suggestion can never clobber half-typed work. `loadRecipe` reads `id` off
   its argument, so the apply path re-supplies the editor's own id — dropping it would
   turn the next save into a brand-new recipe.

`functions/src/types.ts` mirrors `src/ai/types.ts` by hand; the two packages share no
build. Changing the wire format means editing both.

### Generated recipe images — a second, non-Anthropic model

**Claude cannot generate images.** The Anthropic API takes images as input (that is what
photo transcription uses) and has no image output, so "Generate image" in `ImageUpload`
goes to a different provider: Google's `gemini-2.5-flash-image` via Vertex AI, in the
`generateRecipeImage` callable.

It was picked for its credentials, not its output: running on Vertex in this same GCP
project means the function authenticates with its **own service account** (`GoogleAuth`,
no key), so the project still holds exactly one AI secret. Imagen would have been the
obvious choice but its `imagen-*-generate-*` publisher models 404 for this project.

The generated file goes through `acceptImageFile()` — the same staging, upload, and
form-wiring the file picker uses — so preview, "Delete image", and saving behave
identically whether the image was picked or generated.

Prompt caching: the system prompt and the transcript prefix carry `cache_control`
(photos are large and get resent every turn), and the editor's live contents go *after*
that breakpoint as a mid-conversation `role: "system"` message — putting volatile state
in `system` would invalidate the whole prefix on every keystroke.

### Forms

`react-final-form` throughout. `src/components/finalForm/{TextField,Checkbox}.tsx` bridge
it to plain Tailwind inputs: they read `useField` for meta and call `useForm().change()`
rather than binding `input.onChange`.

`src/components/NewRecipe/Directions.tsx` reorders steps with **@dnd-kit** (`core` +
`sortable` + `modifiers`). HTML5 drag-and-drop does not work on touch, which this app
needs, and dnd-kit's `KeyboardSensor` keeps reordering reachable without a mouse now
that the up/down buttons are gone. Two things are load-bearing: the drag handle needs
`touch-none` (otherwise the browser claims the gesture for scrolling and no drag ever
starts on a phone), and the `TouchSensor` uses a press-delay so a tap still scrolls.

Editing is click-to-edit: the section title and each step are buttons that swap
themselves for an input. The step editor reuses the **same `nextStep-{i}` name and id**
as the add-step input below it, which is safe because only one of the two is mounted at
a time — see the `utils.ts` contract below.

`src/views/RecipeEditor.tsx` is the complex one — a single `<Form>` whose `initialValues`
are rebuilt from the presenter on every render, so presenter mutations reset form fields.
Its submit handler runs `shouldNotSubmitAndFocusInputs` (`src/components/NewRecipe/utils.ts`)
**first**: that helper reads `document.activeElement` and probes for the marker ids
`add-ingredient` / `add-section` / `add-step` to decide whether Enter should commit an
ingredient, section, or step to the presenter instead of submitting the recipe. Renaming
those ids, the `nameInput` / `nextStep-{i}` ids, or the `name` / `amount` / `section` /
`nextStep-*` field names silently breaks Enter-key editing.

`TextField` forwards its ref to the **wrapper div**, not the input, because callers do
`ref.current.querySelector("input").focus()`. Its `id` prop lands on the input, because
the helper above focuses by element id.

### Styling — the "Industry" design system

Tailwind CSS v4 via `@tailwindcss/vite`, no `tailwind.config.js`. Everything visual comes
from one system: **steel-blue on a light technical ground, Barlow Condensed headings over
Barlow, square corners, hairline borders, thin-stroke icons.** It replaced the palette
carried over from the retired MUI theme — there is no `brand-blue` / `brand-red` any more.

The tokens live in the `@theme` block of `src/index.css` and are transcribed from the
system's own `styles.css`, so a value here and the same role there must stay in step:

- **Roles** — `ground` (the page), `surface` (inert fills: inputs, thumbnails, wells),
  `ink` (all text), `divider` (every hairline), `muted` (ink at 55%).
- **`steel` on a 100–900 ramp** — 100–300 for tinted fills and hovers, 500/DEFAULT as the
  base, 700–900 for text sitting on those tints. This is a **mono** palette; the system's
  rule is "no decorative color beyond the accent," so reach for a ramp step, not a new hue.
- **`danger`** is the one deliberate addition, and only marks an irreversible action
  (delete a recipe, sign out). It is not an emphasis color.
- **Type** — `font-heading` (Barlow Condensed) for headings and button labels, `font-sans`
  (Barlow) for body, `font-mono` for section headers and counters, which are set uppercase
  with wide tracking. Fonts are **self-hosted via `@fontsource/*`**, not Google Fonts: this
  is an offline-capable PWA, and only the named weights are imported because each one is
  another file in the precache.

Local components live in `src/components/ui/`: `Button`, `Dialog`, `Spinner`, `Avatar`,
`SectionHeading`, and `Icons.tsx`.

- `Button` takes `variant` (`secondary` by default, `primary`, `ghost`) plus `danger` and
  `icon`. **`primary` is the solid accent fill, and the system allows one per view** — the
  page's single real commitment (Save recipe, Apply to editor, Send). It also defaults to
  `type="button"` so the many icon buttons inside the editor's `<form>` do not submit it.
- `Icons.tsx` is **Lucide at stroke-width 1.5** — `fill="none"`, `stroke="currentColor"`.
  Adding a filled Material path back would drop a solid blob among hairline drawings.
- `SectionHeading` is the mono/uppercase rule every section of a recipe sits under. It
  replaced the "fieldset with a floating label" boxes the editor used to draw.
- `.blueprint` (a component-layer class in `index.css`) is the registration-mark frame:
  hairline border plus two crosshairs at opposite corners. It needs `position: relative`
  and must not sit inside anything that clips, because the marks are drawn *outside* the
  box. Recipe photos, the login card, and the profile avatar wear it.

Two places deviate from the supplied assets on purpose, both noted in the code: the
manifest's `theme_color` is the ground rather than steel (it paints the Android status bar
directly above a ground-colored header), and `danger` exists at all.

### App chrome, and the four numbers that must agree

Two fixed bars sandwich the scrolling column: `components/Toolbar` (title only) at the
top and `components/NavBar` at the bottom. The hamburger menu they replaced is gone.

`NavBar`'s three tabs are Recipes, Editor, and the account — an `<Avatar>` with the user's
first name, linking to `/profile`. It is deliberately **not** a Logout button: signing out
sat one mis-tap from the tab used most, and it is destructive here because it drops
whatever is half-typed in the editor. `src/views/Profile.tsx` owns signing out, behind a
confirm dialog. `Avatar` (`components/ui/Avatar.tsx`) shows the Google `photoURL` and
falls back to initials — on `onError` as well as when the URL is missing, because
`lh3.googleusercontent.com` links do go stale.

`NavBar` renders `null` unless `useAuthStatus()` is `"loggedIn"` — every entry needs a
session — and `App` reads the same status to decide whether to reserve room for it.

`Profile` also lists your own recipes and everyone who has contributed. Those rows link
back with **`/recipes?open=<id>`** (opens that recipe) and **`/recipes?cook=<name>`** (seeds
the search box). `Recipes` reads both once, on arrival — they *seed* the view rather than
drive it, so closing a recipe or typing in the search box does not fight the URL, and a
one-shot ref stops "All recipes" from immediately reopening what `?open=` picked.

Because both bars are `position: fixed`, four places have to agree on their heights, so
the heights are `:root` variables in `src/index.css` (`--header-h`, `--navbar-h`) rather
than literals: the two bars themselves, `App`'s content padding, and `RecipeTable`'s
sticky filter bar (`top-[calc(var(--header-h)+var(--sai-top))]`).

The **z-index scale is written out in the `:root` block of `src/index.css`** (drag 10,
sticky filter 30, portaled menu 35, fixed chrome 40, dialog 50). Layers get set three
different ways here — Tailwind classes, react-select's `styles` prop, and a portal into
`<body>` — so anything new that stacks takes a value from that list. Reaching for a big
number instead is how the editor's recipe picker ended up painting over the toolbar.

### PWA

`vite-plugin-pwa` (workbox `generateSW`) builds the manifest, the service worker, and the
registration script — there is no `public/manifest.json` and no registration code in
`src/`. It is configured entirely in `vite.config.ts`. `registerType: "autoUpdate"` means
a new build replaces the old shell silently on the next visit; there is no update prompt.
`firebase.json` sends `Cache-Control: no-cache` for `sw.js` / `registerSW.js` /
`manifest.webmanifest`, which carry no content hash and would otherwise pin installed
apps to a stale build.

Installed, the app runs edge-to-edge: `index.html` sets `viewport-fit=cover` plus the
`apple-mobile-web-app-*` tags (iOS reads those, not the manifest's `display`). Anything
touching a screen edge pays the inset back itself using the `--sai-top` / `--sai-bottom` /
`--sai-left` / `--sai-right` aliases for `env(safe-area-inset-*)` in `src/index.css`. The
pattern for a bar is background on the outer element with the inset as padding, fixed
height on the inner row — so the color reaches the edge but the controls stay above the
home indicator. In a browser tab every inset is `0px`, so the same classes are correct
there with no conditional styling.

Firestore and Auth are never cached; Storage recipe images are (`CacheFirst`, 30 days).
`devOptions.enabled` is `false` — a worker in `npm run dev` serves stale modules and
makes HMR look broken.

The app icons in `public/icons/` come from the design assets and are the only icon files:
the CRA-era `favicon.ico` / `logo192.png` / `logo512.png` are gone, and `index.html` points
its `icon` and `apple-touch-icon` at `icon-192.png`. `icon-maskable-512.png` is drawn
inside an 80% safe zone, which is what makes it safe to declare `purpose: "maskable"`.

## Tests

Vitest + jsdom + Testing Library, setup in `src/test/setup.ts`. Tests sit next to what
they cover. `RecipePresenter` is a plain class with no React or Firebase dependency and is
directly unit-testable; `src/App.test.tsx` is the wiring smoke test (auth guard, redirect,
signed-in route) and shows the Firebase mocking pattern.
