import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useSignalValue } from "@tcn/state/react"

import { RecipePresenter } from "presenters/RecipePresenter"

const RecipeContext = createContext<RecipePresenter | null>(null)

interface RecipeProviderProps {
  children: ReactNode
  presenter?: RecipePresenter
}

export const RecipeProvider = ({ children, presenter }: RecipeProviderProps) => {
  const value = useMemo(() => presenter ?? new RecipePresenter(), [presenter])

  useEffect(() => {
    if (presenter) return
    return () => value.dispose()
  }, [value, presenter])

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

export const useEditIngredient = () =>
  useSignalValue(useRecipePresenter().editIngredientBroadcast)

export const useEditSection = () => useSignalValue(useRecipePresenter().editSectionBroadcast)

export const useRecipeImageUrl = () => useSignalValue(useRecipePresenter().imageUrlBroadcast)

export const useLoadingRecipeImage = () =>
  useSignalValue(useRecipePresenter().loadingRecipeImageBroadcast)

export default RecipeProvider
