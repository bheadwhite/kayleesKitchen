import React from "react";
import RecipeController from "src/controllers/Recipe";

export const RecipeContext = React.createContext(new RecipeController());
