import { createContext, useContext, useMemo, type ReactNode } from "react"
import { Status } from "@tcn/state/core"
import { useSignalValue } from "@tcn/state/react"

import { ChefPresenter } from "presenters/ChefPresenter"

const ChefContext = createContext<ChefPresenter | null>(null)

interface ChefProviderProps {
  children: ReactNode
  /** Inject a presenter in tests; an injected one is the caller's to dispose. */
  presenter?: ChefPresenter
}

export const ChefProvider = ({ children, presenter }: ChefProviderProps) => {
  const value = useMemo(() => presenter ?? new ChefPresenter(), [presenter])

  // Not disposed on unmount — same StrictMode reasoning as AiDraftProvider.
  // `openFor` drops the conversation when a different recipe is opened.

  return <ChefContext.Provider value={value}>{children}</ChefContext.Provider>
}

export const useChefPresenter = () => {
  const presenter = useContext(ChefContext)
  if (presenter == null) {
    throw new Error("useChefPresenter must be used inside a <ChefProvider>")
  }
  return presenter
}

export const useChefTurns = () => useSignalValue(useChefPresenter().turnsBroadcast)

export const useChefFork = () => useSignalValue(useChefPresenter().forkBroadcast)

export const useBaseServes = () => useSignalValue(useChefPresenter().baseServesBroadcast)

/** Copies of this recipe someone kept, newest first. */
export const useChefVariants = () => useSignalValue(useChefPresenter().variantsBroadcast)

/** The settled yield for this recipe, already checked against the recipe in hand. */
export const useRecipeYield = () => useSignalValue(useChefPresenter().yieldBroadcast)

/** The id of the saved copy currently loaded, or null if this one is unkept. */
export const useSavedAs = () => useSignalValue(useChefPresenter().savedAsBroadcast)

/** `{ isAsking, error }` — derived from the ask `Runner`'s state. */
export const useChefStatus = () => {
  const state = useSignalValue(useChefPresenter().askRunnerBroadcast)
  return {
    isAsking: state.status === Status.PENDING,
    error: state.status === Status.ERROR ? state.error : null,
  }
}

/** `{ isSaving }` — keeping a copy is a write, and a slow one can be pressed twice. */
export const useChefSaveStatus = () => {
  const state = useSignalValue(useChefPresenter().saveRunnerBroadcast)
  return { isSaving: state.status === Status.PENDING }
}

export default ChefProvider
