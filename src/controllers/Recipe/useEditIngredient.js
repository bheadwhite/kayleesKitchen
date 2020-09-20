import { useEffect, useState } from "react"
import useRecipeController from "controllers/Recipe/useRecipeController"

const useEditIngredient = () => {
  const controller = useRecipeController()
  const [editIngredient, setEditIngredient] = useState(
    controller.editIngredient.getState()
  )

  useEffect(() => {
    const subscription = controller.onEditIngredientChange((editIngredient) =>
      setEditIngredient(editIngredient)
    )
    return () => subscription.unsubscribe()
  }, [controller])

  return editIngredient
}

export default useEditIngredient
