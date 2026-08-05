import { useEffect, useMemo, useState } from "react"
import Select from "react-select"

import Recipe from "components/Recipe"
import { onRecipesSnapshot } from "fire/services"
import type { Recipe as RecipeType } from "@/types"

interface RecipeOption {
  label: string
  value: RecipeType
}

const Recipes = () => {
  const [recipes, setRecipes] = useState<RecipeType[]>([])
  const [selected, setSelected] = useState<RecipeType | null>(null)

  useEffect(() => onRecipesSnapshot(setRecipes), [])

  const options = useMemo<RecipeOption[]>(
    () =>
      recipes
        .filter((recipe) => Boolean(recipe.title))
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
        .map((recipe) => ({ label: recipe.title, value: recipe })),
    [recipes]
  )

  return (
    <div className='h-full w-full pb-[300px]'>
      <Select<RecipeOption>
        className='max-w-[400px]'
        placeholder='Select a Recipe...'
        options={options}
        onChange={(option) => setSelected(option?.value ?? null)}
      />
      {selected && <Recipe recipe={selected} />}
    </div>
  )
}

export default Recipes
