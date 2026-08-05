import clsx from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { ArrowBackIcon, Button } from "components"
import Recipe from "components/Recipe"
import RecipeTable from "components/RecipeTable"
import { onRecipesSnapshot } from "fire/services"
import type { Recipe as RecipeType } from "@/types"

const Recipes = () => {
  const [recipes, setRecipes] = useState<RecipeType[]>([])
  const [selected, setSelected] = useState<RecipeType | null>(null)
  /** Where the list was scrolled to when the open recipe was picked. */
  const listScrollY = useRef(0)
  // <Profile> links here with `?open=<id>` for one of your own recipes and
  // `?cook=<name>` for everyone else's. Both are read once, on arrival: they
  // seed this view rather than driving it, so closing the recipe or editing the
  // search box does not fight the URL.
  const [searchParams] = useSearchParams()
  const openId = useRef(searchParams.get("open")).current
  const initialFilter = useRef(searchParams.get("cook") ?? "").current

  useEffect(() => onRecipesSnapshot(setRecipes), [])

  // The id arrives before the recipes do, so this waits for the snapshot rather
  // than reading `recipes` at mount. `openedFromUrl` keeps it to one shot —
  // otherwise pressing "All recipes" would immediately reopen the same recipe.
  const openedFromUrl = useRef(false)
  useEffect(() => {
    if (openId == null || openedFromUrl.current) return
    const match = recipes.find((recipe) => recipe.id === openId)
    if (match == null) return
    openedFromUrl.current = true
    setSelected(match)
  }, [recipes, openId])

  const openRecipe = (recipe: RecipeType) => {
    listScrollY.current = window.scrollY
    setSelected(recipe)
  }

  // A recipe opens at the top; coming back returns to the row you tapped rather
  // than the top of the list. `useLayoutEffect` so the scroll lands before paint
  // — in a plain effect the browser shows the wrong offset for a frame first.
  useLayoutEffect(() => {
    window.scrollTo({ top: selected != null ? 0 : listScrollY.current })
  }, [selected])

  return (
    <div className='w-full'>
      {/* Master / detail: the list and the recipe never share the screen, so a
       *  selection is not stranded below however many rows you scrolled past.
       *  The table stays mounted — just hidden — so its filter text survives
       *  a round trip into a recipe and back. */}
      <div className={clsx(selected != null && "hidden")}>
        <RecipeTable
          recipes={recipes}
          selectedId={selected?.id}
          onSelect={openRecipe}
          initialFilter={initialFilter}
        />
      </div>

      {selected != null && (
        <>
          <Button variant='ghost' onClick={() => setSelected(null)} className='mt-0 mb-3 -ml-2'>
            <ArrowBackIcon />
            All recipes
          </Button>
          <Recipe recipe={selected} />
        </>
      )}
    </div>
  )
}

export default Recipes
