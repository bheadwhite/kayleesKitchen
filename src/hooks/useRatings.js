import { useState, useEffect } from "react"
import { getRatings } from "fire/services"

const useRatings = (recipeId) => {
  const [ratings, setRatings] = useState({ avg: 0, totalVotes: 0 })

  useEffect(() => {
    getRatings().then((res) => {
      res.docs.forEach((doc) => {
        const rating = doc.data()
        if (rating.recipeId === recipeId) {
          if (rating?.scores != null && rating?.scores.length > 0) {
            const total = rating.scores.reduce((reducer, { score }) => {
              return (reducer += score)
            }, 0)
            setRatings({ avg: total / rating.scores.length, totalVotes: rating.scores.length })
          }
        }
      })
    })
  }, [recipeId])

  return ratings
}

export default useRatings
