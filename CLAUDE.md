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
   `useAssistantTurns`, `usePendingImages`, `useProposedDraft`, `useAssistantStatus`,
`useChefTurns`, `useChefFork`, `useBaseServes`, `useChefStatus`, `usePlanningSessions`,
`useCurrentSession`, `useSessionInvites`, `useAskedIn`, `usePlannedMeals`, `useShoppingItems`,
`useWeekOffset`, `useShopDays`, `useLastBuild`, `useBuildStatus`, `useSessionStatus`).

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

### One address, one spelling

**Every email in the app is normalised — `normaliseEmail` in `src/email.ts`, lowercased and
trimmed — and profiles are keyed by it: `users/{email}`.**

Firebase Auth folds the case of the address it stores, so everything the app reads back from
a token (`user.email`, `request.auth.token.email`) is already lowercase, and everything
derived from a token — recipe authorship, session members, storage paths, invites — is
consistent with everything else for free. **Registration was the one place a *typed* address
entered the system**, and it wrote `values.email` verbatim. One capital letter there filed a
profile under a spelling nothing else could ever match again.

That is not a cosmetic bug, and the visible half was the mild half:

- The person appears **twice in the invite picker**, once reachable and once not.
- An ask sent to the unmatched spelling is **invisible from both ends** — filtered out by the
  recipient's own `where("toEmail", "==", …)` query against their token, *and* denied by the
  invite read rule, which compares the same two strings. It is written successfully and
  never arrives, which is precisely the failure `useEveryone`'s picker exists to prevent.

The fix is the id, not a check. The previous guard was `addDoc` plus "is there one already?",
which is both a race and — fatally — case-sensitive. `profileRef` keys the document by the
normalised address the way `tags` and `pantry` do, and **`firestore.rules` pins the id to the
document's own `email` field**, exactly as the invites block does. Rules have no `lower()`,
so the pin is to equality with the field; `profileRef` is what normalises, and it is the only
way the collection is addressed. `create`/`update` are spelled out separately from `delete`
because `request.resource` is null on a delete, and a single `write` clause carrying the
check would forbid deletion as a side effect rather than as a decision.

Two things follow that are easy to get wrong:

- **The id and the stored field have to move together.** `inviteToSession` normalises
  `toEmail` into both, because the create rule pins one to the other. Normalising only the id
  trades a silently undeliverable invite for a rejected write.
- **Re-keying existing data is not optional.** A profile still sitting under a random id is
  invisible to `getDoc(profileRef(email))`, so `ensureUserProfile` decides there is none and
  writes a second one — the migration and the client deploy cannot be separated without
  reintroducing the bug for everyone at once.

`isValidEmail` (same file) is what keeps an unreachable address out in the first place. It is
deliberately not RFC 5322 — the local part may legally contain almost anything, and a
validator that chases that correctly rejects real addresses to catch typos a confirmation
mail would catch for free. It insists on the part that actually went wrong: **no whitespace
anywhere, anchored at both ends**, and a domain of at least two non-empty labels. The pattern
it replaced, `/[^@]+@[^.]+\..+/`, had neither anchors nor a whitespace rule, so `[^@]+`
matched `maint .8` and a profile went into `users` at `maint .8@gmail.com` — a person who
could be picked out of the invite list and never reached. It validates the *normalised*
address, since trimming is what gets stored anyway.

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

### The chef

**There is one chef, met in two places.** In the editor it takes photos of a recipe, a
pasted link, or "double everything" and proposes a filled-in draft; on a recipe you are
reading it answers questions and hands back a working copy to cook from. Same name, same
hat, same voice in both system prompts — what differs is what it can reach, and that
belongs to the situation rather than to two personalities. The two callables stay separate
(`recipeAssistant` and `askChef`) because they carry different tools and different context,
and the admin console labels them "Chef · editor" and "Chef · recipe" so their spend is
still tellable apart.

The internals keep the older names — `AiDraftPresenter`, `components/AiAssistant/`,
`recipeAssistant` — because they describe what that half owns (a *draft*, for an editor).
Renaming the wire format would mean a Firestore field, a deployed callable, and the usage
history all moving at once to make a directory listing read better.

#### In the editor

It lives in a **drawer** (`components/AiAssistant/AssistantDrawer.tsx`) pulled out over the
editor from a launcher above the save bar, not in the form. As a panel at the bottom of the
form it put a conversation about the whole recipe below every part of it: you scrolled past
the thing you wanted to talk about to reach the box, then scrolled back to see what changed.
The panel mechanics live in **`components/ui/Drawer.tsx`**, shared with the recipe page's
copy, and three of them are load-bearing. It is **kept mounted and slid off-screen** rather
than unmounted — the message being typed is local state, and closing the drawer must not be
a way to lose it (a fixed box translated out of the viewport adds no scrollable overflow, so
this is free). It is `invisible` and `aria-hidden` when closed, which keeps a stray Tab out
and makes a plain `getByRole("dialog")` the right test for "is it open". And the page behind
is scroll-locked, or on a phone the recipe wanders off while you type.

This one renders **outside the `<form>`**, because nothing in it belongs to react-final-form
or to the recipe's submit; `<AiAssistant>` itself is a flex column that fills whatever height
it is given, with only the transcript scrolling.

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

A draft's changes are shown **twice, in two forms**. Before applying, the panel runs
`diffRecipe` between the editor as it stands and the draft, and `summariseChanges` turns
that into "Ingredients: 1 changed" — *what would change*, not what the draft contains, since
"12 ingredients" is equally true of a draft that touched one of them and one that replaced
the lot. "See what changed" expands `describeChanges` underneath it: the lines themselves,
grouped, each with the text being replaced struck through above the text replacing it. Tags and the photo are held level on both sides of that comparison because the
chef proposes neither. After applying, the marks in the editor take over (see the
unsaved-changes section) — and applying **closes the drawer**, because the reason to apply is
to look at what it did and the marked-up editor is behind the panel.

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

#### On a recipe you are reading

The chef's other half. You are looking at a recipe and want to know how many it feeds,
whether the buttermilk can be yogurt, or what it looks like for eight — and the answer to
any of those is a **working copy** (`ChefFork`) that replaces what the page renders.

