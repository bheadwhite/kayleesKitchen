import { useEffect, useState } from "react";
import useRecipeController from "src/controllers/Recipe/useRecipeController";

const useIngredients = () => {
  const controller = useRecipeController();
  const [ingredients, setIngredients] = useState(
    controller.ingredients.getState(),
  );

  useEffect(() => {
    const subscription = controller.onIngredientsChange((ingredients) =>
      setIngredients(ingredients),
    );
    return () => subscription.unsubscribe();
  }, [controller]);

  return ingredients;
};

export default useIngredients;
