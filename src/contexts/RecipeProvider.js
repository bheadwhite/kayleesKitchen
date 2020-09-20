import React from "react"
import RecipeController from "controllers/Recipe"

export const RecipeContext = React.createContext(new RecipeController())

const RecipeProvider = ({ children }) => {
  const recipe = React.useMemo(() => new RecipeController(), [])
  return (
    <RecipeContext.Provider value={recipe}>{children}</RecipeContext.Provider>
  )
}

export default RecipeProvider
