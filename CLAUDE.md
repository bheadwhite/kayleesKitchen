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

### One account, two ways in

Firebase keeps **one account per email address** (the default), so a person who registered
with `bob@gmail.com` and a password, and later presses "Sign in with Google" with that same
Gmail account, is refused: `auth/account-exists-with-different-credential`. The two are the
same person and the same email, but not the same account, and Google will never work for
them until the credentials are joined.

`logInWithGoogle` treats that error as **a step in the flow, not a failure**. It keeps the
Google credential from `GoogleAuthProvider.credentialFromError`, publishes the email on
`linkEmailBroadcast` (`usePendingLinkEmail`), and *resolves*. `<Login>` swaps itself for a
panel asking for the existing password; `completeGoogleLink` then signs in with it and
calls `linkWithCredential`, after which either button works forever. A wrong password keeps
the pending credential so they can retry without another trip through the popup.

The password is unavoidable — linking has to happen while signed in *as* that account, and
that is the point: someone holding only a Google token should not be able to take over an
account they have not proved they own.

**Do not reach for `fetchSignInMethodsForEmail`** to discover which provider the existing
account uses. It is deprecated, and it returns an empty array whenever Email Enumeration
Protection is enabled — so it cannot be trusted to tell you anything. Password is the only
other provider this app offers, so the panel asks for it directly.

The reverse case — an account created *through* Google, then someone types a password —
cannot be detected at all, for the same enumeration-protection reason. Firebase reports a
plain bad credential, so `<Login>` names both possibilities in the message rather than
guessing.

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

`MAX_IMAGES` is a budget for the **whole conversation**, not per message — photos stay
attached to their turn and are re-sent with every later one, and the callable counts them
across all turns. `AiDraftPresenter.attachImages` must therefore count sent photos as well
as pending ones; counting only the pending batch let someone attach eight, send, attach
eight more, and get rejected server-side *after* the upload.

**Photos are resized in the browser, never rejected for size.** `toAssistantImage`
(`src/ai/recipeAssistant.ts`) decodes the file, downscales the long edge to **2576px**, and
re-encodes as JPEG. That number is Claude's high-resolution ceiling for the model in
`functions/src/index.ts` — anything larger is downscaled server-side before the model sees
it, so sending a 4032px iPhone photo costs upload time and buys nothing. Check the model's
tier before raising it; older models cap at 1568px.

Two things fall out of resizing, and both are the point:

- **The old 3MB cap is gone.** Phone cameras produce 3–5MB files as a matter of course, and
  refusing them when a few-millisecond canvas resize fixes it was not a real limit.
- **HEIC works.** The picker takes `image/*` rather than Claude's four formats, because
  whatever the browser can decode leaves this function as JPEG. Safari decodes iPhone HEIC
  natively; Claude never sees it.

`imageOrientation: "from-image"` on `createImageBitmap` is load-bearing — phone photos carry
rotation in EXIF, not in the pixels, and a canvas draw that ignores it sends a sideways
recipe card.

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

Four things keep this from being flaky, and each one was a real failure:

- **`generationConfig.responseModalities: ["TEXT", "IMAGE"]` is required.** Left off, the
  modality is the endpoint's default and the model is free to answer "draw me dinner" with
  a paragraph *about* dinner — the "did not return an image" the feature was known for.
  This model rejects image-only output, so `TEXT` rides along and is discarded.
  `imageConfig.aspectRatio` is `16:9` to match the editor's 16/10 frame; the default is
  square, and `object-cover` was cropping a third off every generated image.
- **The call is retried, because gaxios will not do it.** Its retry config excludes POST,
  so every call was one-shot against an endpoint that returns 429 on momentary quota and
  503 when overloaded. `ATTEMPTS`/`BACKOFF_MS` in `generateImage.ts` cover those plus a
  turn that came back as prose. **Safety refusals are not retried** — `BLOCKED_REASONS`
  and `promptFeedback.blockReason` end the loop, because an identical prompt gets an
  identical no, and they earn a different message than a transient blip.
