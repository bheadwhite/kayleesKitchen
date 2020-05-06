import React from "react"
import useIngredients from "hooks/useIngredients"
import { makeStyles } from "@material-ui/core"
import { Button } from "components"
import { Edit, Delete } from "@material-ui/icons"
import { useRecipeController } from "controllers/RecipeController"
import { useForm } from "react-final-form"

const useStyles = makeStyles((theme) => ({
  ingredientsList: {
    padding: theme.spacing(1),
  },
  ingredient: {
    display: "flex",
    alignItems: "center",
    "& svg": {
      cursor: "pointer",
    },
    "& button": {
      padding: 0,
    },
  },
  recipeName: {
    fontWeight: 500,
    marginRight: theme.spacing(1),
  },
  optional: { color: "rgba(0,0,0,0.4)" },
  emptySpace: {
    height: 30,
  },
}))

const ListIngredients = () => {
  const controller = useRecipeController()
  const ingredients = useIngredients()
  const classes = useStyles()
  const { reset } = useForm()
  const setEditIngredient = (ingredient) => controller.setEditIngredient(ingredient)
  const deleteIngredient = (i) => {
    controller.deleteIngredient(i)
    controller.resetEditIngredient()
    reset()
  }

  return (
    <>
      <div className={classes.ingredientsTitle}>Ingredients:</div>
      <div className={classes.ingredientsList}>
        {ingredients.length > 0 ? (
          ingredients.map((ingredient, i) => {
            return (
              <div key={ingredient.name + i + ingredient.amount} className={classes.ingredient}>
                <span
                  className={classes.recipeName}
                  style={{ color: ingredient.unique ? "red" : "green" }}>
                  {`${ingredient.name} `}
                </span>
                <span>{` - ${ingredient.amount}`}</span>
                {ingredient.optional && <span className={classes.optional}> (optional) </span>}

                <Button
                  onClick={() => setEditIngredient(ingredient)}
                  style={{ marginLeft: "1rem" }}>
                  <Edit />
                </Button>
                <Button onClick={() => deleteIngredient(i)}>
                  <Delete />
                </Button>
              </div>
            )
          })
        ) : (
          <div className={classes.emptySpace}>--</div>
        )}
      </div>
    </>
  )
}

export default ListIngredients
