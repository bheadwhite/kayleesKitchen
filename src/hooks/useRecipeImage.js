import { useEffect, useState } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useRecipeImage = () => {
  const recipeController = useRecipeController()
  const [url, setUrl] = useState(recipeController.image)

  useEffect(() => {
    const subscription = recipeController.imageSubject.subscribe({
      next(url) {
        setUrl(url)
      },
    })
    return () => subscription.unsubscribe()
  }, [recipeController])

  return url
}

export default useRecipeImage