**The copy is never written anywhere.** No Firestore document, no id, no rules change. That
is the whole reason it can be offered on other people's recipes as readily as your own: it
cannot damage anything, so it needs no ownership check and no confirmation. `ChefPresenter`
holds it, `Recipes` renders `{...selected, ...fork}` so the photo, tags, credit, and rating
keep belonging to the filed recipe — rating a copy would be rating the copy.

It *does* survive a reload, via `sessionStorage` keyed by recipe id. An installed PWA is
resumed rather than cold-started and a phone locks itself mid-recipe; a doubled ingredient
list that evaporates while the oven preheats is worse than never having offered to double
it. `openFor(recipe)` is called on every render and only resets when the **id** changes —
the list is a live snapshot, and its owner fixing a typo must not throw away a conversation
someone else is cooking from.

**Scope discipline is the thing the prompt spends most of its words on.** Asked to scale, the
model will happily also split "dressing" out into its component lines, reorder ingredients,
and reword steps it thinks read better — a copy that has quietly reorganised the recipe
looks finished, and the cook does not find out until they are at the counter with it. So
both the prompt and the `fork_recipe` schema say the same thing at the point the field is
being filled in: scaling changes amounts, not the *shape* — same lines, same order, same
names, same steps worded the same way, and only a substitution the cook asked for ever
replaces a line. "The copy must contain the FULL recipe" is a requirement to *include*
everything, not licence to *revise* everything, and it is spelled out that way because the
first phrasing alone reads as the second. Anything the chef would rather change goes in its
reply. When it slips anyway, the `<ChangeMark>`s are what surface it: an ingredient line
that was not there before wears a "new" chip.

**Scaling is the model's job, not arithmetic's.** Three eggs times 1.5 is four and you say
which way you rounded; salt and leavening do not scale on the same line as everything else;
times and temperatures do not scale at all; pans do, and a recipe that has outgrown its dish
is the failure that ruins the dinner and is invisible in a list of doubled quantities. A
client-side multiplier gets every one of those wrong, and gets "a pinch" and "salt to taste"
wrong on top. All of it is folded into the *steps* as well as the reply, because the copy
has to be cookable by someone who never read the conversation.

**The yield is cached server-side, and the cache invalidates itself.** "How many does this
feed?" has one answer for a given recipe, costs a model call to work out, and is asked of the
same dishes over and over — so `askChef` writes what it settled on to
`recipes/{recipeId}/chef/yield` and the client reads it on open. For any recipe anyone has
already asked about, the servings control is live **with no model call at all**, and the
number appears on the recipe itself as a "Serves 4" chip beside the credit and tags.

Invalidation is a **content fingerprint**, not a Firestore trigger. `recipeFingerprint`
(mirrored by hand in both packages, like the wire types) stamps the estimate with a hash of
the recipe it was read off; a reader that computes a different hash treats the estimate as
absent. A trigger on recipe writes is the other way and is worse in every respect that
matters: another deployed function, a window where the figure is live and wrong, no answer
at all for recipes edited before it existed, and nothing to check against if it misfires. A
stamp the reader verifies cannot be out of date, because being out of date is the thing it
reports. If the two implementations ever drift, every lookup misses and the chef is asked
again — wasteful, never wrong, which is the right way for this to fail.

**Only the ingredients and the method are in the fingerprint.** Renaming a recipe, retagging
it, or swapping its photo cannot change how much it makes, and invalidating on those would
mean paying for a model call to recover from a typo fix. `unique` is out for the same reason
— it decides how an ingredient is *drawn*.

Three more decisions in there:

- **Written only by the callable**, through the admin SDK; `firestore.rules` denies client
  writes outright, exactly as it does for `aiUsage`. This is the number the model produced,
  and the callable is the only place that knows it did not come from whoever typed it.
- **The callable reads it too**, into the context message. It does not skip the call — the
  turn may not be about the yield at all — but it stops the same recipe being told it feeds
  four today and five next week, which is what would end the number being trusted.
- **A figure settled in the current conversation outranks the stored one.** The cook is
  allowed to say "it feeds three in this house"; that correction is what gets written, and
  it then holds for the whole household until the recipe changes.

**A cache can block its own repair, and this one did.** `servingSize` was added after the
first estimates were already stored, and those entries could not heal: a stored *count*
makes the servings control live, so the cook is never shown "how many does this feed?", so
`estimate_servings` never fires, so the missing half is never written. The tool that fills
the gap is exactly the tool the cache stops from running. Two ways out, both taken:

- **A fork backfills it.** `fork_recipe` is strict, so every copy carries `baseServes` and
  `servingSize` — the cache's own contents. Scaling is the path people actually take, so
  the record repairs itself on the way past. `basis` is carried over from the existing entry
  rather than blanked, and there is no risk of pairing an old basis with a new count because
  `readCachedYield` already returns null when the fingerprint has moved.
- **The model is told the record is incomplete**, so any conversation on that recipe repairs
  it, not only a scaling one. Phrased as recording a missing fact rather than as a change,
  so it cannot be read as licence to touch the recipe.

Everything else about old data degrades rather than breaking: an entry with no serving size
still supplies its count (throwing it away to force a re-ask would spend a model call to
recover what is already in hand), and the chip simply reads "Serves 18" with nothing after
it. The general rule for this cache is that a missing field is a missing field, never a
fabricated default.

Known gap: a **kept variant** carries the `baseServes` and `servingSize` it was saved with
and is *not* fingerprint-checked or backfilled, so one saved before the recipe was edited —
or before serving sizes existed — still shows as it was. It is a saved artifact rather than
a cache, and still a valid thing to cook; stamping it and marking stale chips is one field
away if that turns out to matter.

Two tools rather than one, and the split is the servings control:

- **`estimate_servings`** — a recipe records no yield, so until the chef has read one off
  the ingredients and the method there is no number for a stepper to count from. So the
  control's first state is a single button asking exactly that. It reports a **serving
  size** alongside the count, and that pairing is the point: "serves 18" is unreadable for
  a batch of cookies until you know whether a serving is one of them or three. The size is
  invariant under scaling — more servings, not bigger ones — so a fork carries the same one
  through, and the recipe's chip reads "Serves 18 · 2 cookies".
