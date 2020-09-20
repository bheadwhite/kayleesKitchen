import { useEffect, useState } from "react"
import { getRecipesByEmail } from "fire/services"
import { recipesRef } from "fire/firebase"
import useUser from "controllers/Auth/useUser"

const useUsersRecipes = () => {
  const [recipes, setRecipes] = useState([])
  const user = useUser()

  if (user != null) {
    recipesRef.where("email", "==", user.email).onSnapshot((snapShot) => {
      if (recipes.length !== snapShot.docs.length) {
        setRecipes(snapShot.docs)
      }
    })
  }

  useEffect(() => {
    if (user != null) {
      getRecipesByEmail(user.email)
        .then((recipes) => setRecipes(recipes.docs))
        .catch((e) => console.log("error pulling your recipes", e))
    }
  }, [user])

  return recipes
}

export default useUsersRecipes
