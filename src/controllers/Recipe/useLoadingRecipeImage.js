import { useState, useEffect, useMemo } from "react"
import useRecipeController from "./useRecipeController"
import useRecipeImageUrl from "./useRecipeImageUrl"

const useLoadingRecipeImage = () => {
  const recipeController = useRecipeController()
  const url = useRecipeImageUrl()
  const [isLoading, setIsLoading] = useState(
    recipeController.loadingRecipeImage.getState()
  )

  const sub = useMemo(
    () => recipeController.onLoadingRecipeImage((bool) => setIsLoading(bool)),
    [recipeController]
  )

  useEffect(() => {
    if (url == null) {
      setIsLoading(false)
    }
  }, [url])

  useEffect(() => {
    return () => sub.unsubscribe()
  }, [sub])

  return isLoading
}

export default useLoadingRecipeImage