- **`httpsCallable` defaults to a 70-second timeout** while the callable is deployed at
  300. Generation plus a cold start clears 70s often enough that the browser was
  abandoning calls the server went on to finish and bill. `CALL_TIMEOUT_MS` in
  `src/ai/recipeImage.ts` has to stay in step with `timeoutSeconds`.
- **Both image paths carry a `requestRef` ticket.** The file picker is never disabled
  during a generation, so a slow generation could land after a photo picked later and
  replace it. The guard runs on entry to `acceptImageFile` as well as after the upload,
  because `setImageFile` is what "Save recipe" uploads — a stale write there saves a
  picture the editor is not showing.

**Regenerating is a first-class action** — the model gives a different picture every run,
so the button reads "Regenerate" once an image exists. Making it *work* took a
cache-buster in `uploadRecipeEditorImage`: staging reuses one fixed path per user
(`${email}/recipeEditor.png`), so a second upload can return a byte-identical download
URL, and then three layers hide the new image at once — the `<img>` clears its spinner
only from `onLoad`, which never fires when `src` is unchanged; the service worker caches
Storage URLs `CacheFirst` for 30 days; and the browser's image cache does the same. The
symptom was a spinner that never stopped, over the first picture. The parameter cannot
reach Firestore — staging always sets `imageFile`, and save re-uploads that through
`uploadImageToRecipeId`, which stays clean.

A generated image is **kept when only the preview upload fails**: `RecipeEditor` re-uploads
`presenter.getImageFile()` on save, so the recipe still gets its photo. Clearing it meant
paying for a second generation to recover from a blip in Storage.

Every rejection is recorded, including the argument checks — `record` is declared before
the first throw on purpose, since a run of bad requests otherwise looks like no traffic at
all. `attempts` rides along on the usage event: a feature that quietly needs three swings
every time is indistinguishable from a healthy one without it.

Prompt caching: the system prompt and the transcript prefix carry `cache_control`
(photos are large and get resent every turn), and the editor's live contents go *after*
that breakpoint as a mid-conversation `role: "system"` message — putting volatile state
in `system` would invalidate the whole prefix on every keystroke.

### Undo/redo

`src/presenters/UndoStack.ts` is a generic linear undo over **whole snapshots** — a recipe
is a few dozen short strings, and the alternative is writing an inverse for every mutator
and keeping it correct. `RecipePresenter` owns one, and every mutator calls `_record()`
*first*, with the state it is about to replace.

**Recording an edit throws the redo stack away.** After an undo there are two possible
futures — the one that was undone and the one just started — and nothing reconciles them, so
the abandoned branch is unreachable by design.

What is and is not in a step:

- **Typing in the title records nothing.** `setTitle` fires per keystroke, and an undo stack
  one character deep is useless. The title is still *carried in* every snapshot, so undoing
  anything else puts it back — which is what makes "undo the assistant's draft" correct —
  and a focused input has the browser's own undo anyway. That is also why ⌘Z is ignored while
  the cursor is in an input or textarea.
- **A no-op records nothing.** `addTag` normalises and checks for a duplicate before
  recording; a press of Undo that appears to do nothing because it took back a rejected
  duplicate is worse than no undo at all.
- **The photo is not in a step.** Staging one uploads a file, so undo would mean re-uploading
  or resurrecting a deleted Storage object — a different operation with a different failure
  mode, already covered by Delete/Regenerate.
- **`editStep` / the open ingredient row are stripped.** Which row happens to be open is not
  an edit, and restoring it reopens an editor nobody asked for.

Opening a recipe **clears** the history (undo must not walk back into the last recipe);
applying an assistant draft **records** one (it is the step people most want to take back).

### Unsaved changes, and showing what they are

