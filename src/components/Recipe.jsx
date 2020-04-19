import React, { useState } from "react"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  title: {
    [theme.breakpoints.down("xs")]: {
      fontSize: 25,
    },
  },
}))

const Recipe = ({ recipe }) => {
  const classes = useStyles()
  if (recipe == null) return null
  const { ingredients, directions } = recipe

  if (typeof recipe === "undefined") return null
  return (
    <div>
      <h1 className={classes.title}>{recipe.title}</h1>
      <p>{recipe.description}</p>
      {recipe.contributor != null && <p>Contributed by: {recipe.contributor}</p>}
      <Ingredients ingredients={ingredients} />
      {directions?.map(({ type, text }, index) => {
        if (type === "section") {
          return (
            <h3 key={index} style={{ color: "blue" }}>
              {text}
            </h3>
          )
        } else if (type === "step") {
          return (
            <div key={index}>
              <input type='checkbox' style={{ cursor: "pointer" }} />
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
              {ingredient.type && `${ingredient.type} `}
              {ingredient.name}
              {ingredient.parens && ` (${ingredient.parens})`}
            </span>
            <span>{` - ${ingredient.amount}`}</span>
            {ingredient.optional && <span style={{ color: "rgba(0,0,0,0.4)" }}> (optional) </span>}
          </div>
        )
      })}
    </div>
  )
}

export default Recipe