- **`fork_recipe`** — the whole recipe plus `serves`, `baseServes`, and a one-line
  `summary`. `baseServes` rides on every fork rather than being remembered from an earlier
  estimate, because the cook is allowed to correct it ("it feeds three in this house") and
  the fork has to be scaled from whatever the current answer is. **Every scale is computed
  from the recipe as filed, never from a copy** — otherwise repeated adjustments compound
  their own rounding.

**"Double it" is one tap, and is the only scale offered before the yield is known.** Twice
the recipe is a complete instruction on its own, so making it wait behind "how many does
this feed?" would be spending a model call to enable a model call. It always means twice
*the filed recipe*, never twice the copy on screen — pressing it with a doubled copy loaded
gives that same copy back, because compounding would make one button mean two different
things on consecutive presses. It hides itself once the copy already is doubled, by the same
rule "Scale to N" follows.

**Stepping the servings does not send.** Each send is a model call, and walking from four to
eight would otherwise be four of them; you set the number and then press "Scale to 8", which
is also what makes the button honest about what it costs. It disappears when the number
already matches the copy, because a live button meaning "ask again for what you have" spends
a call to say nothing.

The changes are shown **twice, in two forms**, the same way an applied draft is in the
editor. `diffRecipe` between the filed recipe and the copy marks each changed row with a
`<ChangeMark>` — on a scaled list that is the difference between "everything moved" and
"only the flour did", which no summary sentence can say. And `<ChefBanner>` names the copy,
because a doubled ingredient list looks exactly like a recipe always written for eight, and
someone arriving from a lock screen has no other way to tell. **"Show original" swaps the
whole page** rather than annotating a line: the editor's peek answers "what did this row say
before" for one row, but here the question is "is this still the recipe", and the answer is
the recipe. Nothing is lost by looking.

The banner is **rendered twice** — a card in the flow of the page carrying the chef's
summary, and a compact bar `fixed` under the toolbar that fades in once the card has
scrolled away, so "which version am I reading" stays answerable from the middle of a long
recipe. Not one `position: sticky` card that sheds its summary when it sticks: that changes
the height of an element still in the flow, and everything below it jumps the moment you
scroll past. Two elements, one out of flow, nothing moves.

Two details in there are load-bearing. The bar is **kept mounted and hidden** rather than
conditionally rendered, because the scroll check reads *its own* `getBoundingClientRect()`
— a `fixed` element's top is the resolved offset under the toolbar, safe-area inset
included, which beats parsing a `calc()` over two custom properties back out of the
stylesheet — and `aria-hidden` plus `visibility: hidden` keep its duplicate controls out of
the accessibility tree and the tab order meanwhile. And the card **keeps its summary, muted,
while the original is showing**: "Show original" is reachable from the bar halfway down the
recipe, and dropping four lines out of a card above you shunts the step you were reading up
the screen.

**Copies can be kept, and that is the one thing here that is written down.**
`recipes/{recipeId}/variants/{id}` — `ChefVariant`, the fork plus who kept it and when.
Everything else about the chef is scratch, but "double it" is a question a household asks
of the same recipe every year and the answer does not change between askings; paying the
model to work it out again is paying twice for the same sentence. Loading one is a Firestore
read and **no model call at all** — no wait, and the same answer you cooked from last time
rather than a fresh one that might differ in a detail.

- **A subcollection**, because a variant has no meaning away from its recipe. Note that
  **rules do not cascade into subcollections**: `firestore.rules` matches `variants` in its
  own block, and `match /recipes/{docId}` reaches the recipe document and nothing beneath
  it. `npm run deploy:check` says whether the live ruleset has that block yet.
- **Shared, like the recipe box.** A doubled version is as useful to whoever cooks next as
  to whoever asked for it. `allow update: if false` — a variant is a snapshot of what the
  chef handed back at a moment, and an editable one is a recipe wearing the wrong label;
  keep another and forget this one.
- **The chef names it** (`label` on the fork schema — "Feeds 8", "Dairy-free"), so keeping
  one is a single tap. A copy you have to stop and title is a copy nobody keeps, and an
  untitled pile of them is no better than none. `label` post-dates the first stored
  sessions, so `restore()` falls back to `Feeds ${serves}` rather than rendering a nameless
  chip.
- **`savedAs` is what stops a duplicate.** It holds the id of the loaded variant, survives
  the reload alongside the fork, and is cleared the moment the chef hands back something
  new — so the offer to keep comes back for a fresh copy and not for one already filed.
- **`ChefPresenter` owns the listener**, subscribing in `openFor` and unsubscribing when the
  recipe id changes, because that is exactly the lifetime. The subscription is *stored* —
  an unheld one is `WeakRef`-collected mid-session and silently stops firing. The store is
  injectable (`VariantStore`) so no test reaches Firestore.
- **Forgetting one is behind a confirm; discarding the copy on screen is not.** Discard
  costs a tap to undo; forgetting costs a model call, and it is shared, so what is being
  thrown away may be something someone else kept.

No `web_fetch` here, deliberately. The editor's half needs it because a pasted link is one
of the things it is for; this half is looking at a recipe already in the request, and a tool
that can wander off is an invitation to answer "can I swap the buttermilk" with somebody
else's recipe. `httpsCallable` gets an explicit **180s timeout** (`CALL_TIMEOUT_MS` in
`src/ai/chef.ts`) — the 70s default abandons calls the server goes on to finish and bill.

`functions/src/conversation.ts` is the shared half of both callables: transcript to content
blocks, cache breakpoint, the `pause_turn` resume loop, telemetry, and provider-error
mapping. Only the system prompt, the tools, and the context message differ between them, and
that is exactly what `runConversation` takes as arguments.

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

