import { useEffect, useState } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useRecipeUrl = () => {
  const recipeController: any = useRecipeController()
  const [url, setUrl] = useState(recipeController.image)

  useEffect(() => {
    const subscription = recipeController.imageUrlSubject.subscribe({
      next(url: any) {
        setUrl(url)
      },
    })
    return () => subscription.unsubscribe()
  }, [recipeController])

  return url
}

export default useRecipeUrl
