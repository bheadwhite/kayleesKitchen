import React, { useState } from "react"
import Recipe from "./Recipe"
import * as recipesArray from "./Recipes"

const Home = () => {
  const [recipe, setRecipe] = useState()
  const recipes = { ...recipesArray }
  const handleRecipe = (e) => {
    if (e.target.value != null) {
      setRecipe(e.target.value)
    }
  }
  return (
    <div>
      <div>Welcome to Kays Kitchen</div>
      <select value={recipe} onChange={handleRecipe}>
        <option>Select a recipe...</option>
        {Object.keys(recipes)
          .sort()
          .map((recipe) => (
            <option key={recipe} value={recipe}>
              {recipes[recipe].title}
            </option>
          ))}
      </select>
      {recipe && <Recipe recipe={recipes[recipe]} />}
    </div>
  )
}

export default Home
