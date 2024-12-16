import { useState } from "react";
import { Ingredient } from "src/types/types";

const Ingredients = ({ ingredients }) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Ingredient[]>(
    [],
  );

  const handleCheckedIngredient = (ingredient) => {
    const checkedIngredientsCopy = checkedIngredients.slice();

    if (checkedIngredients.indexOf(ingredient) !== -1) {
      const index = checkedIngredientsCopy.indexOf(ingredient);
      checkedIngredientsCopy.splice(index, 1);
      setCheckedIngredients(checkedIngredientsCopy);
    } else {
      checkedIngredientsCopy.push(ingredient);
      setCheckedIngredients(checkedIngredientsCopy);
    }
  };

  return (
    <div>
      <h3>Ingredients</h3>
      {ingredients?.map((ingredient, index) => {
        let strike = "none";
        const found = checkedIngredients.findIndex((i) =>
          i.name.indexOf(`${ingredient.name}-${index}`),
        );

        if (found !== -1) {
          strike = "line-through";
        }

        return (
          <div
            key={
              ingredient.type +
              ingredient.name +
              ingredient.parens +
              ingredient.amount
            }
            style={{ textDecoration: strike }}
          >
            <span
              style={{
                fontWeight: 500,
                color: ingredient.unique ? "red" : "green",
                cursor: "pointer",
              }}
              onClick={() =>
                handleCheckedIngredient(`${ingredient.name}-${index}`)
              }
            >
              {ingredient.name}
            </span>
            <span>{` - ${ingredient.amount}`}</span>
            {ingredient.optional && (
              <span style={{ color: "rgba(0,0,0,0.4)" }}> (optional) </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Ingredients;