Five things keep this from being flaky, and each one was a real failure:

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
- **The last hop says something when it fails.** Everything above reports its failures;
  drawing the picture did not. The callable would succeed, the upload would succeed, and
  then the `<img>` either failed to decode — `onError` cleared the URL, so the frame went
  back to the empty "photo · finished dish" plate with no message and no log — or never
  resolved at all, leaving a spinner up forever because only `onLoad` clears it. Both read
  to the cook as "I pressed Generate and nothing appeared", and neither left a trace: the
  function logs showed clean first-attempt successes throughout.

  So `ImageUpload` now treats a preview that will not draw as an event. It **evicts the URL
  from the worker's image cache** (`forgetCachedImage` in `src/pwa.ts`) and retries once
  behind a `retry=` parameter, which steps past the browser's image cache too;
  `PREVIEW_TIMEOUT_MS` catches the request that resolves neither way. When the retry fails
  as well, the frame says *"Preview didn't load"* and **the photo is kept** — the staged
  file stays on the presenter so saving still writes it, and `imageUrl` stays put so an
  update cannot write `image: null` over a picture that was fine. Clearing it was the old
  behaviour and was the more expensive half of the bug.

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
  anything else puts it back — which is what makes "undo the chef's draft" correct —
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
applying a chef's draft **records** one (it is the step people most want to take back).

### Unsaved changes, and showing what they are

`src/recipeDiff.ts` compares what is on the screen with what was last saved, and everything
the editor says about unsaved work comes from that one pure function: the count on the save
bar, the disabled Update button, the tint and `<ChangeMark>` on a changed row, the "N
removed" lines, and the discard prompt on Cancel.

The baseline lives on `RecipePresenter` (`_baseline`, set by `markSaved`) and is **not a
Signal** — it moves only on load and on save, both of which already move something the
editor subscribes to.

**Each row diff carries the text it replaced** (`RowDiff.before`), and `usePeek`
(`src/hooks/usePeek.ts`) turns that into a press-and-hold: hold a changed ingredient, step,
or section title and the saved version appears in its place until you let go. A flag saying "changed" says
where to look but not whether the change was the one you wanted, and the answer is one line
of text with nowhere to live — showing both at once doubles the height of every edited row,
and a dialog to read six words is worse than not knowing. The rows are click-to-edit buttons,
so `usePeek` swallows the click that ends a hold (`onClickCapture`), and callers add
`select-none` or a long press raises the phone's selection magnifier over the text being
looked at.

**The mark is also the way back.** Tap a `<ChangeMark>` and it offers "Revert"; tap that and
it asks "Sure?" in the same spot — two taps in one place, no dialog and no travel, so the
confirmation lands under the finger already there. It disarms itself after four seconds so a
stray tap cannot leave a destructive button sitting where the next one falls. The presenter's
`revertIngredient` / `revertStep` / `revertSectionTitle` restore from `_baseline` and go
through `_record()` like any other edit, so a revert is itself undoable. **A row the saved
recipe does not have is removed rather than restored** — that is what reverting an addition
means, and refusing would leave the change the chef makes most of with no way back.

Marks are suppressed entirely until a recipe has been saved once (`marked` in
`RecipeEditor`): with no baseline every line is "new", and a brand-new recipe wearing a flag
and a tint on every row it has is saying nothing.

Three decisions hold this together:

- **`loadRecipe(recipe, { asSaved })`.** Opening a stored recipe re-bases; applying an
  a chef's draft must not, because re-basing there would report the chef's rewrite as
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

### Ratings, and what "anonymous" means here

Anyone can rate anyone else's recipe out of five stars, and the list sorts by it.

The data is split in two, and the split *is* the anonymity:

- **`ratings/{recipeId}_{uid}`** — one document per rater per recipe, holding the stars.
  **Readable only by the person who left it**, enforced in `firestore.rules`. Not by the
  cook whose recipe it is, not by the admin console. The composite id is what makes a second
  rating replace the first instead of stacking.
- **`ratingSum` / `ratingCount` on the recipe** — the shared numbers. Sum and count rather
  than an average, so *changing* a rating is arithmetic instead of a re-read of every rating
  ever left, and so sorting needs no extra reads.

`rateRecipe` writes both **in a transaction**: the read of the previous rating and of the
current totals has to be the one the arithmetic is based on, or two people rating at once
lose a vote between them. The rules cannot check that arithmetic — they check the star range,
that `uid` is yours, and that the recipe is not yours — so the totals are trusted the same
way the shared recipe collection already is.

**You cannot rate your own recipe**, and that is in the rules as well as the UI: hiding the
stars is a decision about rendering. It costs one `get()` per rating write, which is the
price of the rule meaning anything. There is no delete — an un-rating would have to move the
totals back down and nothing can check that it did.

Sorting is average descending, then the most-rated of a tie, then alphabetical. **Unrated
recipes sort last rather than as zero**: nobody has said they are bad, only that nobody has
said anything.

`Recipes` holds the open recipe **by id and looks it up in the live snapshot** rather than
keeping a copy — a copy taken at click time goes stale the moment anything about that recipe
changes, which rating it from that very page does immediately.

### The planner — sessions, a week, and the shop it implies

`/plan` is the fifth nav tab. It holds a **planning session**: a name, however many
are eating, a week of breakfast/lunch/dinner slots, and one shopping list, shared by
whoever is in it.

**Planning is a group thing, and the session is the group.** A recipe is worth the
same to everyone, which is why the recipe box is one shared collection; a week is
not, and it is not one person's either — two people cooking the same Thursday need
one week between them. So `sessions/{id}` is scoped to `memberUids`, which is both
the access list and the query key (`array-contains`, a single-field index). Somebody
can be in several sessions at once and switch between them; the Plan tab swaps the
week, the list, and the covers together.

Rules do not cascade, so `meals` and `shopping` each carry their own block, and each
one costs a `get()` of the session to check membership — a real read per tick in a
shop, and the price of membership meaning anything.

**A date is a `YYYY-MM-DD` string, never a Timestamp.** A Timestamp is an *instant*,
and an instant renders as a different day depending on where the phone is;
"Thursday's dinner" is a day on a wall calendar. `src/calendar.ts` exists to keep
that one bug out, and the two obvious one-liners are both wrong and both absent from
it: `new Date().toISOString().slice(0, 10)` reads the *UTC* day, and
`new Date("2026-08-06")` parses as UTC midnight, which renders as the 5th.

#### Joining, without a Cloud Function

`invites/{toEmail}_{sessionId}` — a composite id like `ratings`, so a second ask
replaces the first, and, because the id is **derivable**, `firestore.rules` can
`exists()` it without being handed one. That is what lets somebody write to a
session they are not yet in: the join clause allows an update that touches only
`memberUids`/`members`, adds only your own uid, and is backed by an ask addressed
to you.

