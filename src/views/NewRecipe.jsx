import React, { useState } from "react"
// import { NewIngredientForm } from "components/CreateRecipe"
import { Warning } from "@material-ui/icons"
import { TextField } from "components/finalForm"
import { Button } from "components"
import theme from "theme"
import { Dialog } from "@material-ui/core"
import { Form } from "react-final-form"
import { toast } from "react-toastify"
import { makeStyles } from "@material-ui/core"
import useEditIngredient from "hooks/useEditIngredient"
import useEditSection from "hooks/useEditSection"
import useEditSteps from "hooks/useEditSteps"
import { AddIngredient, ListIngredients, ListDirections } from "components/NewRecipe"

const useStyles = makeStyles((theme) => ({}))

const CreateNewRecipe = () => {
  const classes = useStyles()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [directions, setDirections] = useState([])
  const [indexToDelete, setIndexToDelete] = useState(null)
  const [modal, setModal] = useState(false)
  const editIngredient = useEditIngredient()
  const editSection = useEditSection()
  const editSteps = useEditSteps()
  // const controller = useRecipeController()

  const onSubmit = () => {
    console.log("submitting")
  }
  const validate = () => {
    const errors = {}
    return errors
  }
  const handleConfirmDeleteModal = () => setModal((a) => !a)
  const getSteps = () => {
    console.log("loading steps...")
    const steps = {}
    for (let i = 0; i <= directions.length; i++) {
      console.log(editSteps, editSteps[i])
      steps[`nextStep-${i}`] = editSteps[i] || ""
    }
    return steps
  }

  const deleteDirection = (index, i) => {
    const clonedDirections = directions.slice()
    if (index == null && typeof indexToDelete === "number") {
      handleConfirmDeleteModal()
      clonedDirections.splice(indexToDelete, 1)
      setDirections(clonedDirections)
      setIndexToDelete(null)
    } else {
      clonedDirections[index].splice(i, 1)
    }
    setDirections(clonedDirections)
  }

  return (
    <Form
      onSubmit={onSubmit}
      validate={validate}
      initialValues={{
        name: editIngredient.name,
        amount: editIngredient.amount,
        directions,
        optional: editIngredient.optional,
        unique: editIngredient.unique,
        section: editSection,
        ...getSteps(),
      }}>
      {({ handleSubmit, values, errors }) => {
        console.log("values", JSON.stringify(values, 2, undefined))
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const recipeErrors = Object.values(errors)
              setIsSubmitting(true)
              if (recipeErrors.length > 0) {
                recipeErrors.forEach((error) => {
                  setIsSubmitting(false)
                  toast.info(e)
                })
              } else {
                handleSubmit(values)
              }
            }}>
            <div>
              <TextField name='title' label='Recipe Title' />
            </div>
            <ListIngredients />
            <AddIngredient />
            <ListDirections />
            <Dialog
              open={modal}
              id='confirm-dialog'
              onClose={handleConfirmDeleteModal}
              title='delete section?'>
              <div className={classes.container}>
                <Warning />
                <p>Are you sure you want to delete this section?</p>
                <Button
                  style={{ marginRight: theme.spacing(1) }}
                  onClick={handleConfirmDeleteModal}>
                  No
                </Button>
                <Button onClick={() => deleteDirection(null)}>Yes</Button>
              </div>
            </Dialog>
            {isSubmitting && <div>submitting</div>}
          </form>
        )
      }}
    </Form>
  )
}

export default CreateNewRecipe
