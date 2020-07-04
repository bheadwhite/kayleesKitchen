import React, { useState } from "react"
import { makeStyles, useTheme } from "@material-ui/core"
import Ingredients from "./Ingredients"
import { useRatings, useUser } from "hooks"
import Star from "mdi-material-ui/Star"
import StarOutline from "mdi-material-ui/StarOutline"
import StarHalfFull from "mdi-material-ui/StarHalfFull"
import { getMyRatingByIdAndEmail } from "fire/services"
import { Button } from "components"

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

const starStyles = {
  color: "yellow",
  stroke: "black",
}

const Recipe = ({ recipe }) => {
  const classes = useStyles()
  const [showRatingBox, setShowRatingBox] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const { ingredients, directions } = recipe
  const { avg, totalVotes } = useRatings(recipe?.id ?? null)
  const user = useUser()
  const stars = avg.toFixed()
  const handleRate = () => {
    getMyRatingByIdAndEmail(recipe.id, user.email).then((myRating) => {
      setMyRating(myRating)
      setShowRatingBox(true)
    })
  }
  let halfStar = false
  if (avg !== 0) {
    const diff = avg.toFixed(1) - stars
    if (diff > 0.2 && diff < 0.5) {
      halfStar = true
    }
  }

  if (recipe == null) return null
  return (
    <div>
      <h1 className={classes.title}>
        <span>{recipe.title}</span>
        {showRatingBox ? (
          <RatingSubmitionBox score={myRating} recipeId={recipe.id} />
        ) : (
          <RatedStars
            stars={stars}
            halfStar={halfStar}
            totalVotes={totalVotes}
            handleRate={handleRate}
          />
        )}
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

const RatedStars = ({ stars, halfStar, totalVotes, handleRate }) => {
  const theme = useTheme()
  const starIcons = Array.from({ length: 5 }).map((_, index) => {
    if (stars > index) {
      return <Star key={index} style={starStyles} />
    } else if (halfStar) {
      return <StarHalfFull key={index} style={starStyles} />
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
      <div onClick={handleRate} style={{ cursor: "pointer", marginLeft: theme.spacing(0.5) }}>
        rate
      </div>
    </div>
  )
}

const RatingSubmitionBox = ({ score, recipeId }) => {
  const [hoverScore, setHoverScore] = useState(0)
  const [clickedScore, setClickedScore] = useState(score)
  const user = useUser()
  const theme = useTheme()
  const scoreGreaterThanOrEqualTo = (num) => {
    return hoverScore >= num || clickedScore >= num
  }
  const resetHover = () => setHoverScore(0)
  const handleSubmitRating = () => {}

  return (
    <div
      onMouseLeave={resetHover}
      onMouseOut={resetHover}
      style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarOrStarOutline
          key={index}
          check={scoreGreaterThanOrEqualTo(index + 1)}
          onMouseOver={() => setHoverScore(index + 1)}
          onClick={() => setClickedScore(index + 1)}
        />
      ))}
      <Button onClick={handleSubmitRating} style={{ marginLeft: theme.spacing(0.5) }}>
        Submit Rating
      </Button>
    </div>
  )
}

const StarOrStarOutline = ({ check, ...props }) => {
  if (check) {
    return <Star style={{ ...starStyles, cursor: "pointer" }} {...props} />
  } else {
    return <StarOutline {...props} />
  }
}
export default Recipe