**Addressed by email, not uid**, because a uid is not something this app can look
anybody up by — `users` holds names and addresses — and because the address is in
the auth token, so checking it costs no read. The uid only has to exist at the
moment of joining, and there it is `request.auth.uid`.

`acceptInvite` is **two writes in a fixed order**: join, then delete the ask. Not a
transaction, and not the other way round — the rule that lets a stranger write to
the session is the one that reads the invite, so consuming it first would revoke
the permission for the write that follows. The failure mode of this order is a
stale ask for a session you are already in, which the list filters out; the other
order loses the session.

**An ask is read from both ends, and the two must not be confused.** `onMyInvitesSnapshot`
finds the asks waiting on *you* (`where toEmail`), shown on your own tab by
`<SessionInvites>`; `onSessionInvitesSnapshot` finds the asks a session is waiting on *other
people* to answer (`where sessionId`), shown under "In this session". Both hand back
`SessionInvite[]`, so only the names keep them apart — `_invites` / `useSessionInvites`
against `_asked` / `useAskedIn`.

The second query is legal only because the invite read rule has a second arm for members
(`inSession(resource.data.sessionId)`) — **rules are not filters**, so a query is rejected
outright if it *could* return a document the reader is not allowed. That arm already had to
exist for a deleted session to sweep its own unanswered asks.

Showing them is not decoration. Pressing Invite used to leave the sheet looking exactly as it
did before, so asking again was the only way to find out you already had. Someone already
asked is dropped from the picker too: asking twice is harmless — the id makes it a replace,
not a stack — but a button that appears to do something and provably does nothing is worse
than no button.

**The picker shows the address under every name**, and matches on both. One profile per
address is an invariant; one profile per *name* is not, and must not be, because two people
can be called the same thing and both belong in the list. An invite sent to the wrong one of
two identical rows reaches a real person who is not the one meant — and the address is what
the ask is addressed to, so showing it is showing what the button will do. It rides in the
`aria-label` for the same reason.

#### Three ways out, and only one of them is anybody's

**Leave** takes you out. **Delete** ends the session for everybody, and is the owner's alone.
**Remove** takes somebody *else* out, and is the owner's alone for the same reason: a session
is one person's invitation to a group, so withdrawing it belongs to whoever issued it. A
member quietly removing the member who asked them in is not something a shared week should
allow.

All three are the same two writes or one — `leaveSession` and `removeFromSession` are one
function (`withoutMember`) behind two names, because stepping out and being taken out are one
member less either way. What differs is who may ask, and **`firestore.rules` is what decides
it**, not the sheet that draws the button. The update rule computes `leaving()` —
`resource.data.memberUids.removeAll(request.resource.data.memberUids)` — and allows the write
only if that list holds nobody but you, or you started the session.

**Nobody may take the owner out, including the owner**, and that clause is load-bearing rather
than tidy: reading a session needs membership and deleting one needs to be the owner, so an
owner who stepped out would leave a session standing that nobody can read and nobody can ever
delete. Before this rule existed, `allow update: if inSession(sid)` let any member do either.

Nothing a removed person planned leaves with them — the week and the list belong to the
session. On their own device it simply stops coming back from `watchSessions`, and
`settleSelection` moves them off it, the same path a session deleted elsewhere already took.
Asking them back is an ordinary invite, which is why removal is two taps in place
(`RemovePerson`, the `<ChangeMark>` gesture) rather than the sheet's heavier delete panel: one
costs an ask to undo, the other destroys a week.

#### Planning a meal, and why it must never fail quietly

`<PlanMealDialog>` is one component asked from both ends — the agenda has a day and
wants a recipe, a recipe page has a recipe and wants a day. **One decision, one
implementation**, so a change to what planning writes cannot apply to only one way in.

The whole path is now built so that **no step can decline in silence**, because the
symptom of any one of them doing so is identical and unreadable: *"I pressed Plan
something, tapped a recipe, and nothing appeared."* It reported that for four different
reasons, none of which said anything:

- **A dead recipe row.** The picker's rows were guarded by `target != null`, so with no
  target it rendered a full list of recipes that did nothing when tapped — under a
  cheerful "Plan a meal" heading. It refuses to draw at all now: `open` is driven by
  `target != null` today, but a silent dead end has no business in the component both
  ways into planning go through.
- **`planMeal` resolving with nothing done.** No session, no signed-in user, or a recipe
  with no document id were all a bare `Promise.resolve()`. None of them is a "nothing to
  do" case — the recipe came out of a list, so if it will not go on the week, the caller's
  `guard` has to be able to say why. They reject with a reason now. On the *recipe page*
  this was the worse half: that path toasted **"X is on the plan"** on the silent resolve,
  so a meal that went nowhere reported success.
- **A week that could not be read.** `onSessionMealsSnapshot` and
  `onSessionShoppingSnapshot` both take an `onError`, and `PlannerStore` dropped it. A
  denied listener hands back nothing, which renders exactly like a week nobody has planned
  — and then the meal *is* written, never appears, and planning looks broken. This is the
  same argument `watchSessions` and `_loadError` already made, simply not applied to the
  session's own contents; `_weekError` is the other half, and the banner says the plan is
  still being saved.
- **A recipe list that could not be read.** The picker said "No recipes yet", which is a
  claim about the recipe box that a failed listener is in no position to make.

The general rule this path is now held to: **an empty state may only describe the world,
never the reader's failure to see it.** Every listener that feeds a screen saying "there
is nothing here" needs an error channel, and there are three in the planner alone.

#### Scaling is a cached *rule*, not a cached answer

This is the piece that decides what the feature costs. Three jobs, and only one
recurs:

| Job | Keyed by | Cost |
| --- | --- | --- |
| Yield | recipe content | once per recipe version, ever |
| **Scaling rules** | **ingredient lines** | **once per version — answers every serving count** |
| Consolidating the list | nothing | once per build; the only recurring cost |

