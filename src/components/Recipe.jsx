import React, { useEffect, useState } from "react"
import { makeStyles } from "@material-ui/core"
import Ingredients from "./Ingredients"
import { getUser } from "fire/services"

const useStyles = makeStyles((theme) => ({
  title: {
    [theme.breakpoints.down("xs")]: {
      fontSize: 25,
    },
  },
}))

const Recipe = ({ recipe }) => {
  const classes = useStyles()
  const [contributor, setContributor] = useState({ firstName: "", lastName: "" })

  useEffect(() => {
    ;(async () => {
      if (recipe?.email != null) {
        const user = await getUser(recipe.email)
        const obj = user.docs[0].data()
        setContributor(obj)
      }
    })()
  }, [recipe])

  if (recipe == null) return null
  const { ingredients, directions } = recipe

  if (typeof recipe === "undefined") return null
  return (
    <div>
      <h1 className={classes.title}>{recipe.title}</h1>
      <p>{recipe.description}</p>
      {recipe.email != null && (
        <p>Contributed by: {contributor.firstName + " " + contributor.lastName}</p>
      )}
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
