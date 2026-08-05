import { createContext, useContext, useMemo, type ReactNode } from "react"
import { Status } from "@tcn/state/core"
import { useSignalValue } from "@tcn/state/react"

import { AiDraftPresenter } from "presenters/AiDraftPresenter"

const AiDraftContext = createContext<AiDraftPresenter | null>(null)

interface AiDraftProviderProps {
  children: ReactNode
  /** Inject a presenter in tests; an injected one is the caller's to dispose. */
  presenter?: AiDraftPresenter
}

export const AiDraftProvider = ({ children, presenter }: AiDraftProviderProps) => {
  const value = useMemo(() => presenter ?? new AiDraftPresenter(), [presenter])

  // Not disposed on unmount — same StrictMode reasoning as AuthProvider.tsx.
  // The editor calls `presenter.reset()` when it unmounts.

  return <AiDraftContext.Provider value={value}>{children}</AiDraftContext.Provider>
}

export const useAiDraftPresenter = () => {
  const presenter = useContext(AiDraftContext)
  if (presenter == null) {
    throw new Error("useAiDraftPresenter must be used inside an <AiDraftProvider>")
  }
  return presenter
}

export const useAssistantTurns = () => useSignalValue(useAiDraftPresenter().turnsBroadcast)

export const usePendingImages = () =>
  useSignalValue(useAiDraftPresenter().pendingImagesBroadcast)

export const useProposedDraft = () =>
  useSignalValue(useAiDraftPresenter().proposedDraftBroadcast)

/** `{ isAsking, error }` — derived from the ask `Runner`'s state. */
export const useAssistantStatus = () => {
  const state = useSignalValue(useAiDraftPresenter().askRunnerBroadcast)
  return {
    isAsking: state.status === Status.PENDING,
    error: state.status === Status.ERROR ? state.error : null,
  }
}

export default AiDraftProvider
