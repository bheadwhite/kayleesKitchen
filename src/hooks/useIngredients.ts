import { useEffect, useState } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useIngredients = () => {
  const controller = useRecipeController()
  const [ingredients, setIngredients] = useState(controller.ingredients)

  useEffect(() => {
    const subscription = controller.ingredientsSubject.subscribe({
      next(ingredients) {
        setIngredients(ingredients)
      },
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return ingredients
}

export default useIngredients