`src/recipeDiff.ts` compares what is on the screen with what was last saved, and everything
the editor says about unsaved work comes from that one pure function: the count on the save
bar, the disabled Update button, the tint and `<ChangeMark>` on a changed row, the "N
removed" lines, and the discard prompt on Cancel.

The baseline lives on `RecipePresenter` (`_baseline`, set by `markSaved`) and is **not a
Signal** — it moves only on load and on save, both of which already move something the
editor subscribes to.

Three decisions hold this together:

- **`loadRecipe(recipe, { asSaved })`.** Opening a stored recipe re-bases; applying an
  assistant draft must not, because re-basing there would report the assistant's rewrite as
  no change at all — which is exactly the thing worth looking over before pressing Update.
  A stray keystroke and an applied draft are marked the same way, deliberately: to someone
  about to save, they are the same kind of event.
- **The image is a boolean in the baseline, not a URL.** The editor holds a fresh download
  URL for the same file the recipe already points at, so comparing the strings reports a
  change on every load. What counts is a new file staged or the picture removed.
- **Rows are compared by position.** A dragged step is reported as two changed steps; the
  editor cannot tell a drag from a retype, and claiming to would be worse than saying "these
  two lines are not what you saved".

**Updating leaves you in the editor** and re-bases the baseline, so the count drops to zero
and Update disables itself. Clearing the form threw away what you were working on in order
to prove it had been saved. Saving a *new* recipe still clears — "Save recipe" means this
one is filed, and the next thing typed is a different recipe.

### Tags

Recipes carry free-form labels — "salad", "mexican" — and the recipe list filters on them.
They live in **two places, on purpose**:

- **The names are on the recipe** (`Recipe.tags: string[]`, normalised lowercase by
  `normaliseTag` in `RecipePresenter`). A tag exists because a recipe wears it.
- **The colour is in a registry** (`tags/{name}`, one document per tag, keyed by the tag's
  own name so there can never be two entries for "salad"). It holds *only* the colour.

`useTagLibrary` (`src/hooks/useTagLibrary.ts`) merges the two, and the merge is the whole
design: a tag typed into the editor writes nothing to the registry, so a view reading the
registry alone would show an empty list on a recipe box full of tags — and a registry entry
with no recipes left is still offered, because someone picked a colour meaning to use it.

**Colour is a closed palette, not a picker.** `src/tagColors.ts` holds eight tints at
`steel-100`'s value, each with a border and an ink dark enough to read on it; tags store the
**id**, never the hex, so re-tuning a tint is an edit to that file rather than a migration.
This is the one place the mono system admits colour (see the styling section) — an arbitrary
hex would let a tag be drawn as pure red on white, and would need contrast-checking on every
render. `<TagChip>` applies it as an **inline style**, because Tailwind builds its stylesheet
by scanning source text and a class assembled from a runtime value would simply not exist.

**`/tags` (`views/TagManager.tsx`) is the fifth nav tab**, and it manages tags rather than
creating them: a tag with no recipe on it is an empty filter, and the moment you know you
want one is the recipe you are writing. What it owns is the part the editor cannot — the
colour, and the rename or delete that has to reach **every recipe already wearing the word**.
`renameTag` / `deleteTag` in `services.ts` do that fan-out in a single `writeBatch`, so a
half-finished rename cannot leave two names in circulation. That caps them at 500 writes,
which a household recipe box will not reach.

`RecipeTable` and `Recipe` take the colour map as a **prop** rather than calling the hook:
`Recipes` owns the listener and hands it down, which keeps both presentational and keeps a
second Firestore listener out of a component rendered once per row.

### The admin console

`src/views/Admin.tsx` at `/admin` shows AI spend and sign-ins. It is a **fifth nav tab that
only the admin sees** — `NavBar` switches to `grid-cols-5` for them — and `src/admin.ts`
holds the one address.

> ⚠️ **`isAdmin()` is a UI affordance, not access control.** It decides what to render; it
> cannot decide what Firestore hands out. **`firestore.rules`** is what enforces it.