`analyseRecipeScaling` asks the chef **how each ingredient line responds** to
cooking for more people — linear, sublinear, or fixed, with rounding and a
preferred direction — and stores that at `recipes/{id}/scaling/{fingerprint}`.
`applyScale` in `src/scaling.ts` then produces the list for *any* number, purely,
instantly, offline, for nothing.

That drops a whole dimension off the cache key. Caching scaled *lists* would cost a
call per (recipe, N) pair, so an unusual eleven costs as much as the fourth
doubling; caching the *rule* means a session cooking for eleven pays nothing a
session cooking for four has not already paid. It is also what makes per-meal
serving overrides free, and why the agenda offers them on every card.

**A nullable enum in a `strict` tool schema is `anyOf`, never a type array.** The
validator checks each `enum` value against the declared type and cannot read the array
form, so `type: ["string", "null"]` beside `enum: [..., null]` is rejected — and rejected
at the *tool* level, which fails the whole call before the model sees anything. Write
`anyOf: [{ type: "string", enum: [...] }, { type: "null" }]` instead.

`analyseRecipeScaling` shipped with two such fields and therefore **never once succeeded**.
Nothing surfaced it, because every layer degrades rather than failing: no spec means
amounts as written, so the shopping list kept building and the only symptom was quantities
that quietly ignored the covers. The admin console said `internal`; the actual message was
in `gcloud functions logs read`. That is why failures now record the provider's own message
(see the admin console section) — a code that cannot tell "retry later" from "this can
never work" is not a diagnosis.

**It is data, not code.** A model can write a scaling function in JavaScript, and
running one in the browser is executing text a model produced — a code-execution
hole with a Firestore document for a delivery mechanism, which the PWA's CSP would
refuse anyway. A closed vocabulary of rules is inspectable, testable, and cannot do
anything but produce an amount.

**Keyed by `ingredientsFingerprint`, not `recipeFingerprint`** — deliberately
narrower than the yield's stamp. A rule about how much flour to buy is not changed
by a clearer instruction on how to fold it in, so rewriting step four must not throw
the spec away and buy it again. The yield keeps the wider stamp because how much a
recipe makes *can* turn on the method.

**Scaling happens lazily, at build time**, for the meals in the picked days only.
Firing a call as each meal is planned would spend money on meals that get moved or
deleted before any shop, and buys nothing: the stepper shows the target covers,
which is a number the cook set. Within one build, specs are memoised by recipe, so a
week with Tuesday's and Friday's chilli asks once.

**A spec is validated on the way out of the cache, not only on the way in**
(`isUsableSpec`). It is model output read for months, and the failure it must never
have is a confident wrong quantity — so anything malformed or stale is treated as
absent and the amounts go through as written.

#### The list

**Persistent and appended to**, not derived from the plan: it is read in a shop,
where the plan changing underneath is a rug-pull rather than a correction. Days are
**picked** rather than a rolling "next N", because the run people shop for is rarely
a prefix — presets cover the common ones.

`buildShoppingList` receives meals **already scaled** and the pantry already known,
so it is merging and nothing else. **`pantry/{name}`** is the third cache on the
same principle: which aisle an ingredient is in is a fact about a shop, not about
this list, and re-buying it every build pays repeatedly for an answer that never
changes. The callable writes back only names it did not already have, and never
writes "other" — that is the chef declining to place something, not a fact.

Every layer degrades rather than failing. No spec means amounts as written; no chef
means `consolidateVerbatim` merges by name with the pantry still supplying aisles.
**The shop is never blocked** — which is the whole point of writing the chef's work
down as data.

**A ticked row is never merged into**, enforced twice: the request carries only
unticked rows, so the chef cannot merge into something already bought, and
`mergePlan` re-checks because "should not" is not "cannot".

#### A build states a total; it does not add one

**This is what makes the list rebuildable, and it was wrong for a long time.**
`ShoppingKnown` carried `{id, name, amount, section}` and no provenance, so the chef
could not tell its own earlier work from a line the cook had added — and the prompt told
it to fold its line in and give the *combined* amount. Two presses of Build turned 2 lb of
beef into 4 lb, unreliably enough that some weeks it looked fine.

The fix is `from` on every existing line, plus a prompt that asks for **the total the line
should now read**. Which then requires the other half: **every recipe credited anywhere on
the list is read into the request**, not just the meals in the shop window. A recipe the
chef cannot see is a recipe whose share of a shared line it cannot preserve, so leaving
one out would quietly shrink "3 cups butter" to the cup this window happens to want.
`buildList` gathers the window's meals plus those `carried` ones, scaling the latter to
the session's covers because there is no planned meal left to take a number from.

Once a build is a statement, removal follows for free. `mergePlan` takes a `covered` —
what the build read and what it deliberately dropped — and a line crediting only those
that no proposal mentions is a line they no longer want. **Three things are never
removed**: a ticked row (it is in the trolley), a hand-typed row (no recipe claimed it),
and a row crediting anything outside `covered` (this build did not account for it, so it
does not get to decide). Omit `covered` entirely and nothing is removed, which is what the
**fallback path does deliberately** — `consolidateVerbatim` merges what it was given and
nothing else, so reading its silence as "drop it" would let an outage empty the list.

#### What the list covers

The list is persistent and outlives the plan it came from — that is the whole point, since
it is read in a shop with the week changing underneath. The cost is that a meal unplanned
yesterday is still on it, credited to a dinner nobody is cooking, and nothing ever said so.

`<ListSources>` is that made visible: a row of chips above the list naming every recipe it
carries lines for, read off `sourcesOf(items)` rather than off the week. It is the one
place the plan and the list can be seen against each other.

- **`ShoppingItem.fromIds` pairs each credit with a recipe id.** Titles are all the chef
  ever produces, and a title is not an identity: two recipes may share one, and a rename
  would orphan every line. The client fills the ids in from the meals it actually sent, so
  the pairing is known rather than matched. Absent on every line written before it
  existed — those still show and still merge, but cannot be looked up, so they are offered
  no switch and a build leaves them alone.
- **Dropping is immediate; adding is not.** Taking lines off costs nothing, so it happens
  on the tap. Putting them back means asking the chef to work the amounts out again, so a
  restored chip reads "build to add" rather than silently spending a call — a switch that
  costs money without saying so is a switch people stop touching.
