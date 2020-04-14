import React, { useState, useMemo } from "react"
import Recipe from "./Recipe"
import { makeStyles } from "@material-ui/core"
import ReactSelect from "react-select"
import * as recipesArray from "./Recipes"

const useStyles = makeStyles((theme) => ({
  select: {
    maxWidth: 400,
  },
}))

const Home = () => {
  const classes = useStyles()
  const [recipe, setRecipe] = useState("")
  const handleRecipe = ({ value: recipe }) => {
    if (recipe != null) {
      setRecipe(recipe)
    }
  }
  const recipes = useMemo(
    () =>
      Object.values({ ...recipesArray }).sort((a, b) => {
        if (typeof a.category === "undefined" || typeof b.category === "undefined") return 0
        if (a.category.sort < b.category.sort) {
          return -1
        } else if (a.category.sort > b.category.sort) {
          return 1
        } else {
          return 0
        }
      }),
    []
  )
  return (
    <div>
      <div>Welcome to kitchen helper app</div>
      <ReactSelect
        onChange={handleRecipe}
        defaultValue=''
        className={classes.select}
        placeholder='Select a Recipe...'
        options={recipes.map((recipe, index) => ({ label: recipe.title, value: recipe }))}
      />
      {recipe && <Recipe recipe={recipe} />}
    </div>
  )
}

export default Home