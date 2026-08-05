import { useRef } from "react"
import { useForm, useFormState } from "react-final-form"

import { AddIcon, Button, CheckIcon, CloseIcon } from "components"
import { Checkbox, TextField } from "components/finalForm"
import { useEditIngredient, useRecipePresenter } from "contexts/RecipeProvider"
import type { Ingredient } from "@/types"

const AddIngredient = () => {
  const presenter = useRecipePresenter()
  const editIngredient = useEditIngredient()
  const nameFieldRef = useRef<HTMLDivElement>(null)
  const { change } = useForm()
  const { values } = useFormState<Ingredient>()

  const isEditing = Boolean(editIngredient?.name)

  const addIngredient = () => {
    presenter.addIngredient(values)
    nameFieldRef.current?.querySelector("input")?.focus()
    change("name", "")
    change("amount", "")
    change("unique", false)
    change("optional", false)
  }

  const updateIngredient = () => presenter.updateIngredient(values)
  const resetEditIngredient = () => presenter.resetEditIngredient()

  return (
    <div className='bg-brand-well p-2'>
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
        {isEditing ? (
          <>
            <Button
              onClick={updateIngredient}
              className='bg-brand-green hover:bg-brand-green/85'
              aria-label='Save ingredient'>
              <CheckIcon />
            </Button>
            <Button onClick={resetEditIngredient} danger aria-label='Cancel editing ingredient'>
              <CloseIcon />
            </Button>
          </>
        ) : (
          <Button onClick={addIngredient} aria-label='Add ingredient'>
            <span id='add-ingredient' className='flex items-center justify-center'>
              <AddIcon />
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}

export default AddIngredient
