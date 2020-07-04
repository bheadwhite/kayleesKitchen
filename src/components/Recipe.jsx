import React from "react"
import { makeStyles } from "@material-ui/core"
import Ingredients from "./Ingredients"
import { useRatings } from "hooks"
import Star from "mdi-material-ui/Star"
import StarOutline from "mdi-material-ui/StarOutline"
import StarHalfFull from "mdi-material-ui/StarHalfFull"

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
  const { ingredients, directions } = recipe
  const { avg, totalVotes } = useRatings(recipe?.id ?? null)
  const stars = avg.toFixed()
  let halfStar = false
  if (avg !== 0) {
    let diff = avg.toFixed(1) - stars
    if (diff > 0.2 && diff < 0.5) {
      halfStar = true
    }
  }

  if (recipe == null) return null
  return (
    <div>
      <h1 className={classes.title}>
        <span>{recipe.title}</span>
        <RatedStars stars={stars} halfStar={halfStar} totalVotes={totalVotes} />
      </h1>
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

const RatedStars = ({ stars, halfStar, totalVotes }) => {
  const starIcons = Array.from({ length: 5 }).map((_, index) => {
    if (stars > index) {
      return <Star key={index} />
    } else if (halfStar) {
      return <StarHalfFull key={index} />
    } else {
      return <StarOutline key={index} />
    }
  })
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        fontSize: "1rem",
      }}>
      {starIcons} ({totalVotes})
    </div>
  )
}

export default Recipe
