import React from "react"
import { makeStyles } from "@material-ui/core"
import Ingredients from "./Ingredients"

const useStyles = makeStyles((theme) => ({
  title: {
    [theme.breakpoints.down("xs")]: {
      fontSize: 25,
    },
  },
  img: {
    justifyContent: "center",
    display: "flex",
    alignItems: "center",
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
      <div className={classes.img}>
        {recipe?.image != null && recipe?.image.length > 1 && (
          <img src={recipe.image} alt='recipe preview' style={{ maxHeight: 200 }} />
        )}
      </div>
      <p>{recipe.description}</p>
      {recipe?.contributor != null && <p>Contributed by: {recipe.contributor}</p>}
      <Ingredients ingredients={ingredients} />
      {directions?.map((section, index) => {
        return (
          <div key={index}>
            <h3 key={index} style={{ color: "blue" }}>
              {section.sectionTitle}
            </h3>
            {section.steps.map((step, i) => (
              <div key={i}>
                <input type='checkbox' style={{ cursor: "pointer" }} />
                <p style={{ display: "inline" }}> - {step}</p>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default Recipe
