import { useState, useEffect } from "react"
import { getRatings } from "fire/services"

const useRatings = (recipeId: any) => {
  const [ratings, setRatings] = useState({ avg: 0, totalVotes: 0 })

  useEffect(() => {
    getRatings().then((res) => {
      let recipeRating: any
      res.docs.forEach((doc) => {
        const rating = doc.data()
        if (rating.recipeId === recipeId) {
          recipeRating = rating
        }
      })
      if (recipeRating?.scores != null && recipeRating?.scores.length > 0) {
        const total = recipeRating.scores.reduce(
          (reducer: any, { score }: any) => {
            return (reducer += score)
          },
          0
        )
        setRatings({
          avg: total / recipeRating.scores.length,
          totalVotes: recipeRating.scores.length,
        })
      } else {
        setRatings({ avg: 0, totalVotes: 0 })
      }
    })
  }, [recipeId])

  return ratings
}

export default useRatings
