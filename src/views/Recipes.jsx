import React, { useState, useEffect } from "react"
import Recipe from "../components/Recipe"
import { makeStyles } from "@material-ui/core"
import ReactSelect from "react-select"
import { recipesRef } from "fire/firebase"

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
    recipesRef.onSnapshot((snapShot) => {
      setMyRecipes(
        snapShot.docs.sort((a, b) => {
          if (a.data().title.toLowerCase() > b.data().title.toLowerCase()) {
            return 1
          } else {
            return -1
          }
        })
      )
    })
  }, [])

  return (
    <div className={classes.recipes}>
      <ReactSelect
        onChange={handleRecipe}
        defaultValue=''
        className={classes.select}
        placeholder='Select a Recipe...'
        options={myRecipes.map((recipe) => {
          const data = recipe.data()
          if (data != null) {
            data.id = recipe.id
            return {
              label: data.title,
              value: data,
            }
          } else {
            return null
          }
        })}
      />
      {recipe && <Recipe recipe={recipe} />}
    </div>
  )
}

export default Recipes
