import { useState, useEffect, useMemo } from "react"
import useRecipeController from "./useRecipeController"

const useLoadingRecipeImage = () => {
  const recipeController = useRecipeController()
  const [isLoading, setIsLoading] = useState(
    recipeController.loadingRecipeImage.getState()
  )

  const sub = useMemo(
    () => recipeController.onLoadingRecipeImage((bool) => setIsLoading(bool)),
    [recipeController]
  )

  useEffect(() => {
    return () => sub.unsubscribe()
  }, [sub])

  return isLoading
}

export default useLoadingRecipeImage
