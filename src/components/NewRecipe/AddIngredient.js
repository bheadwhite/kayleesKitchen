import React, { useRef } from "react"
import { useFormState, useForm } from "react-final-form"
import useEditIngredient from "controllers/Recipe/useEditIngredient"
import useRecipeController from "controllers/Recipe/useRecipeController"
import { Checkbox, TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"
import AddIcon from "@material-ui/icons/Add"
import CheckIcon from "@material-ui/icons/Check"
import CloseIcon from "@material-ui/icons/Close"

const useStyles = makeStyles((theme) => ({
  addIngredientContainer: {
    background: "rgba(0, 0, 0, 0.05)",
    padding: theme.spacing(0.5),
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
  const { change } = useForm()
  const { values } = useFormState()
  const classes = useStyles()

  const updateIngredient = () => controller.updateIngredient(values)
  const addIngredient = () => {
    controller.addIngredient(values)
    addIngredientRef.current.querySelector("input").focus()
    change("name", "")
    change("amount", "")
    change("unique", false)
    change("optional", false)
  }

  const resetEditIngredient = () => controller.resetEditIngredient()

  return (
    <div className={classes.addIngredientContainer}>
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
        <TextField
          id='ingred-amt'
          name='amount'
          value={values.amount}
          placeholder='Amount'
        />
        {editIngredient?.name === "" || editIngredient == null ? (
          <Button onClick={addIngredient} style={{ whitespace: "nowrap" }}>
            <span
              id='add-ingredient'
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}>
              <AddIcon />
            </span>
          </Button>
        ) : (
          <React.Fragment>
            <Button onClick={updateIngredient} style={{ background: "green" }}>
              <CheckIcon />
            </Button>
            <Button onClick={resetEditIngredient}>
              <CloseIcon />
            </Button>
          </React.Fragment>
        )}
      </div>
    </div>
  )
}

export default AddIngredient
