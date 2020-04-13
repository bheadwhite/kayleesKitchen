import React, { useState } from "react"
import Recipe from "./Recipe"
import { MenuItem, Select } from "@material-ui/core"
import * as recipesArray from "./Recipes"

const Home = () => {
  const [recipe, setRecipe] = useState("")
  const recipes = { ...recipesArray }
  const handleRecipe = (e) => {
    if (e.target.value != null) {
      setRecipe(e.target.value)
    }
  }
  return (
    <div>
      <div>Welcome to Kays Kitchen</div>
      <Select value={recipe} onChange={handleRecipe} variant='outlined' style={{ minWidth: 300 }}>
        {Object.values(recipes)
          .sort((a, b) => {
            if ((typeof a.category === "undefined") | (typeof b.category === "undefined")) return 0
            if (a.category.sort < b.category.sort) {
              return -1
            } else if (a.category.sort > b.category.sort) {
              return 1
            } else {
              return 0
            }
          })
          .map((recipe, index) => (
            <MenuItem key={recipe.title} value={Object.keys(recipes)[index]}>
              {recipe.title}
            </MenuItem>
          ))}
      </Select>
      {recipe && <Recipe recipe={recipes[recipe]} />}
    </div>
  )
}

export default Home
