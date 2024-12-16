import { useState, useEffect } from "react";
import RecipeComponent from "../components/Recipe";
import { makeStyles } from "@material-ui/core";
import ReactSelect from "react-select";
import { recipesRef } from "src/fire/firebase";
import { unpackRecipes } from "src/fire/unpackers";
import { Recipe } from "src/types/types";

const useStyles = makeStyles(() => ({
  recipes: {
    paddingBottom: 300,
    width: "100%",
    height: "100%",
  },
  select: {
    maxWidth: 400,
  },
}));

const Recipes = () => {
  const classes = useStyles();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    recipesRef.onSnapshot((snapShot) => {
      const recipes = unpackRecipes(snapShot);
      setMyRecipes(recipes);
    });
  }, []);

  return (
    <div className={classes.recipes}>
      <ReactSelect
        onChange={(recipe) => {
          setRecipe(recipe?.value || null);
        }}
        //defaultValue={myRecipes[0]?.id || ""}
        className={classes.select}
        placeholder="Select a Recipe..."
        options={myRecipes.map((recipe) => ({
          value: recipe,
          label: recipe.title,
        }))}
      />
      {recipe && <RecipeComponent recipe={recipe} />}
    </div>
  );
};

export default Recipes;