- **A shared line keeps its amount and only loses the credit.** There is no subtracting
  "1 cup" from "3 cups" when both are text, and inventing an answer is how a list starts
  lying about quantities. The next build restates it exactly, which is now free.
- **`_dropped` is remembered per session in `sessionStorage`**, because a recipe still
  planned in the shop window would otherwise be put straight back by the next Build — two
  controls side by side disagreeing. Per device on purpose: it is a statement about the
  list you are about to build, and writing it to the session would let one person's
  tidy-up decide what everybody else's build contains.
- The chip says **"Drop X from this list"** where a row's own × says "Take foil off the
  list". Two controls that sound the same to anyone not looking at the screen are two
  chances to press the wrong one.

#### The AI seam

`functions/src/entitlement.ts` holds `assertCanSpend(caller, feature)`, which every
callable calls before spending and which lets everybody through today. It exists as
a **seam**: metering, tiers, or caps later are a change to that function's body
rather than a hunt through five callables for the places that quietly cost money.

The seam only means anything because of what sits behind it — the yield, the
scaling specs, and the pantry are durable data the app reads on its own. A household
that cannot spend still plans, still builds lists, and still scales any recipe
anyone has ever analysed. **What would be sold is the asking, not the using.**

The admin console's "Scaling rules" tile should trend to nothing. A number that
keeps climbing means the cache is missing — most likely the two hand-mirrored
`ingredientsFingerprint` implementations have drifted, which the callable also
guards against outright by comparing the client's stamp with its own.


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

**`/tags` (`views/TagManager.tsx`) is a nav tab of its own**, and it manages tags rather than
creating them: a tag with no recipe on it is an empty filter, and the moment you know you
want one is the recipe you are writing. What it owns is the part the editor cannot — the
colour, and the rename that has to reach **every recipe already wearing the word**.
`renameTag` does that fan-out in a single `writeBatch`, so a half-finished rename cannot
leave two names in circulation. That caps it at 500 writes, which a household recipe box
will not reach.

**Deleting is only allowed once nothing is filed under the tag**, and `deleteTag` enforces
it with its own server-side read rather than trusting the count on the screen. Rename edits
recipes because the label is still wanted, only spelled differently; delete would quietly
edit recipes — possibly other people's — to make a tidy-up in this screen possible, and the
person pressing it cannot see what they are about to change. The button stays visible and
says what to do instead, because a control that disappears gets hunted for.

`RecipeTable` and `Recipe` take the colour map as a **prop** rather than calling the hook:
`Recipes` owns the listener and hands it down, which keeps both presentational and keeps a
second Firestore listener out of a component rendered once per row.

### The admin console

`src/views/Admin.tsx` at `/admin` shows AI spend and sign-ins. It is a **sixth nav tab that
only the admin sees** — `NavBar` switches to `grid-cols-6` for them — and `src/admin.ts`
holds the one address.

> ⚠️ **`isAdmin()` is a UI affordance, not access control.** It decides what to render; it
> cannot decide what Firestore hands out. **`firestore.rules`** is what enforces it.

**`firestore.rules` is deployed by `firebase deploy`** — `firebase.json` points at it, so
the repo is the source of truth and the console is downstream. There is no clipboard step.

```bash
npm run deploy:check  # what is out of step: master, rules, functions
npm run ship          # push, then deploy whatever drifted
npm run deploy        # deploy whatever drifted, without pushing

npm run rules:diff    # live ruleset vs. the local file; exits 1 if they differ
npm run rules:live    # print what the server is actually serving
npm run rules         # print the local file
```

> ⚠️ This section used to say the opposite — that there was no `firestore` section and the
> rules had to be pasted into the console by hand. That stopped being true in `b809afc`,
> and the note outlived it by long enough to send a whole feature's worth of work through a
> clipboard for no reason, and to leave a client deployed against rules that denied it.
> **If a deploy step here looks manual, check `firebase.json` before believing it.**

`scripts/liveRules.mjs` backs the `rules:*` scripts. It reads the live ruleset through the
Firebase Rules API, authenticating with `gcloud auth print-access-token` — so it needs the
gcloud CLI and an account that can read the project. The project id comes from
`.firebaserc` (override with `FIREBASE_PROJECT`).

`rules:diff` shows `-` for live and `+` for local. Comment-only differences are normal when
the server copy predates the file, so read the diff for `match` blocks and `allow` lines.

**`addUser` creates the auth account before writing the `users` profile, and the order is
load-bearing.** `createUserWithEmailAndPassword` signs the new user in, which is what makes
the profile write authenticated. Reversed, registration touches `users` with no credentials
and the rules would have to leave that collection open to the internet.

Where each half of the data comes from, and why:

- **AI usage is written server-side** (`functions/src/telemetry.ts`, called from all five
  callables). Token counts only exist on the provider's response, which never reaches the
  browser — and a client-reported usage number is a number the client can make up. Failed
  calls are recorded too: a spike in rate-limit errors is exactly what the console is for,
  and tokens spent before a failure are still spent. `recordAiUsage` never throws and is
  never awaited — telemetry must not be able to fail a recipe transcription.

  **A failed row carries the provider's own message, not just the code.** `errorCode` is
  the `HttpsError` code, and it cannot separate two failures that need opposite responses:
  a rejected tool schema and an overloaded model are both `internal`. The real message used
  to go only to `console.error`, reachable through `gcloud functions logs read` and nowhere
  else — which is how `analyseRecipeScaling` sat in the console for a whole feature's
  lifetime looking like light traffic while having never once worked. `errorStatus` /
  `errorMessage` are truncated to 300 characters and safe to keep because `firestore.rules`
  limits reading `aiUsage` to the admin, and because it is the *provider's* message rather
  than the request: no prompt or recipe content is copied in. The image path had this
  information all along — `Attempt.detail` already said "prompt SAFETY" or "HTTP 429" — and
  was computing it, logging it, and discarding it at record time.

  **"Only failures" exists because the feed draws 25 of the 200 it holds.** A failure can be
  recorded perfectly well and still be pushed off the bottom by ordinary successful traffic,
  so a filter that reaches the whole window is the difference between a console that answers
  "what broke" and one that answers it only if it broke recently. It is hidden when nothing
  has failed — a control with one reachable state is a control that should not be drawn.
