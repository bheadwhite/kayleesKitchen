import { useEffect, useState } from "react"
import useRecipeController from "controllers/Recipe/useRecipeController"

const useDirections = () => {
  const controller = useRecipeController()
  const [directions, setDirections] = useState(controller.directions.getState())

  useEffect(() => {
    const subscription = controller.onDirectionsChange((directions) =>
      setDirections(directions)
    )
    return () => subscription.unsubscribe()
  }, [controller])

  return directions
}

export default useDirections
