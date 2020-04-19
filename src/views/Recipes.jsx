import React, { useState, useEffect } from "react"
import Recipe from "../components/Recipe"
import { makeStyles, Dailog } from "@material-ui/core"
import ReactSelect from "react-select"
import { getRecipes } from "fire/services"

const useStyles = makeStyles((theme) => ({
  recipes: {
    paddingBottom: 300,
    width: "100%",
    height: "100%",
  },
  select: {
    maxWidth: 400,
  },
}))

const Recipes = () => {
  const classes = useStyles()
  const [recipe, setRecipe] = useState("")
  const [myRecipes, setMyRecipes] = useState([])

  const handleRecipe = ({ value: recipe }) => {
    if (recipe != null) {
      setRecipe(recipe)
    }
  }

  useEffect(() => {
    ;(async () => {
      const recipes = await getRecipes()
      setMyRecipes(recipes.docs)
    })()
  }, [])

  return (
    <div className={classes.recipes}>
      <ReactSelect
        onChange={handleRecipe}
        defaultValue=''
        className={classes.select}
        placeholder='Select a Recipe...'
        options={myRecipes.map((recipe, index) => {
          const data = recipe.data()
          if (data != null) {
            data.id = recipe.id
            return {
              label: data.title,
              value: data,
            }
          }
        })}
      />
      {recipe && <Recipe recipe={recipe} />}
    </div>
  )
}

export default Recipes
