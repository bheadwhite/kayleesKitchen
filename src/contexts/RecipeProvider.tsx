import React from "react";
import { RecipeContext } from "src/contexts/recipe_conext";
import RecipeController from "src/controllers/Recipe";

const RecipeProvider = ({ children }) => {
  const recipe = React.useMemo(() => new RecipeController(), []);
  return (
    <RecipeContext.Provider value={recipe}>{children}</RecipeContext.Provider>
  );
};

export default RecipeProvider;
