import { useEffect, useState } from "react"
import useRecipeController from "controllers/Recipe/useRecipeController"

const useIngredients = () => {
  const controller = useRecipeController()
  const [ingredients, setIngredients] = useState(controller.ingredients)

  useEffect(() => {
    const subscription = controller.onIngredientsChange((ingredients) =>
      setIngredients(ingredients)
    )
    return () => subscription.unsubscribe()
  }, [controller])

  return ingredients
}

export default useIngredients
