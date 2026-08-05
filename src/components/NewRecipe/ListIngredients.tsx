import clsx from "clsx"

import { Button, DeleteIcon, EditIcon } from "components"
import { useIngredients, useRecipePresenter } from "contexts/RecipeProvider"
import type { Ingredient } from "@/types"

const ListIngredients = () => {
  const presenter = useRecipePresenter()
  const ingredients = useIngredients()

  const setEditIngredient = (ingredient: Ingredient) => presenter.setEditIngredient(ingredient)
  const deleteIngredient = (index: number) => {
    presenter.deleteIngredient(index)
    presenter.resetEditIngredient()
  }

  if (ingredients.length === 0) {
    return <p className='py-3 text-muted'>Nothing listed yet.</p>
  }

  return (
    <div>
      {ingredients.map((ingredient, index) => (
        <div
          key={`${ingredient.name}-${index}-${ingredient.amount}`}
          className='flex items-center justify-between gap-2 border-b border-ink/8 py-1'>
          <div className='min-w-0 break-words'>
            {/* Mono palette: an unusual ingredient takes the accent rather than
             *  a color of its own. */}
            <span className={clsx("mr-1 font-medium", ingredient.unique && "text-steel-700")}>
              {ingredient.name}
            </span>
            <span className='text-ink/70'>{`— ${ingredient.amount}`}</span>
            {ingredient.optional && <span className='ml-1 text-sm text-muted'>(optional)</span>}
          </div>

          <div className='flex shrink-0 items-center'>
            <Button
              variant='ghost'
              icon
              onClick={() => setEditIngredient(ingredient)}
              aria-label={`Edit ${ingredient.name}`}>
              <EditIcon />
            </Button>
            <Button
              variant='ghost'
              icon
              danger
              onClick={() => deleteIngredient(index)}
              aria-label={`Delete ${ingredient.name}`}>
              <DeleteIcon />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ListIngredients
