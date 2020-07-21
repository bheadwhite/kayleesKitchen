import { useEffect, useState } from "react"
import { useRecipeController } from "controllers/RecipeController"

const useDirections = () => {
  const controller = useRecipeController()
  const [directions, setDirections] = useState(controller.directions)

  useEffect(() => {
    const subscription = controller.directionsSubject.subscribe({
      next(directions) {
        setDirections(directions)
      },
    })
    return () => subscription.unsubscribe()
  }, [controller])

  return directions
}

export default useDirections
