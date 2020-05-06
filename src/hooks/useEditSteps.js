import { useState, useEffect } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useEditSteps = () => {
  const controller = useRecipeController()
  const [editSteps, setEditSteps] = useState(controller.editSteps)

  useEffect(() => {
    const subscription = controller.editStepsSubject.subscribe({
      next(steps) {
        setEditSteps(steps)
      },
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return editSteps
}

export default useEditSteps
