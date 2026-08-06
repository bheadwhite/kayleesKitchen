import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import { useFormState } from "react-final-form"

import { Button, ChangeMark, CheckIcon, CloseIcon, DeleteIcon, EditIcon } from "components"
import { Checkbox, TextField } from "components/finalForm"
import {
  useEditIngredientIndex,
  useIngredients,
  useRecipePresenter,
} from "contexts/RecipeProvider"
import type { RowDiff } from "@/recipeDiff"
import type { Ingredient } from "@/types"

interface RowProps {
  ingredient: Ingredient
  change?: RowDiff
  onEdit: () => void
  onDelete: () => void
  onRevert?: () => void
}

/** One listed ingredient. Tapping its mark shows the row as a revert would leave it. */
const IngredientRow = ({ ingredient, change, onEdit, onDelete, onRevert }: RowProps) => {
  const [previewing, setPreviewing] = useState(false)
  const changed = change != null && change.kind !== "same"

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-2 border-b border-ink/8 py-1",
        // A tint on the row and a flag beside it: the tint is what makes a
        // changed line findable while scrolling, the flag is what says which
        // kind of change it was. While previewing, the tint goes — the row is
        // showing itself as an unchanged row, and it should look like one.
        changed && !previewing && "bg-steel-100 px-2",
        changed && previewing && "px-2"
      )}>
      {/* Click-to-edit, like a step in Directions — the pencil is the
       *  affordance, the text is the bigger target. */}
      <button
        type='button'
        onClick={onEdit}
        title='Click to edit'
        className='min-w-0 cursor-text py-1 text-left break-words'>
        {previewing && change?.before != null ? (
          change.before
        ) : previewing ? (
          // Nothing to put back: reverting this row removes it.
          <span className='text-muted line-through'>
            {`${ingredient.name} — ${ingredient.amount}`}
          </span>
        ) : (
          <>
            {/* Mono palette: an unusual ingredient takes the accent rather than
             *  a color of its own. */}
            <span className={clsx("mr-1 font-medium", ingredient.unique && "text-steel-700")}>
              {ingredient.name}
            </span>
            <span className='text-ink/70'>{`— ${ingredient.amount}`}</span>
            {ingredient.optional && <span className='ml-1 text-sm text-muted'>(optional)</span>}
          </>
        )}
      </button>

      <div className='flex shrink-0 items-center gap-1'>
        <ChangeMark change={change?.kind} onRevert={onRevert} onPreview={setPreviewing} />
        <Button variant='ghost' icon onClick={onEdit} aria-label={`Edit ${ingredient.name}`}>
          <EditIcon />
        </Button>
        <Button
          variant='ghost'
          icon
          danger
          onClick={onDelete}
          aria-label={`Delete ${ingredient.name}`}>
          <DeleteIcon />
        </Button>
      </div>
    </div>
  )
}

interface ListIngredientsProps {
  /** Per-row difference from the saved recipe, from `diffRecipe`. */
  changes?: RowDiff[]
}

const ListIngredients = ({ changes = [] }: ListIngredientsProps) => {
  const presenter = useRecipePresenter()
  const ingredients = useIngredients()
  const editIndex = useEditIngredientIndex()
  const { values } = useFormState<Ingredient>()
  const nameFieldRef = useRef<HTMLDivElement>(null)

  // Put the cursor in the name field as soon as a row opens, the way the
  // section title does in Directions.
  useEffect(() => {
    if (editIndex == null) return
    nameFieldRef.current?.querySelector("input")?.focus()
  }, [editIndex])

  if (ingredients.length === 0) {
    return <p className='py-3 text-muted'>Nothing listed yet.</p>
  }

  return (
    <div>
      {ingredients.map((ingredient, index) =>
        editIndex === index ? (
          // The row swaps itself for the editor, and <AddIngredient> hides
          // while it is open — so the shared `name`/`amount` fields and the
          // `nameInput` id stay mounted exactly once (see NewRecipe/utils.ts).
          <div
            key={`${ingredient.name}-${index}-edit`}
            className='border-b border-ink/8 bg-surface px-2 py-2'>
            <div>
              <Checkbox name='optional' checked={values.optional} label='optional' />
              <Checkbox name='unique' checked={values.unique} label='unique' />
            </div>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='basis-full sm:basis-0 sm:flex-1'>
                <TextField
                  id='nameInput'
                  name='name'
                  placeholder='Name'
                  fullWidth
                  ref={nameFieldRef}
                />
              </div>
              <div className='min-w-0 flex-1'>
                <TextField id='ingred-amt' name='amount' placeholder='Amount' fullWidth />
              </div>
              <Button
                variant='primary'
                icon
                onClick={() => presenter.updateIngredient(values)}
                aria-label='Save ingredient'>
                <CheckIcon />
              </Button>
              <Button
                icon
                onClick={() => presenter.clearEditIngredient()}
                aria-label='Cancel editing ingredient'>
                <CloseIcon />
              </Button>
            </div>
          </div>
        ) : (
          <IngredientRow
            key={`${ingredient.name}-${index}-${ingredient.amount}`}
            ingredient={ingredient}
            change={changes[index]}
            onEdit={() => presenter.setEditIngredientIndex(index)}
            onDelete={() => presenter.deleteIngredient(index)}
            onRevert={() => presenter.revertIngredient(index)}
          />
        )
      )}
    </div>
  )
}

export default ListIngredients