- **Sign-ins are written by the client** (`recordLogin` in `services.ts`, called from
  `AuthPresenter`) on *explicit* sign-ins only. A restored session on page load is not a
  login; recording one would make the log a page-view counter.

Both feeds are capped and newest-first (200 AI calls, 100 sign-ins), so the totals read
"recent", not all-time — an unbounded listener on a collection that grows with every AI call
would eventually pull the whole history onto a phone.

**That cap is why `aiUsageDaily` exists.** The raw feed cannot answer "what did last month
cost" — a busy week pushes the start of the month off the end of it — and raising the cap
reintroduces the exact problem the cap prevents. So `recordAiUsage` also increments one
document per `YYYY-MM-DD`, holding the same numbers summed. A month is thirty reads. It is
the same trick `ratingSum`/`ratingCount` play on a recipe: keep the sum, so reading it is
arithmetic rather than a re-read of every event ever recorded.

- **Two independently guarded writes**, not one block. The raw event tells you what just
  broke; the rollup tells you what the month cost. One failing must not take the other with
  it.
- **The model is nested inside the feature** (`features.{f}.models.{m}`) as well as recorded
  at the top level. Cost needs a rate, a rate belongs to a model, and pricing a feature from
  its bare token totals only works while every callable runs the same model — which is the
  assumption most likely to break next. Built as a nested object literal rather than
  dot-notation field paths, because `gemini-2.5-flash-image` would otherwise be read as four
  levels of nesting.
- **The day is UTC**, and it is the one place in this app a date is deliberately not the
  cook's local day (contrast `src/calendar.ts`, which exists to keep that bug out of the
  planner). This is a billing bucket, the server cannot know the household's timezone, and
  an evening split across two rows washes out of any weekly total.

**Tokens are stored; dollars are not.** `src/aiPricing.ts` holds the rates and cost is
computed at read time, so correcting a rate corrects every day already recorded — including
the ones being used as the baseline for a "should we self-host this" comparison. A cost
frozen into the record at write time is wrong forever with nothing left to recompute it
from. The rates are transcribed by hand and go stale; the console says so on screen, and an
unpriced model is counted as zero **and named**, because a confident wrong total is worse
than an obvious gap when the number is the input to a spending decision.

The console is **tabbed** — Spend, Calls, Sign-ins — because the call feed grows with
traffic and was pushing the totals off the top of the page. The failure count rides on the
Calls tab so a problem stays visible without opening it. **Build stays outside the tabs**:
the commit is what makes "did my fix actually deploy?" answerable from a phone, and an
answer you have to go looking for is one you stop checking.

### The build stamp

`vite.config.ts` `define` inlines `__APP_VERSION__` / `__APP_COMMIT__` / `__APP_BUILT_AT__`
at build time; `src/version.ts` wraps them with dev fallbacks. The version line sits at the
bottom of `<Profile>` for everyone and in full on the admin console. The commit is the part
that matters — it makes "did my fix actually deploy?" answerable from a phone.

**The version is the build date (`2026.8.6`), derived rather than declared, and
`package.json` has no `version` field at all.** It used to, and it read `0.2.0` for 122
commits and six years — through the framework rewrite, the chef, and the planner — because
nothing bumped it and nothing depended on it. A version that has to be remembered goes
stale, and a stale one is worse than none, because it reads as information.

Semver would earn its keep if anything consumed this package, but it is `private` and never
published, `functions/` carries no version either, and `<UpdateBanner>` compares the
**commit**. So the only real job left for a version is telling a person how old the build in
their hand is, which a date does with no discipline required. The two are shown together
because they answer different questions: the date says *when*, the commit says *which*.

Nothing needs doing to release. Push to the branch Cloudflare builds and the stamp follows.

Vitest reads the same `vite.config.ts`, so `define` applies in tests too: assertions see the
real stamp, not the fallbacks — which is why `Admin.test.tsx` can assert the version names
today, and would catch it freezing again.

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

`NavBar`'s tabs are Recipes, Editor, Plan, Tags, and the account — plus an Admin tab for the one
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
sticky filter 30, portaled menu 35, fixed chrome 40, drawer 48, dialog 50). Layers get set three
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

**That image cache stores opaque responses, and it has to.** An `<img>` fetches
cross-origin with `no-cors`, so what reaches the worker is status 0 — and an opaque
response cannot say whether the request worked: a 403 and a 200 are the same object to it.
`cacheableResponse.statuses` therefore lists `0`, which means **`CacheFirst` can store a
failure and serve it back for thirty days**, and did. Dropping the `0` is the tidy fix and
the wrong one: opaque is *all* these responses ever are, so it would mean caching no recipe
photo at all — and photos on a phone with no signal in a kitchen are the reason the rule
exists.

The repair is on the page instead, which is the only place that can tell: an image that
will not decode gets its URL evicted by `forgetCachedImage` (`src/pwa.ts`, whose
`RECIPE_IMAGE_CACHE` must match `cacheName` in `vite.config.ts` — the worker is generated,
so nothing links the two but hand). The real fix is a CORS configuration on the bucket,
making these ordinary 200s the worker can judge for itself; `gsutil cors get` currently
reports none.

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

**Three targets that move independently, and one command that says where each stands.**
`npm run deploy:check` answers "what needs updating — the functions, the rules, or just a
push?", which otherwise takes three commands and some archaeology, and which has twice been
answered wrongly here by shipping a client against rules that denied it. `npm run ship`
pushes and then deploys whatever actually drifted.

The two deploy targets are checked in deliberately different ways, and the difference is
worth knowing when one of them lies:

- **Rules are observed.** `rules:diff` fetches the live ruleset, so it reports what is
  really there.
- **Functions are recorded**, against a `deployed/functions` git tag moved on each
  successful deploy. Cloud Functions will not cheaply say which source it is running, so
  this is a record of intent — shared and versioned, but capable of being wrong if a deploy
  succeeds and the tag push does not. It says so when it has never been set at all.

`.githooks/pre-push` prints the same report and **never blocks**: the failures this exists
for came from not knowing, and a hook that refuses a docs typo because the functions are
stale gets disabled within a week. `npm install` installs it via the `prepare` script.

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
