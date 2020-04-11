import React, { useState } from "react"
import Recipe from "./Recipe"
import * as recipesArray from "./Recipes"

const Home = () => {
  const [recipe, setRecipe] = useState("ChocolateChipCookies")
  const recipes = { ...recipesArray }
  const handleRecipe = (e) => {
    setRecipe(e.target.value)
  }
  return (
    <div>
      <div>Welcome to Kays Kitchen</div>
      <select value={recipe} onChange={handleRecipe}>
        {/* <option value={undefined}>Select a recipe...</option> */}
        {Object.keys(recipes).map((recipe) => (
          <option key={recipe} value={recipe}>
            {recipes[recipe].title}
          </option>
        ))}
      </select>
      <Recipe recipe={recipes[recipe]} />
    </div>
  )
}

export default Home
