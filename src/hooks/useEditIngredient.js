import { useEffect, useState } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useEditIngredient = () => {
  const controller = useRecipeController()
  const [editIngredient, setEditIngredient] = useState(controller.editIngredient)

  useEffect(() => {
    const subscription = controller.editIngredientSubject.subscribe({
      next(editIngredient) {
        console.log(editIngredient)
        setEditIngredient(editIngredient)
      },
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return editIngredient
}

export default useEditIngredient
