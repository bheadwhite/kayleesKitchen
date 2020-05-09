import { useEffect, useState } from "react"
import { getRecipesByEmail } from "fire/services"
import useAuth from "hooks/useAuth"

const useUsersRecipes = () => {
  const [recipes, setRecipes] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    ;(async () => {
      if (user != null) {
        try {
          const recipes = await getRecipesByEmail(user.email)
          setRecipes(recipes.docs)
        } catch (e) {
          console.log("error pulling your recipes", e)
        }
      }
    })()
  }, [user])

  return recipes
}

export default useUsersRecipes
