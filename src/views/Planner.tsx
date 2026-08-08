import clsx from "clsx"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "react-toastify"

import { Button, CartIcon, ChevronRightIcon, UsersIcon } from "components"
import {
  Agenda,
  CoversStepper,
  PlanMealDialog,
  SessionSheet,
  ShopWindow,
  ShoppingList,
  type PlanTarget,
} from "components/Planner"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useAskedIn,
  useBuildStatus,
  useCurrentSession,
  useLastBuild,
  usePlannedMeals,
  usePlannerLoadError,
  usePlannerPresenter,
  usePlanningSessions,
  useSessionStatus,
  useShopDays,
  useShoppingItems,
  useWeekError,
  useWeekOffset,
} from "contexts/PlannerProvider"
import { onRecipesSnapshot } from "fire/services"
import useEveryone from "hooks/useEveryone"
import type { MealSlot, PlannedMeal, Recipe } from "@/types"

type Tab = "agenda" | "list"

const Segment = ({
  active,
  onClick,
  children,
  meta,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  meta?: string
}) => (
  <button
    type='button'
    onClick={onClick}
    aria-pressed={active}
    className={clsx(
      "flex flex-1 cursor-pointer touch-manipulation items-center justify-center gap-2 border py-2.5",
      "font-heading text-sm font-semibold tracking-[0.09em] uppercase transition-colors",
      active
        ? "border-steel bg-steel-100 text-steel-700"
        : "border-divider text-muted hover:bg-ink/5"
    )}>
    {children}
    {meta && (
      <span
        className={clsx(
          "grid h-5 min-w-5 place-items-center px-1 font-mono text-[11px]",
          active ? "bg-steel text-ground" : "bg-ink/10 text-muted"
        )}>
        {meta}
      </span>
    )}
  </button>
)

/**
 * The Plan tab: one session's week and its shopping list.
 *
 * **Planning is a group thing**, so the first thing this screen asks is which
 * group — the session bar at the top is the context everything below it hangs
 * off, and switching it swaps the week, the list, and the number of people
 * being cooked for all at once.
 *
 * The two halves are segments rather than routes: which one you are looking at
 * is view state, so a trip into a recipe and back does not land you on the
 * wrong one. `?tab=list` seeds it once on arrival, the way `<Recipes>` reads
 * `?open=`.
 */
