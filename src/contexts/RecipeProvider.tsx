import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useSignalValue } from "@tcn/state/react"

import { RecipePresenter } from "presenters/RecipePresenter"

const RecipeContext = createContext<RecipePresenter | null>(null)

interface RecipeProviderProps {
  children: ReactNode
  presenter?: RecipePresenter
}

export const RecipeProvider = ({ children, presenter }: RecipeProviderProps) => {
  const value = useMemo(() => presenter ?? new RecipePresenter(), [presenter])

  // Not disposed on unmount — see the comment in AuthProvider.tsx. The editor
  // clears its own state via `presenter.reset()` when it unmounts.

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>
}

export const useRecipePresenter = () => {
  const presenter = useContext(RecipeContext)
  if (presenter == null) {
    throw new Error("useRecipePresenter must be used inside a <RecipeProvider>")
  }
  return presenter
}

/*
 * These replace the eight hand-written subscription hooks that used to live in
 * `controllers/Recipe/` — each is now one `useSignalValue` over a broadcast.
 */
export const useIngredients = () =>
  useSignalValue(useRecipePresenter().ingredientsBroadcast)

export const useDirections = () => useSignalValue(useRecipePresenter().directionsBroadcast)

export const useTags = () => useSignalValue(useRecipePresenter().tagsBroadcast)

export const useRecipeHistory = () => useSignalValue(useRecipePresenter().historyBroadcast)

export const useEditIngredientIndex = () =>
  useSignalValue(useRecipePresenter().editIngredientIndexBroadcast)

export const useEditSection = () => useSignalValue(useRecipePresenter().editSectionBroadcast)

export const useRecipeImageUrl = () => useSignalValue(useRecipePresenter().imageUrlBroadcast)

export const useLoadingRecipeImage = () =>
  useSignalValue(useRecipePresenter().loadingRecipeImageBroadcast)

export default RecipeProvider
