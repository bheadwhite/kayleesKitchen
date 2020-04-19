import React, { useState } from "react"

const Ingredients = ({ ingredients }) => {
  const [checkedIngredients, setCheckedIngredients] = useState([])
  const handleCheckedIngredient = (ingredient) => {
    const checkedIngredientsCopy = checkedIngredients.slice()

    if (checkedIngredients.indexOf(ingredient) !== -1) {
      const index = checkedIngredientsCopy.indexOf(ingredient)
      checkedIngredientsCopy.splice(index, 1)
      setCheckedIngredients(checkedIngredientsCopy)
    } else {
      checkedIngredientsCopy.push(ingredient)
      setCheckedIngredients(checkedIngredientsCopy)
    }
  }

  return (
    <div>
      <h3>Ingredients</h3>
      {ingredients?.map((ingredient, index) => {
        let strike = "none"
        if (checkedIngredients.indexOf(`${ingredient.name}-${index}`) !== -1) {
          strike = "line-through"
        }
        return (
          <div
            key={ingredient.type + ingredient.name + ingredient.parens + ingredient.amount}
            style={{ textDecoration: strike }}>
            <span
              style={{
                fontWeight: 500,
                color: ingredient.special ? "red" : "green",
                cursor: "pointer",
              }}
              onClick={() => handleCheckedIngredient(`${ingredient.name}-${index}`)}>
              {ingredient.name}
            </span>
            <span>{` - ${ingredient.amount}`}</span>
            {ingredient.optional && <span style={{ color: "rgba(0,0,0,0.4)" }}> (optional) </span>}
          </div>
        )
      })}
    </div>
  )
}

export default Ingredients
