import { useEffect, useState, useMemo } from "react";
import { getRecipesByEmail } from "src/fire/services";
import { recipesRef } from "src/fire/firebase";
import useUser from "src/controllers/Auth/useUser";
import { Recipe } from "src/types/types";
import { unpackRecipes } from "src/fire/unpackers";

const useUsersRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const user = useUser();

  useMemo(() => {
    if (user != null) {
      return recipesRef
        .where("email", "==", user.email)
        .onSnapshot((snapShot) => {
          setRecipes(unpackRecipes(snapShot));
        });
    }
  }, [user]);

  useEffect(() => {
    if (user != null) {
      getRecipesByEmail(user.email)
        .then((recipes) => setRecipes(recipes))
        .catch((e) => console.log("error pulling your recipes", e));
    }
  }, [user]);

  return recipes;
};

export default useUsersRecipes;
