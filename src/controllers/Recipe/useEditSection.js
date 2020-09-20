import { useState, useEffect } from "react"
import useRecipeController from "controllers/Recipe/useRecipeController"

const useEditSection = () => {
  const controller = useRecipeController()
  const [editSection, setEditSection] = useState(
    controller.editSection.getState()
  )

  useEffect(() => {
    const subscription = controller.onEditSectionChange((section) => {
      setEditSection(section)
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return editSection
}

export default useEditSection