`firestore.rules` is **not deployed by `firebase deploy`** — `firebase.json` has no
`firestore` section, on purpose. It is the reviewed copy of what belongs in Firebase console
→ Firestore → Rules, and the two are kept in step **by hand**, which is only safe while the
drift is visible:

```bash
npm run rules:copy    # local file -> clipboard, ready to paste into the console
npm run rules:diff    # live ruleset vs. the local file; exits 1 if they differ
npm run rules:live    # print what the console is actually serving
npm run rules         # print the local file
```

`scripts/liveRules.mjs` backs the last three. It reads the live ruleset through the
Firebase Rules API, authenticating with `gcloud auth print-access-token` — so it needs the
gcloud CLI and an account that can read the project. The project id comes from
`.firebaserc` (override with `FIREBASE_PROJECT`).

`rules:diff` is the one that matters: it shows `-` for live and `+` for local. Comment-only
differences are normal — the console copy is whatever was last pasted — so read the diff
for `match` blocks and `allow` lines, not prose.

**`addUser` creates the auth account before writing the `users` profile, and the order is
load-bearing.** `createUserWithEmailAndPassword` signs the new user in, which is what makes
the profile write authenticated. Reversed, registration touches `users` with no credentials
and the rules would have to leave that collection open to the internet.

Where each half of the data comes from, and why:

- **AI usage is written server-side** (`functions/src/telemetry.ts`, called from both
  callables). Token counts only exist on the provider's response, which never reaches the
  browser — and a client-reported usage number is a number the client can make up. Failed
  calls are recorded too: a spike in rate-limit errors is exactly what the console is for,
  and tokens spent before a failure are still spent. `recordAiUsage` never throws and is
  never awaited — telemetry must not be able to fail a recipe transcription.
- **Sign-ins are written by the client** (`recordLogin` in `services.ts`, called from
  `AuthPresenter`) on *explicit* sign-ins only. A restored session on page load is not a
  login; recording one would make the log a page-view counter.

Both feeds are capped and newest-first (200 AI calls, 100 sign-ins), so the totals read
"recent", not all-time — an unbounded listener on a collection that grows with every AI call
would eventually pull the whole history onto a phone.

### The build stamp

`vite.config.ts` `define` inlines `__APP_VERSION__` / `__APP_COMMIT__` / `__APP_BUILT_AT__`
at build time; `src/version.ts` wraps them with dev fallbacks. The version line sits at the
bottom of `<Profile>` for everyone and in full on the admin console. The commit is the part
that matters — it makes "did my fix actually deploy?" answerable from a phone.

Vitest reads the same `vite.config.ts`, so `define` applies in tests too: assertions see the
real stamp, not the fallbacks.

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

Editing is click-to-edit: the section title, each step, and each ingredient are buttons
that swap themselves for a field, in place. Each editor reuses the **same field names
and ids as the "add" row it replaces** — `nextStep-{i}` for a step, `name` / `amount` /
`nameInput` for an ingredient — which is safe only because the add row is hidden while an
editor is open (`<AddIngredient>` returns `null`, the add-step box is behind
`editStep == null`). One of the two, never both — see the `utils.ts` contract below.

