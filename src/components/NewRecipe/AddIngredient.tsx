import { useRef } from "react"
import { useForm, useFormState } from "react-final-form"

import { AddIcon, Button } from "components"
import { Checkbox, TextField } from "components/finalForm"
import { useEditIngredientIndex, useRecipePresenter } from "contexts/RecipeProvider"
import type { Ingredient } from "@/types"

const AddIngredient = () => {
  const presenter = useRecipePresenter()
  const editIndex = useEditIngredientIndex()
  const nameFieldRef = useRef<HTMLDivElement>(null)
  const { change } = useForm()
  const { values } = useFormState<Ingredient>()

  const addIngredient = () => {
    presenter.addIngredient(values)
    nameFieldRef.current?.querySelector("input")?.focus()
    change("name", "")
    change("amount", "")
    change("unique", false)
    change("optional", false)
  }

  // Editing happens in the list row itself, and both use the same `name` /
  // `amount` fields — so only one of the two is ever mounted, which is what
  // keeps the `add-ingredient` marker in utils.ts meaning "add, not edit".
  if (editIndex != null) return null

  return (
    <div className='mt-2 border border-divider bg-surface p-3'>
      <div>
        <Checkbox name='optional' checked={values.optional} label='optional' />
        <Checkbox name='unique' checked={values.unique} label='unique' />
      </div>
      {/* Name takes the full width on a phone; amount and the action button share
       *  the row below it. Both sit side by side from `sm` up. */}
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
        <Button variant='primary' icon onClick={addIngredient} aria-label='Add ingredient'>
          <span id='add-ingredient' className='flex items-center justify-center'>
            <AddIcon />
          </span>
        </Button>
      </div>
    </div>
  )
}

export default AddIngredient
