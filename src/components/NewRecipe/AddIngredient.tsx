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
    <div className='bg-brand-well p-1'>
      <div>
        <Checkbox name='optional' checked={values.optional} label='optional' />
        <Checkbox name='unique' checked={values.unique} label='unique' />
      </div>
      <div className='flex items-end gap-2'>
        <TextField id='nameInput' name='name' placeholder='Name' ref={nameFieldRef} />
        <TextField id='ingred-amt' name='amount' placeholder='Amount' />
        {isEditing ? (
          <>
            <Button onClick={updateIngredient} className='bg-brand-green hover:bg-brand-green/85'>
              <CheckIcon />
            </Button>
            <Button onClick={resetEditIngredient} danger>
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
