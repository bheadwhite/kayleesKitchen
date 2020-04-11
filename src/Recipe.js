import React, { useState } from "react"

const Recipe = ({ recipe }) => {
  const { ingredients, directions } = recipe
  if (typeof recipe === "undefined") return null
  return (
    <div>
      <h1>{recipe.title}</h1>
      <Ingredients ingredients={ingredients} />
      {directions.map(({ type, text }, index) => {
        if (type === "section") {
          return (
            <h3 key={index} style={{ color: "blue" }}>
              {text}
            </h3>
          )
        } else if (type === "step") {
          return (
            <div key={index}>
              <input type='checkbox' />
              <p style={{ display: "inline" }}> - {text}</p>
            </div>
          )
        } else {
          return (
            <p key={index} style={{ color: "red" }}>
              {text}
            </p>
          )
        }
      })}
    </div>
  )
}

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
      {ingredients.map((ingredient) => {
        let strike = "none"
        if (checkedIngredients.indexOf(ingredient.name) !== -1) {
          strike = "line-through"
        }
        return (
          <div
            key={ingredient.name + ingredient.amount}
            onClick={() => handleCheckedIngredient(ingredient.name)}
            style={{ textDecoration: strike }}>
            <span style={{ fontWeight: 500, color: "green" }}>{ingredient.name}</span> -{" "}
            {ingredient.amount}
          </div>
        )
      })}
    </div>
  )
}

export default Recipe
