import { useEffect, useState } from "react"

import { useSessionUser } from "contexts/AuthProvider"
import { onRecipesByEmailSnapshot } from "fire/services"
import type { Recipe } from "@/types"

/**
 * Live list of the signed-in user's recipes.
 *
 * The old version started an `onSnapshot` listener inside `useMemo` (so it was
 * never torn down) and separately fetched the same data with `getDocs`. One
 * subscription with proper cleanup does both jobs.
 */
const useUsersRecipes = (): Recipe[] => {
  const user = useSessionUser()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const email = user?.email

  useEffect(() => {
    if (!email) {
      setRecipes([])
      return
    }
    return onRecipesByEmailSnapshot(email, setRecipes)
  }, [email])

  return recipes
}

export default useUsersRecipes