const Planner = () => {
  const navigate = useNavigate()
  const user = useSessionUser()
  const planner = usePlannerPresenter()

  const sessions = usePlanningSessions()
  const session = useCurrentSession()
  const asked = useAskedIn()
  const meals = usePlannedMeals()
  const items = useShoppingItems()
  const weekOffset = useWeekOffset()
  const shopDays = useShopDays()
  const { isBuilding } = useBuildStatus()
  const { isBusy } = useSessionStatus()
  const lastBuild = useLastBuild()
  const loadError = usePlannerLoadError()
  const weekError = useWeekError()
  const everyone = useEveryone()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  // Told apart from "no recipes yet", which is what the picker would otherwise
  // claim on a listener that never fired — see `PlanMealDialog`'s empty state.
  const [recipesError, setRecipesError] = useState<Error | null>(null)
  useEffect(
    () =>
      onRecipesSnapshot(
        (loaded) => {
          setRecipesError(null)
          setRecipes(loaded)
        },
        (error) => setRecipesError(error)
      ),
    []
  )

  const [searchParams] = useSearchParams()
  const initialTab = useRef<Tab>(searchParams.get("tab") === "list" ? "list" : "agenda").current
  const [tab, setTab] = useState<Tab>(initialTab)
  const [target, setTarget] = useState<PlanTarget | null>(null)
  const [switching, setSwitching] = useState(false)

  const me = useMemo(
    () =>
      user == null
        ? null
        : { uid: user.uid, name: user.displayName ?? user.email, email: user.email },
    [user]
  )

  // Safe on every render: the presenter re-subscribes only when the person
  // actually changes.
  useEffect(() => {
    planner.openFor(me)
  }, [planner, me])

  const left = items.filter((item) => !item.checked).length

  /**
   * Runs a write, and says so when it fails.
   *
   * The message carries the error's own text when there is one, because
   * "Could not delete that session" on its own is unactionable — the thing
   * worth knowing is *which step* and *why*, and Firestore's codes
   * (`permission-denied`) say exactly that.
   */
  const guard = (work: Promise<unknown>, whenItFails: string) => {
    void work.catch((error: unknown) => {
      console.error(whenItFails, error)
      const detail = error instanceof Error ? error.message : ""
      toast.error(detail === "" ? whenItFails : `${whenItFails} — ${detail}`)
    })
  }

  const openMeal = (meal: PlannedMeal) =>
    // The recipe list already knows how to open one from a URL, so planning
    // reuses it rather than growing a second way to render a recipe.
    navigate(`/recipes?open=${encodeURIComponent(meal.recipeId)}`)

  /* ------------------------------------------------------- no session yet */

  if (session == null) {
    return (
      <div className='w-full max-w-[720px]'>
        <div className='px-1 pt-8'>
          {/* A listener that failed hands back nothing, which looks exactly
           *  like being in no sessions — so when there is a reason, it is said
           *  outright rather than left as a cheerful invitation to start one
           *  that will not work either. */}
          {loadError != null ? (
            <>
              <h1 className='mb-3 font-heading text-[28px] leading-tight font-bold'>
                Can't read your sessions.
              </h1>
              <p className='mb-3 text-[15.5px] leading-relaxed text-muted'>
                This is the app's fault, not yours — nothing you planned is lost. Starting
                a session won't work until it's sorted.
              </p>
              <p className='border border-danger/40 bg-danger-100 px-3 py-2 font-mono text-[12px] break-words text-danger'>
                {loadError.message}
              </p>
            </>
          ) : (
            <>
              <h1 className='mb-3 font-heading text-[28px] leading-tight font-bold'>
                Planning is a group thing.
              </h1>
              <p className='mb-6 text-[15.5px] leading-relaxed text-muted'>
                Start a session and ask people in, or wait for someone to ask you. Whoever's
                in it shares the week and one shopping list.
              </p>
              <Button variant='primary' onClick={() => setSwitching(true)} className='mt-0 mr-0'>
                <UsersIcon />
                {sessions.length === 0 ? "Start a session" : "Pick a session"}
              </Button>
            </>
          )}
        </div>

        <SessionSheet
          open={switching}
          onClose={() => setSwitching(false)}
          sessions={sessions}
          current={null}
          me={me}
          people={everyone}
          asked={asked}
          onPick={(id) => planner.selectSession(id)}
          onStart={(name, covers) =>
            guard(planner.startSession(name, covers), "Could not start that session.")
          }
          onInvite={(email) => guard(planner.invite(email), "Could not send that ask.")}
          onRemove={(uid) => guard(planner.removeMember(uid), "Could not take them out.")}
          onLeave={() => guard(planner.leaveSession(), "Could not leave that session.")}
          onDelete={() => guard(planner.deleteSession(), "Could not delete that session.")}
          iOwnThis={false}
          plannedCount={0}
          itemCount={0}
          isBusy={isBusy}
        />
      </div>
    )
  }

  /* ---------------------------------------------------------- the session */

  return (
    <div className='w-full max-w-[720px]'>
      {/* The session bar. Everything below it belongs to whatever this says. */}
      <button
        type='button'
        onClick={() => setSwitching(true)}
        className='mb-3 flex h-[52px] w-full cursor-pointer touch-manipulation items-center justify-between gap-2 border border-steel px-3 transition-colors hover:bg-steel-100'>
        <span className='flex min-w-0 items-center gap-2'>
          <UsersIcon className='h-5 w-5 shrink-0 text-steel-700' />
          <span className='truncate font-heading text-[16px] font-semibold tracking-[0.03em]'>
            {session.name}
          </span>
        </span>
        <span className='flex shrink-0 items-center gap-2'>
          <span className='font-mono text-[11px] text-muted'>
            {session.members.length === 1 ? "just you" : `${session.members.length} people`}
          </span>
          <ChevronRightIcon className='h-3.5 w-3.5 rotate-90 text-muted' />
        </span>
      </button>

      <div className='mb-3 flex items-center gap-2.5'>
        <span className='font-mono text-[11px] tracking-[0.12em] text-muted uppercase'>
          Cooking for
        </span>
        <CoversStepper
          value={session.covers}
          onChange={(next) => guard(planner.setCovers(next), "Could not change that.")}
          noun='at the table'
        />
        <span className='flex-1 text-[12.5px] leading-tight text-muted'>
          {(() => {
            const own = meals.filter((meal) => meal.serves != null).length
            return own === 0
              ? "every meal in this session"
              : `${own} meal${own === 1 ? " keeps its" : "s keep their"} own`
          })()}
        </span>
      </div>

      <div className='mb-4 flex gap-1'>
        <Segment active={tab === "agenda"} onClick={() => setTab("agenda")}>
          Agenda
        </Segment>
        <Segment
          active={tab === "list"}
          onClick={() => setTab("list")}
          meta={left > 0 ? String(left) : undefined}>
          <CartIcon className='h-4 w-4' />
          Shopping list
        </Segment>
      </div>

      {/* An empty week and an unreadable one look identical, and the second one
       *  makes everything you do next look broken: the meal is written, the
       *  listener that would show it never fires, and planning appears to do
       *  nothing. Said outright, above both tabs, because it applies to the
       *  list as much as to the agenda. */}
      {weekError != null && (
        <p className='mb-3 border border-danger/40 bg-danger-100 px-3 py-2 text-[13px] leading-snug text-danger'>
          <strong className='font-heading'>Can't read this session.</strong> Anything you
          plan is saved, but it won't show up here until this clears.{" "}
          <span className='font-mono text-[12px] break-words'>{weekError.message}</span>
        </p>
      )}

      {tab === "agenda" ? (
        <Agenda
          meals={meals}
          weekOffset={weekOffset}
          covers={session.covers}
          onPrevious={() => planner.previousWeek()}
          onNext={() => planner.nextWeek()}
          onThisWeek={() => planner.thisWeek()}
          onAdd={(date, slot) => setTarget({ date, slot })}
          onRemove={(meal) =>
            guard(planner.unplanMeal(meal.id), `Could not take ${meal.title} off the plan.`)
          }
          onOpen={openMeal}
          onServes={(meal, serves) =>
            guard(planner.setMealServes(meal, serves), "Could not change that.")
          }
        />
      ) : (
        <>
          <ShopWindow
            meals={meals}
            picked={shopDays}
            onToggleDay={(date) => planner.toggleShopDay(date)}
            onPickDays={(days) => planner.setShopDays(days)}
            onBuild={() => guard(planner.buildList(recipes), "Could not build the list.")}
            isBuilding={isBuilding}
          />

          {/* What the last build actually did. The degraded paths especially
           *  have to say so: an untidied list otherwise looks like the chef
           *  doing a bad job rather than the chef not having been reached. */}
          {lastBuild != null && (
            <div className='mt-4 border border-divider bg-surface px-3 py-2 text-sm'>
              <p>
                {lastBuild.added === 0 && lastBuild.merged === 0
                  ? "Nothing new — it was all on the list already."
                  : `Added ${lastBuild.added}, folded ${lastBuild.merged} into rows already here.`}
                {lastBuild.analysed > 0 &&
                  ` Worked out how ${lastBuild.analysed} recipe${lastBuild.analysed === 1 ? "" : "s"} scale${lastBuild.analysed === 1 ? "s" : ""} — that part is now free forever.`}
              </p>
              {lastBuild.skipped > 0 && (
                <p className='text-muted'>
                  {lastBuild.skipped} planned meal
                  {lastBuild.skipped === 1 ? " is" : "s are"} no longer filed, so nothing
                  could be read off {lastBuild.skipped === 1 ? "it" : "them"}.
                </p>
              )}
              {lastBuild.unscaled > 0 && (
                <p className='text-muted'>
                  {lastBuild.unscaled} recipe{lastBuild.unscaled === 1 ? "" : "s"} went in at
                  the amounts as written — no scaling rules, and none could be worked out.
                </p>
              )}
              {lastBuild.usedFallback ? (
                <p className='text-muted'>
                  The chef could not be reached, so this was merged plainly.
                </p>
              ) : (
                lastBuild.note && <p className='text-muted'>{lastBuild.note}</p>
              )}
            </div>
          )}

          <div className='mt-5'>
            <ShoppingList
              items={items}
              onToggle={(item) => guard(planner.toggleItem(item), "Could not tick that off.")}
              onRemove={(item) =>
                guard(planner.removeItem(item.id), `Could not take ${item.name} off the list.`)
              }
              onAdd={(name) => guard(planner.addManualItem(name), "Could not add that.")}
              onClearChecked={() =>
                guard(planner.clearChecked(), "Could not clear the ticked rows.")
              }
            />
          </div>
        </>
      )}

      <PlanMealDialog
        open={target != null}
        onClose={() => setTarget(null)}
        recipes={recipes}
        recipesError={recipesError}
        target={target}
        recipe={null}
        onPlan={(date: string, slot: MealSlot, recipe: Recipe) =>
          guard(planner.planMeal(date, slot, recipe), "Could not plan that meal.")
        }
      />

      <SessionSheet
        open={switching}
        onClose={() => setSwitching(false)}
        sessions={sessions}
        current={session}
        me={me}
        people={everyone}
        asked={asked}
        onPick={(id) => planner.selectSession(id)}
        onStart={(name, covers) =>
          guard(planner.startSession(name, covers), "Could not start that session.")
        }
        onInvite={(email) => guard(planner.invite(email), "Could not send that ask.")}
        onRemove={(uid) => guard(planner.removeMember(uid), "Could not take them out.")}
        onLeave={() => guard(planner.leaveSession(), "Could not leave that session.")}
        onDelete={() => guard(planner.deleteSession(), "Could not delete that session.")}
        iOwnThis={session.ownerUid === me?.uid}
        plannedCount={meals.length}
        itemCount={items.length}
        isBusy={isBusy}
      />
    </div>
  )
}

export default Planner
