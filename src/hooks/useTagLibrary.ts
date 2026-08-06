import { useEffect, useMemo, useState } from "react"

import { onRecipesSnapshot, onTagsSnapshot } from "fire/services"
import { normaliseTag } from "presenters/RecipePresenter"
import type { Recipe, TagRecord } from "@/types"

export interface TagLibrary {
  /** Every tag in circulation, alphabetical, each with the colour it is drawn in. */
  tags: TagRecord[]
  /** Colour id per tag name — what the list and the recipe page style chips from. */
  colors: Record<string, string>
  /** How many recipes wear each tag. Zero for a registry entry nothing uses. */
  counts: Record<string, number>
}

/**
 * The tag vocabulary, merged from the two places it lives: the `tags` registry
 * (which holds only colours) and the recipes themselves (which hold the names).
 *
 * Merging is the point. A tag typed into the editor writes nothing to the
 * registry — it exists because a recipe wears it — so a view that read the
 * registry alone would show an empty list on a recipe box full of tags. The
 * other direction matters too: a registry entry with no recipes left is still
 * offered, because someone chose a colour for it and is about to use it again.
 */
const useTagLibrary = (): TagLibrary => {
  const [registry, setRegistry] = useState<TagRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])

  useEffect(() => onTagsSnapshot(setRegistry), [])
  useEffect(() => onRecipesSnapshot(setRecipes), [])

  return useMemo(() => {
    const counts: Record<string, number> = {}
    recipes.forEach((recipe) => {
      // Normalised on the way past: a tag written by hand in the console, or
      // before the rule existed, must not sit beside its own lowercase twin.
      new Set((recipe.tags ?? []).map(normaliseTag).filter(Boolean)).forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1
      })
    })

    const colors: Record<string, string> = {}
    registry.forEach(({ name, color }) => {
      const tag = normaliseTag(name)
      if (tag !== "") colors[tag] = color
    })

    const names = Array.from(new Set([...Object.keys(counts), ...Object.keys(colors)])).sort()

    return {
      tags: names.map((name) => ({ name, color: colors[name] ?? "" })),
      colors,
      counts: Object.fromEntries(names.map((name) => [name, counts[name] ?? 0])),
    }
  }, [registry, recipes])
}

export default useTagLibrary
