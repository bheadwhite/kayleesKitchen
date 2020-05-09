import React, { useRef } from "react"
import { useFormState, useForm } from "react-final-form"
import useEditIngredient from "hooks/useEditIngredient"
import { useRecipeController } from "controllers/RecipeController"
import { Checkbox, TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  addIngredientContainer: {
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(1),
  },
  addIngredientFields: {
    display: "flex",
    alignItems: "center",
    "& > div": {
      marginRight: theme.spacing(1),
    },
  },
}))

const AddIngredient = () => {
  const controller = useRecipeController()
  const editIngredient = useEditIngredient()
  const addIngredientRef = useRef()
  const { reset } = useForm()
  const { values } = useFormState()
  const classes = useStyles()

  const updateIngredient = () => controller.updateIngredient(values)
  const addIngredient = () => {
    controller.addIngredient(values)
    reset()
    addIngredientRef.current.querySelector("input").focus()
  }

  const resetEditIngredient = () => controller.resetEditIngredient()

  return (
    <div className={classes.addIngredientContainer}>
      <div>Add Ingredient:</div>
      <div>
        <Checkbox name='optional' checked={values.optional} label='optional' />
        <Checkbox name='unique' checked={values.unique} label='unique' />
      </div>
      <div className={classes.addIngredientFields}>
        <TextField
          id='nameInput'
          name='name'
          value={values.name}
          placeholder='Name'
          ref={addIngredientRef}
        />
        <TextField name='amount' value={values.amount} placeholder='Amount' />
        {editIngredient?.name === "" ? (
          <Button onClick={addIngredient} style={{ whitespace: "nowrap" }}>
            Add Ingredient
          </Button>
        ) : (
          <React.Fragment>
            <Button onClick={updateIngredient}>UpdateItem</Button>
            <Button onClick={resetEditIngredient}>Cancel</Button>
          </React.Fragment>
        )}
      </div>
    </div>
  )
}

export default AddIngredient
