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

## Environment

Firebase config comes from `VITE_FIREBASE_*` variables read in `src/fire/firebase.ts`
(`.env` is gitignored; `.env.example` lists the keys). Vite only exposes `VITE_`-prefixed
vars to the client, and inlines them at build time — a changed value needs a rebuild.
Without a `.env` the app boots and logs a warning, but every Firebase call fails.

## Imports

`vite.config.ts` `resolve.alias` and the `paths` block in `tsconfig.json` define
directory-level aliases: `components`, `contexts`, `fire`, `hooks`, `presenters`,
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
   `useRecipeImageUrl`, `useLoadingRecipeImage`, `useAuthStatus`, `useSessionUser`).

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

### Forms

`react-final-form` throughout. `src/components/finalForm/{TextField,Checkbox}.tsx` bridge
it to plain Tailwind inputs: they read `useField` for meta and call `useForm().change()`
rather than binding `input.onChange`.

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

### Styling

Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`. Design tokens live in
the `@theme` block of `src/index.css` as `--color-brand-*`, which generate the
`bg-brand-blue` / `text-brand-red` / `border-brand-border` utilities used throughout.
These carry over the palette from the retired MUI theme.

MUI is gone. Local replacements live in `src/components/ui/`: `Button`, `Dialog`,
`Spinner`, and `Icons.tsx` (inline SVG Material paths). `Button` defaults to
`type="button"` so the many icon buttons inside the editor's `<form>` do not submit it.

## Tests

Vitest + jsdom + Testing Library, setup in `src/test/setup.ts`. Tests sit next to what
they cover. `RecipePresenter` is a plain class with no React or Firebase dependency and is
directly unit-testable; `src/App.test.tsx` is the wiring smoke test (auth guard, redirect,
signed-in route) and shows the Firebase mocking pattern.
