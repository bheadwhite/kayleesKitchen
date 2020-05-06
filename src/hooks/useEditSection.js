import { useState, useEffect } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useEditSection = () => {
  const controller = useRecipeController()
  const [editSection, setEditSection] = useState(controller.editSection)

  useEffect(() => {
    const subscription = controller.editSectionSubject.subscribe({
      next(section) {
        setEditSection(section)
      },
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return editSection
}

export default useEditSection
