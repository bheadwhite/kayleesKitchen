import { useEffect, useState } from "react"
import { toast } from "react-toastify"

import { StarPicker, Stars } from "components"
import { useSessionUser } from "contexts/AuthProvider"
import { getMyRating, rateRecipe } from "fire/services"
import type { Recipe } from "@/types"

/** Sum and count live on the recipe; the average is never stored. */
export const averageOf = (recipe: Recipe): number | null => {
  const count = recipe.ratingCount ?? 0
  if (count <= 0) return null
  return (recipe.ratingSum ?? 0) / count
}

/**
 * A recipe's rating: everyone's average, and — for everyone but the cook who
 * wrote it — five buttons to leave your own.
 *
 * **Ratings are anonymous.** Nothing here can say who gave what, because the
 * individual ratings are readable only by their author (`firestore.rules`);
 * what is shared is the sum and count cached on the recipe. Your own rating
 * comes back because you are allowed to read your own document.
 *
 * You cannot rate your own recipe. That is enforced in the rules as well as
 * here — a hidden control is a UI decision, not a rule.
 */
const RecipeRating = ({ recipe }: { recipe: Recipe }) => {
  const user = useSessionUser()
  const [mine, setMine] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const recipeId = recipe.id
  const uid = user?.uid
  const isMine = Boolean(user?.email) && recipe.email === user?.email

  useEffect(() => {
    if (recipeId == null || uid == null || isMine) {
      setMine(null)
      return
    }

    let current = true
    // Opening another recipe while this is in flight must not land the previous
    // recipe's rating on the new one.
    void getMyRating(recipeId, uid)
      .then((stars) => {
        if (current) setMine(stars)
      })
      .catch(() => {
        if (current) setMine(null)
      })

    return () => {
      current = false
    }
  }, [recipeId, uid, isMine])

  const average = averageOf(recipe)
  const count = recipe.ratingCount ?? 0

  const onRate = async (stars: number) => {
    if (recipeId == null || uid == null) return

    const previous = mine
    setMine(stars) // The press should land immediately; the write follows.
    setSaving(true)
    try {
      await rateRecipe(recipeId, uid, stars)
    } catch (error) {
      setMine(previous)
      toast.error(error instanceof Error ? error.message : "Could not save that rating.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-ink/10 py-2'>
      <span className='flex items-center gap-2'>
        <Stars value={average ?? 0} className='text-lg' />
        <span className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
          {average == null
            ? "Not rated yet"
            : `${average.toFixed(1)} · ${count} rating${count === 1 ? "" : "s"}`}
        </span>
      </span>

      {!isMine && user != null && (
        <span className='flex items-center gap-2'>
          <span className='font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
            {mine == null ? "Rate it" : "Yours"}
          </span>
          <StarPicker value={mine} onRate={(stars) => void onRate(stars)} disabled={saving} />
        </span>
      )}
    </div>
  )
}

export default RecipeRating
