import React from "react"
import { makeStyles } from "@material-ui/core"
import Ingredients from "./Ingredients"

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

export default Recipe
