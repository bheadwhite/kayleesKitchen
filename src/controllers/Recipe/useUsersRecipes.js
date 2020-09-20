import { useEffect, useState, useMemo } from "react"
import { getRecipesByEmail } from "fire/services"
import { recipesRef } from "fire/firebase"
import useUser from "controllers/Auth/useUser"

const useUsersRecipes = () => {
  const [recipes, setRecipes] = useState([])
  const user = useUser()

  useMemo(() => {
    if (user != null) {
      return recipesRef
        .where("email", "==", user.email)
        .onSnapshot((snapShot) => {
          setRecipes(snapShot.docs)
        })
    }
  }, [user])

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
