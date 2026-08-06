import { createContext, useContext, useMemo, type ReactNode } from "react"
import { Status } from "@tcn/state/core"
import { useSignalValue } from "@tcn/state/react"

import { PlannerPresenter } from "presenters/PlannerPresenter"

const PlannerContext = createContext<PlannerPresenter | null>(null)

interface PlannerProviderProps {
  children: ReactNode
  /** Inject a presenter in tests; an injected one is the caller's to dispose. */
  presenter?: PlannerPresenter
}

export const PlannerProvider = ({ children, presenter }: PlannerProviderProps) => {
  const value = useMemo(() => presenter ?? new PlannerPresenter(), [presenter])

  // Not disposed on unmount — same StrictMode reasoning as ChefProvider.
  // `openFor` drops everything when a different account signs in.

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export const usePlannerPresenter = () => {
  const presenter = useContext(PlannerContext)
  if (presenter == null) {
    throw new Error("usePlannerPresenter must be used inside a <PlannerProvider>")
  }
  return presenter
}

/** Every session you are in, newest first. */
export const usePlanningSessions = () => useSignalValue(usePlannerPresenter().sessionsBroadcast)

/**
 * The session on screen. Derived from the id rather than held separately, so a
 * change to the session document — somebody joining, the covers moving — lands
 * here without a second subscription to keep in step.
 */
export const useCurrentSession = () => {
  const presenter = usePlannerPresenter()
  const sessions = useSignalValue(presenter.sessionsBroadcast)
  const id = useSignalValue(presenter.sessionIdBroadcast)
  return sessions.find((session) => session.id === id) ?? null
}

/**
 * Why the session list is empty, when it is empty for a reason rather than
 * because you are in none. Null the rest of the time.
 */
export const usePlannerLoadError = () =>
  useSignalValue(usePlannerPresenter().loadErrorBroadcast)

/** Asks waiting on you. Shown on your own tab, never inside a session. */
export const useSessionInvites = () => useSignalValue(usePlannerPresenter().invitesBroadcast)

/** Everything planned in the open session from the earliest week on screen. */
export const usePlannedMeals = () => useSignalValue(usePlannerPresenter().mealsBroadcast)

export const useShoppingItems = () => useSignalValue(usePlannerPresenter().itemsBroadcast)

/** Which week the agenda is showing, in weeks from this one. */
export const useWeekOffset = () => useSignalValue(usePlannerPresenter().weekOffsetBroadcast)

/** The days the next build covers. */
export const useShopDays = () => useSignalValue(usePlannerPresenter().shopDaysBroadcast)

/** What the last build did, or null if none has run this session. */
export const useLastBuild = () => useSignalValue(usePlannerPresenter().lastBuildBroadcast)

/** `{ isBuilding, error }` — derived from the build `Runner`'s state. */
export const useBuildStatus = () => {
  const state = useSignalValue(usePlannerPresenter().buildRunnerBroadcast)
  return {
    isBuilding: state.status === Status.PENDING,
    error: state.status === Status.ERROR ? state.error : null,
  }
}

/** `{ isBusy, error }` for starting, joining, and leaving — all slow writes. */
export const useSessionStatus = () => {
  const state = useSignalValue(usePlannerPresenter().sessionRunnerBroadcast)
  return {
    isBusy: state.status === Status.PENDING,
    error: state.status === Status.ERROR ? state.error : null,
  }
}

export default PlannerProvider
