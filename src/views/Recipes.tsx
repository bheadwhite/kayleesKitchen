import clsx from "clsx"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { ArrowBackIcon, Button, EditIcon } from "components"
import { ChefBanner, ChefDrawer } from "components/Chef"
import Recipe from "components/Recipe"
import RecipeTable from "components/RecipeTable"
import { useSessionUser } from "contexts/AuthProvider"
import {
  useBaseServes,
  useChefFork,
  useChefPresenter,
  useRecipeYield,
} from "contexts/ChefProvider"
import useTagLibrary from "hooks/useTagLibrary"
import { onRecipesSnapshot } from "fire/services"
import { diffRecipe, type RecipeBaseline } from "@/recipeDiff"
import type { Recipe as RecipeType } from "@/types"

/**
 * A recipe as `diffRecipe` compares them. Tags and the photo are held level on
 * both sides because the chef proposes neither — a copy that reported "the
 * picture changed" would be describing the comparison, not the cooking.
 */
const toBaseline = (
  title: string,
  ingredients: RecipeType["ingredients"],
  directions: RecipeType["directions"]
): RecipeBaseline => ({ title, ingredients, directions, tags: [], hasImage: false })

const Recipes = () => {
  const navigate = useNavigate()
  const user = useSessionUser()
  const [recipes, setRecipes] = useState<RecipeType[]>([])
  // Colours are read once, here, and handed down: the list and the open recipe
  // draw the same tag, and neither should own a listener to do it.
  const { colors: tagColors } = useTagLibrary()
  // The open recipe is held **by id and looked up in the live list**, not kept
  // as a copy: a copy taken at click time goes stale the moment anything about
  // that recipe changes — its rating, from this very page, most obviously.
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
    setSelectedId(match.id ?? null)
  }, [recipes, openId])

  /** Recipes are owned by the email that saved them. */
  const isMine = (recipe: RecipeType) =>
    Boolean(user?.email) && recipe.email === user?.email

  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? null

  // The chef, and the working copy it hands back. The fork lives on the
  // presenter rather than here so it survives a trip back to the list, and is
  // keyed to the recipe so opening a different one starts a new conversation.
  const chef = useChefPresenter()
  const fork = useChefFork()
  const baseServes = useBaseServes()
  const settledYield = useRecipeYield()
  const [chefOpen, setChefOpen] = useState(false)
  const [showingOriginal, setShowingOriginal] = useState(false)

  useEffect(() => {
    if (selected != null) chef.openFor(selected)
  }, [chef, selected])

  // A different recipe is a different question — nothing carries over.
  useEffect(() => {
    setShowingOriginal(false)
    setChefOpen(false)
  }, [selectedId])

  /**
   * What the page renders. A fork replaces the parts of the recipe the chef
   * reasons about and leaves everything else — the photo, the tags, the credit,
   * the rating — exactly where it was, because those belong to the filed recipe
   * and rating a copy of it would be rating the copy.
   */
  const shown =
    selected != null && fork != null && !showingOriginal ? { ...selected, ...fork } : selected

  const changes =
    selected != null && fork != null && !showingOriginal
      ? diffRecipe(
          toBaseline(selected.title, selected.ingredients, selected.directions),
          toBaseline(fork.title, fork.ingredients, fork.directions)
        )
      : null

  const openRecipe = (recipe: RecipeType) => {
    listScrollY.current = window.scrollY
    setSelectedId(recipe.id ?? null)
  }

  // A recipe opens at the top; coming back returns to the row you tapped rather
  // than the top of the list. `useLayoutEffect` so the scroll lands before paint
  // — in a plain effect the browser shows the wrong offset for a frame first.
  useLayoutEffect(() => {
    window.scrollTo({ top: selectedId != null ? 0 : listScrollY.current })
  }, [selectedId])

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
          tagColors={tagColors}
        />
      </div>

      {selected != null && (
        <>
          <div className='mb-3 flex items-center justify-between gap-2'>
            <Button variant='ghost' onClick={() => setSelectedId(null)} className='mt-0 -ml-2'>
              <ArrowBackIcon />
              All recipes
            </Button>
            {/* Only your own. Every signed-in cook *can* write any recipe, but
             *  offering to edit someone else's from their page invites doing it
             *  by accident — the editor's own picker has always listed yours
             *  alone. */}
            {isMine(selected) && (
              <Button
                variant='ghost'
                onClick={() =>
                  navigate(`/recipes/new?edit=${encodeURIComponent(selected.id ?? "")}`)
                }
                className='mt-0 mr-0'>
                <EditIcon />
                Edit
              </Button>
            )}
          </div>

          <ChefBanner
            showingOriginal={showingOriginal}
            onToggleOriginal={() => setShowingOriginal((shown) => !shown)}
            onOpenChef={() => setChefOpen(true)}
          />

          <Recipe
            recipe={shown}
            tagColors={tagColors}
            changes={changes}
            // The copy's own yield while you are cooking from it, the filed
            // recipe's while you are not — the chip has to agree with the list
            // of ingredients underneath it.
            serves={fork != null && !showingOriginal ? fork.serves : baseServes}
            // A serving is the same size whichever version you are reading —
            // scaling changes how many there are, not how big one is — so the
            // copy's own is preferred only because it is the fresher wording.
            servingSize={
              (fork != null && !showingOriginal ? fork.servingSize : null) ??
              settledYield?.servingSize
            }
          />

          <ChefDrawer open={chefOpen} onOpenChange={setChefOpen} />
        </>
      )}
    </div>
  )
}

export default Recipes
