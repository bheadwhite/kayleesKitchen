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
    return <div className='p-2 text-brand-muted'>--</div>
  }

  return (
    <div className='p-2'>
      {ingredients.map((ingredient, index) => (
        <div
          key={`${ingredient.name}-${index}-${ingredient.amount}`}
          className='flex items-center justify-between'>
          <div>
            <span
              className={clsx(
                "mr-1 font-medium",
                ingredient.unique ? "text-brand-red" : "text-brand-green"
              )}>
              {ingredient.name}
            </span>
            <span>{` - ${ingredient.amount}`}</span>
            {ingredient.optional && <span className='ml-1 text-brand-muted'> (optional) </span>}
          </div>

          <div className='whitespace-nowrap'>
            <Button
              onClick={() => setEditIngredient(ingredient)}
              aria-label={`Edit ${ingredient.name}`}>
              <EditIcon />
            </Button>
            <Button
              onClick={() => deleteIngredient(index)}
              danger
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