**A step is a `<TextArea>`, an ingredient and a section title are `<TextField>`s**, and
that split decides what Enter does. A step is prose that can run to several lines, so it
gets a box that grows with its content and keeps Enter for itself as a newline — which
also means a step field never reaches the form's submit handler at all. `Directions.tsx`
gives it **Cmd/Ctrl+Enter to commit and Escape to cancel** so a run of steps is still
typeable without the mouse. Both places that *display* a step (`Recipe.tsx` and the
editor's own rows) therefore need `whitespace-pre-wrap`, or deliberate line breaks read
back as one run-on line.

Which ingredient is being edited is held **as an index** (`_editIngredientIndex`), not as
a copy of the ingredient looked up again by name on save: a recipe may list the same name
twice, and every edit of a duplicate went to whichever copy came first.

`src/views/RecipeEditor.tsx` is the complex one — a single `<Form>` whose `initialValues`
are rebuilt from the presenter on every render, so presenter mutations reset form fields.
**That rebuild only happens when `RecipeEditor` itself re-renders**, so it has to subscribe
to every signal `initialValues` reads — including ones it otherwise makes no use of.
Editing an ingredient did nothing at all for exactly this reason: the row opened, and its
fields stayed blank because nothing here was listening to the edit signal.
Its submit handler runs `shouldNotSubmitAndFocusInputs` (`src/components/NewRecipe/utils.ts`)
**first**: that helper reads `document.activeElement` and probes for the `add-ingredient`
marker id to decide whether Enter should commit an ingredient or a section title to the
presenter instead of submitting the recipe. Renaming that id, the `nameInput` id, or the
`name` / `amount` / `section` field names silently breaks Enter-key editing. The follow-up
focus is deferred a tick, because committing a row unmounts the element under the cursor
and mounts a different one carrying the same id.

`TextField` and `TextArea` forward their ref to the **wrapper div**, not the control,
because callers do `ref.current.querySelector("input" | "textarea").focus()`. The `id`
prop lands on the control, because the helper above focuses by element id.

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

Three places deviate from the supplied assets on purpose, each noted in the code: the
manifest's `theme_color` is the ground rather than steel (it paints the Android status bar
directly above a ground-colored header), `danger` exists at all, and **`src/tagColors.ts`**
is a closed eight-tint palette for tags — the one thing users colour themselves (see the
tags section).

### App chrome, and the four numbers that must agree

Two fixed bars sandwich the scrolling column: `components/Toolbar` (title only) at the
top and `components/NavBar` at the bottom. The hamburger menu they replaced is gone.

`NavBar`'s tabs are Recipes, Editor, Tags, and the account — plus an Admin tab for the one
admin address (see the admin console section). The account tab is an `<Avatar>` with the
user's first name, linking to `/profile`. It is deliberately **not** a Logout button: signing out
sat one mis-tap from the tab used most, and it is destructive here because it drops
whatever is half-typed in the editor. `src/views/Profile.tsx` owns signing out, behind a
confirm dialog. `Avatar` (`components/ui/Avatar.tsx`) shows the Google `photoURL` and
falls back to initials — on `onError` as well as when the URL is missing, because
`lh3.googleusercontent.com` links do go stale.

`NavBar` renders `null` unless `useAuthStatus()` is `"loggedIn"` — every entry needs a
session — and `App` reads the same status to decide whether to reserve room for it.

A row in `RecipeTable` carries a **New** chip for its first week, from the `createdAt`
`serverTimestamp()` that `addRecipe` stamps — the server's clock, since a phone with a wrong
date would otherwise decide for itself how new its recipes are. `updateRecipeById` drops
`createdAt` on the way past so editing a recipe cannot re-date it. **A missing or pending
timestamp reads as "not new"**: every recipe written before the field existed has none, and
a local write has null until the round trip lands.

The recipe view offers **Edit** (top right, opposite "All recipes") on recipes you own,
linking to **`/recipes/new?edit=<id>`**. The editor reads that param once on arrival and
runs the same `openForEditing` path as its own picker — one implementation, so a change to
how a recipe loads cannot apply to only one of the two ways in. The button is hidden on
other people's recipes: every signed-in cook *can* write any recipe, but offering it from
their page invites doing it by accident, and the picker has always listed yours alone.

`Profile` also lists your own recipes and everyone who has contributed. Those rows link
back with **`/recipes?open=<id>`** (opens that recipe) and **`/recipes?cook=<name>`** (seeds
the search box). `Recipes` reads both once, on arrival — they *seed* the view rather than
drive it, so closing a recipe or typing in the search box does not fight the URL, and a
one-shot ref stops "All recipes" from immediately reopening what `?open=` picked.

