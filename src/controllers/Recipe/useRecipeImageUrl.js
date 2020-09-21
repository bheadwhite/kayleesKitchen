import { useEffect, useState } from "react"
import useRecipeController from "controllers/Recipe/useRecipeController"

const useRecipeImageUrl = () => {
  const recipeController = useRecipeController()
  const [url, setUrl] = useState(recipeController.imageUrl.getState())

  useEffect(() => {
    const subscription = recipeController.onImageUrlChange((url) => setUrl(url))
    return () => subscription.unsubscribe()
  }, [recipeController])

  return url
}

export default useRecipeImageUrl