Because both bars are `position: fixed`, four places have to agree on their heights, so
the heights are `:root` variables in `src/index.css` (`--header-h`, `--navbar-h`) rather
than literals: the two bars themselves, `App`'s content padding, and `RecipeTable`'s
sticky filter bar (`top-[calc(var(--header-h)+var(--sai-top))]`).

`RecipeEditor` adds a **third fixed bar** — the unsaved-change count, Save/Update and
Cancel, stacked directly on top of the nav bar at
`bottom-[calc(var(--navbar-h)+var(--sai-bottom))]`. The editor is a long
form, and the one commitment it exists for was several scrolls below wherever you were
typing. It follows the same rule: `--editor-actions-h` is a `:root` variable because the bar
and the form's own `pb-` have to agree, and only that form pays the padding. **Delete recipe
stays at the far end of the scroll** — it is the one action here that cannot be undone, and
it has no business a thumb's width from Update.

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

**Getting a new build onto a device is its own problem, and the service worker cannot be
the one to solve it.** `registerType: "autoUpdate"` activates a new worker but never tells
the open page to reload, and an installed PWA is resumed rather than cold-started — so it
can run a build from several deploys ago while believing it is current. Asking the worker is
no help: when it is the stale thing, it does not know.

So the check goes to the server, the way `~/projects/honeydo` does it. `vite.config.ts`
emits **`version.json`** next to the bundle (a `.json`, so workbox's `globPatterns` never
precaches it) and Hosting serves it `no-cache`. `isUpdateAvailable` in `src/pwa.ts` fetches
it with `cache: "no-store"` and compares `commit` against the `__APP_COMMIT__` baked into
the running bundle. `<UpdateBanner>` polls on mount, on focus, and every 15 minutes.

It **offers** the update rather than taking it: the recipe editor holds unsaved work, and a
page that swaps itself out mid-recipe has destroyed the thing the user cared about. That is
also why `src/pwa.ts` registers the worker plainly instead of using `virtual:pwa-register`,
whose autoUpdate mode reloads on its own.

The app icons in `public/icons/` come from the design assets and are the only icon files:
the CRA-era `favicon.ico` / `logo192.png` / `logo512.png` are gone, and `index.html` points
its `icon` and `apple-touch-icon` at `icon-192.png`. `icon-maskable-512.png` is drawn
inside an 80% safe zone, which is what makes it safe to declare `purpose: "maskable"`.

## Deployment — two hosts, only one of which users see

The app is served by **Cloudflare Pages** (see README). Firebase Hosting is also configured
and `firebase deploy --only hosting` works, but **nothing reaches users that way** — it
updates `whatsfordinner-e69a4.web.app`, which is not the URL the app is used from. Deploying
the client means pushing to the branch Cloudflare builds. Firebase deploys are still how the
**Cloud Functions** and **Firestore rules** ship.

Cloudflare Pages gives every deployment its own `<hash>.<project>.pages.dev`; only a
*production* deployment also updates the stable `<project>.pages.dev`. A production branch
that does not match the branch being built makes every build a preview, and the URL changes
each time.

Header config lives in **two places that do not talk to each other**: `firebase.json`
`headers` (Firebase only) and `public/_headers` (Pages only). Cloudflare ignores the first
outright. Anything that must not be cached — `version.json`, `sw.js`,
`manifest.webmanifest` — needs an entry in *both*, or the update check silently reports
"you are current" forever from a CDN cache.

## Tests

Vitest + jsdom + Testing Library, setup in `src/test/setup.ts`. Tests sit next to what
they cover. `RecipePresenter` is a plain class with no React or Firebase dependency and is
directly unit-testable; `src/App.test.tsx` is the wiring smoke test (auth guard, redirect,
signed-in route) and shows the Firebase mocking pattern.
